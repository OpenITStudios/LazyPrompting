// Windows AppContainer per-SID read/traverse ACEs ONLY on the fresh,
// host-created source snapshot. Never mutate the original checkout or the
// user's profile ACLs. DACL writes use already opened and checked handles
// rather than path-based SetNamedSecurityInfoW (no reparse race).
//
// This is a SOURCE boundary. A successful SetSecurityInfo is not evidence
// that a real AppContainer process can read intended files or is unable to
// read unintended ones. Native denial probes remain mandatory before resume.
use crate::agent_worker_appcontainer::WorkerAppContainer;
use crate::agent_worker_snapshot::PreparedWorkerSnapshot;
use std::{collections::HashSet,fs::{self,File,OpenOptions},
    os::windows::{fs::{MetadataExt,OpenOptionsExt},io::AsRawHandle},
    path::{Path,PathBuf},ptr::null_mut};
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::{ACL,DACL_SECURITY_INFORMATION,PSID};
use windows_sys::Win32::Security::Authorization::{
    EXPLICIT_ACCESS_W,GRANT_ACCESS,GetSecurityInfo,SetEntriesInAclW,
    SetSecurityInfo,TRUSTEE_IS_SID,TRUSTEE_IS_UNKNOWN,TRUSTEE_W,
};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_ATTRIBUTE_REPARSE_POINT,FILE_FLAG_BACKUP_SEMANTICS,
    FILE_FLAG_OPEN_REPARSE_POINT,FILE_GENERIC_READ,FILE_SHARE_READ,
    READ_CONTROL,WRITE_DAC,GetFinalPathNameByHandleW,
};

const FILE_OBJECT:i32=1; // SE_FILE_OBJECT
const DIRECTORY_TRAVERSE:u32=0x0010_00a0; // SYNCHRONIZE | FILE_TRAVERSE | READ_ATTRIBUTES

fn safe_type(file:&File,directory:bool)->Result<(),&'static str>{
    let meta=file.metadata().map_err(|_|"AGENT_SNAPSHOT_ACL_METADATA_FAILED")?;
    if meta.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT!=0||
       if directory{!meta.is_dir()}else{!meta.is_file()}{
        return Err("AGENT_SNAPSHOT_ACL_REPARSE")
    }
    Ok(())
}
fn native_handle_path(file:&File)->Result<String,&'static str>{
    let size=unsafe{
        GetFinalPathNameByHandleW(file.as_raw_handle(),null_mut(),0,0)
    };
    if size==0||size>32768{return Err("AGENT_SNAPSHOT_ACL_HANDLE_INVALID")}
    let mut data=vec![0u16;size as usize+1];
    let len=unsafe{
        GetFinalPathNameByHandleW(file.as_raw_handle(),
            data.as_mut_ptr(),data.len() as u32,0)
    };
    if len==0||len as usize>=data.len(){
        return Err("AGENT_SNAPSHOT_ACL_HANDLE_INVALID")
    }
    let s=String::from_utf16_lossy(&data[..len as usize]).to_ascii_lowercase();
    Ok(s.strip_prefix(r"\\?\").unwrap_or(&s).to_owned())
}
fn normalized_path(path:&Path)->String{
    let s=path.to_string_lossy().replace('/',"\\").to_ascii_lowercase();
    s.strip_prefix(r"\\?\").unwrap_or(&s).to_owned()
}
fn open_acl_target(path:&Path,root:&Path,directory:bool)
    ->Result<File,&'static str>
{
    let mut opt=OpenOptions::new();
    opt.access_mode(READ_CONTROL|WRITE_DAC)
        .share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT |
            if directory{FILE_FLAG_BACKUP_SEMANTICS}else{0});
    let file=opt.open(path).map_err(|_|"AGENT_SNAPSHOT_ACL_OPEN_FAILED")?;
    safe_type(&file,directory)?;
    let actual=native_handle_path(&file)?;
    let expected=normalized_path(path);
    let canonical_root=normalized_path(root);
    if actual!=expected ||
        (actual!=canonical_root &&
         !actual.starts_with(&format!("{}\\",canonical_root.trim_end_matches('\\')))){
        return Err("AGENT_SNAPSHOT_ACL_PATH_MISMATCH")
    }
    Ok(file)
}
fn grant_read_access(file:&File,sid:PSID,mask:u32)->Result<(),&'static str>{
    if sid.is_null(){return Err("AGENT_SNAPSHOT_SID_INVALID")}
    let mut sd=null_mut();
    let mut old_acl:*mut ACL=null_mut();
    let code=unsafe{
        GetSecurityInfo(file.as_raw_handle(),FILE_OBJECT,
            DACL_SECURITY_INFORMATION,null_mut(),null_mut(),&mut old_acl,
            null_mut(),&mut sd)
    };
    if code!=0{return Err("AGENT_SNAPSHOT_ACL_READ_FAILED")}
    // A NULL DACL means unrestricted access to this snapshot file. Never
    // publish a grant on an already-unrestricted security descriptor.
    let result=(||{
        if old_acl.is_null(){return Err("AGENT_SNAPSHOT_NULL_DACL")}
        let entry=EXPLICIT_ACCESS_W{
            grfAccessPermissions:mask,grfAccessMode:GRANT_ACCESS,
            grfInheritance:0, // every approved leaf is explicitly granted
            Trustee:TRUSTEE_W{
                pMultipleTrustee:null_mut(),MultipleTrusteeOperation:0,
                TrusteeForm:TRUSTEE_IS_SID,TrusteeType:TRUSTEE_IS_UNKNOWN,
                ptstrName:sid.cast(),
            }
        };
        let mut next_acl:*mut ACL=null_mut();
        let merge=unsafe{SetEntriesInAclW(1,&entry,old_acl,&mut next_acl)};
        if merge!=0{return Err("AGENT_SNAPSHOT_ACL_MERGE_FAILED")}
        let applied=unsafe{
            SetSecurityInfo(file.as_raw_handle(),FILE_OBJECT,
                DACL_SECURITY_INFORMATION,null_mut(),null_mut(),
                next_acl,null_mut())
        };
        if !next_acl.is_null(){unsafe{LocalFree(next_acl.cast());}}
        if applied!=0{return Err("AGENT_SNAPSHOT_ACL_SET_FAILED")}
        Ok(())
    })();
    if !sd.is_null(){unsafe{LocalFree(sd);}}
    result
}

pub(crate) struct ReadOnlyWorkerSnapshot {
    snapshot:PreparedWorkerSnapshot,
}
impl ReadOnlyWorkerSnapshot {
    pub(crate) fn root(&self)->&Path{self.snapshot.root()}
    pub(crate) fn digest(&self)->&str{self.snapshot.digest()}
}

// Consumes the prepared snapshot; any ACL error drops and removes the staged
// copy. Call only with the exact AppContainer profile owned by the same
// suspended child, never with a renderer- or model-provided SID.
pub(crate) fn grant_snapshot_to_container(
    snapshot:PreparedWorkerSnapshot,
    container:&WorkerAppContainer
)->Result<ReadOnlyWorkerSnapshot,&'static str>{
    if snapshot.entries().is_empty()||snapshot.digest().len()!=64{
        return Err("AGENT_SNAPSHOT_NOT_READY")
    }
    let root=snapshot.root().to_path_buf();
    let sid=container.sid();
    let mut dirs=HashSet::<PathBuf>::new();
    dirs.insert(root.clone());
    let mut files=Vec::new();
    for entry in snapshot.entries(){
        let mut p=root.clone();
        let components:Vec<&str>=entry.relative.split('/').collect();
        for d in &components[..components.len()-1]{
            p.push(d);dirs.insert(p.clone());
        }
        p.push(components[components.len()-1]);files.push(p);
    }
    let mut dirs:Vec<_>=dirs.into_iter().collect();
    dirs.sort_by_key(|path|path.components().count());
    for dir in &dirs {
        let handle=open_acl_target(dir,&root,true)?;
        // No list-directory, WRITE_DAC, DELETE or inheritance for worker SID.
        grant_read_access(&handle,sid,DIRECTORY_TRAVERSE)?;
    }
    for file in &files {
        let handle=open_acl_target(file,&root,false)?;
        grant_read_access(&handle,sid,FILE_GENERIC_READ)?;
    }
    // Granting a package SID is only a DACL change. The real OS child still
    // needs read-success and outside-snapshot read-denial proofs before resume.
    Ok(ReadOnlyWorkerSnapshot{snapshot})
}
