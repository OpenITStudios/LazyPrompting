// Native-owned, explicit-file read-only snapshot. Does NOT grant a worker
// filesystem or network access, and does NOT start or resume a subprocess.
use sha2::{Digest,Sha256};
use std::{collections::HashSet,ffi::OsString,fs::{self,File,OpenOptions},
    io::{Read,Write},os::windows::{ffi::OsStringExt,fs::{MetadataExt,OpenOptionsExt},
    io::AsRawHandle},path::{Path,PathBuf}};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_ATTRIBUTE_REPARSE_POINT,FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_SHARE_READ,GetFinalPathNameByHandleW,
};
pub(crate) const MAX_INPUT_FILES:usize=24;
const MAX_FILE_BYTES:u64=1024*1024;
const MAX_TOTAL_BYTES:u64=8*1024*1024;

#[derive(Clone)]
pub(crate) struct SourceInputDigest {
    pub(crate) relative:String,
    pub(crate) bytes:u64,
    pub(crate) sha256:String,
}

pub(crate) struct PreparedWorkerSnapshot {
    root:PathBuf,
    entries:Vec<SourceInputDigest>,
    sha256:String,
    total:u64,
}
impl PreparedWorkerSnapshot {
    pub(crate) fn root(&self)->&Path{&self.root}
    pub(crate) fn digest(&self)->&str{&self.sha256}
    pub(crate) fn total_bytes(&self)->u64{self.total}
    pub(crate) fn entries(&self)->&[SourceInputDigest]{&self.entries}
}
impl Drop for PreparedWorkerSnapshot {
    fn drop(&mut self) {
        // Created with create_dir (never open-or-reuse). Do not follow a
        // replaced junction on cleanup; an owner must reconcile that case.
        if !fs::symlink_metadata(&self.root).is_ok_and(|m|
            m.is_dir()&&m.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT==0) {
            return;
        }
        // On Windows, READONLY files can prevent RemoveDirectory cleanup.
        // Clear that attribute ONLY on known staged copies that are still
        // ordinary files. Never follow a reparse point to another directory.
        for entry in &self.entries {
            let p=self.root.join(&entry.relative);
            if let Ok(meta)=fs::symlink_metadata(&p) {
                if meta.is_file() &&
                    meta.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT==0 {
                    let mut permissions=meta.permissions();
                    permissions.set_readonly(false);
                    let _=fs::set_permissions(&p,permissions);
                }
            }
        }
        if let Err(error)=fs::remove_dir_all(&self.root) {
            eprintln!("Agent input snapshot cleanup held: {error}");
        }
    }
}
pub(crate) fn validate_input_paths(paths:&[String])->Result<(),&'static str>{
    if paths.len()>MAX_INPUT_FILES{return Err("AGENT_INPUT_FILE_LIMIT")}
    let mut seen=HashSet::new();
    for path in paths {
        if path.is_empty()||path.len()>180||path.starts_with('/')||
           !path.is_ascii()||path.bytes().any(|b|b=='\\' as u8||b==b':'||
           b==b'%'||b==b'~')||!seen.insert(path.to_ascii_lowercase()){
            return Err("AGENT_INPUT_PATH_INVALID")
        }
        for p in path.split('/') {
            let lower=p.to_ascii_lowercase();
            let stem=lower.split('.').next().unwrap_or("");
            let device=matches!(stem,"con"|"prn"|"aux"|"nul")||
                stem.len()==4&&(stem.starts_with("com")||stem.starts_with("lpt"))&&
                matches!(stem.as_bytes()[3],b'1'..=b'9');
            if p.is_empty()||p=="."||p==".."||p.ends_with('.')||
               p.ends_with(' ')||device||
               matches!(lower.as_str(),".git"|".ssh"|".env"|".npmrc"|
                   ".pypirc"|"credentials"|"credentials.json"|"secrets.json"|
                   "token.json"|"id_rsa"|"id_ed25519")||
               lower.starts_with(".env.")||
               [".pem",".pfx",".p12",".key"].iter().any(|e|lower.ends_with(e))||
               !p.bytes().all(|b|b.is_ascii_alphanumeric()||
                    matches!(b,b'.'|b'_'|b'-')){
                return Err("AGENT_INPUT_PATH_UNSAFE")
            }
        }
    }
    Ok(())
}
fn ordinary(path:&Path,dir:bool)->Result<(),&'static str>{
    let m=fs::symlink_metadata(path).map_err(|_|"AGENT_INPUT_NOT_FOUND")?;
    if m.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT!=0||
       if dir{!m.is_dir()}else{!m.is_file()}{
        return Err("AGENT_INPUT_REPARSE_OR_TYPE")
    }
    Ok(())
}
fn lower(path:&Path)->String{
    let s=path.to_string_lossy().replace('/',"\\").to_ascii_lowercase();
    s.strip_prefix(r"\\?\").unwrap_or(&s).to_owned()
}
fn handle_path(file:&File)->Result<PathBuf,&'static str>{
    let count=unsafe{GetFinalPathNameByHandleW(file.as_raw_handle(),
        std::ptr::null_mut(),0,0)};
    if count==0||count>32768{return Err("AGENT_INPUT_HANDLE_PATH_INVALID")}
    let mut buffer=vec![0u16;count as usize+1];
    let n=unsafe{GetFinalPathNameByHandleW(file.as_raw_handle(),
        buffer.as_mut_ptr(),buffer.len() as u32,0)};
    if n==0||n as usize>=buffer.len(){
        return Err("AGENT_INPUT_HANDLE_PATH_INVALID")
    }
    Ok(PathBuf::from(OsString::from_wide(&buffer[..n as usize])))
}
fn copy_one(repo:&Path,snapshot:&Path,rel:&str)->Result<SourceInputDigest,&'static str>{
    let parts:Vec<&str>=rel.split('/').collect();
    let mut source=repo.to_path_buf();
    for (i,part) in parts.iter().enumerate(){
        source.push(part);ordinary(&source,i+1<parts.len())?;
    }
    let mut opts=OpenOptions::new();
    opts.read(true).share_mode(FILE_SHARE_READ)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    let mut input=opts.open(&source).map_err(|_|"AGENT_INPUT_OPEN_FAILED")?;
    let m=input.metadata().map_err(|_|"AGENT_INPUT_METADATA_FAILED")?;
    if !m.is_file()||m.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT!=0||
       m.len()>MAX_FILE_BYTES{
        return Err("AGENT_INPUT_NOT_REGULAR_OR_TOO_LARGE")
    }
    let opened=lower(&handle_path(&input)?);
    if !opened.starts_with(&format!("{}\\",lower(repo).trim_end_matches('\\'))){
        return Err("AGENT_INPUT_HANDLE_ESCAPED_REPO")
    }
    let mut bytes=Vec::with_capacity(m.len() as usize);
    input.take(MAX_FILE_BYTES+1).read_to_end(&mut bytes)
        .map_err(|_|"AGENT_INPUT_READ_FAILED")?;
    if bytes.len() as u64>MAX_FILE_BYTES{return Err("AGENT_INPUT_SIZE_DRIFT")}
    let mut dest=snapshot.to_path_buf();
    for part in &parts[..parts.len()-1]{
        dest.push(part);
        if !dest.exists(){fs::create_dir(&dest).map_err(|_|"AGENT_SNAPSHOT_DIR_FAILED")?}
        ordinary(&dest,true)?;
    }
    dest.push(parts[parts.len()-1]);
    let mut output=OpenOptions::new().write(true).create_new(true)
        .open(&dest).map_err(|_|"AGENT_SNAPSHOT_FILE_FAILED")?;
    output.write_all(&bytes).and_then(|_|output.sync_all())
        .map_err(|_|"AGENT_SNAPSHOT_WRITE_FAILED")?;
    drop(output);
    let mut perms=fs::metadata(&dest).map_err(|_|"AGENT_SNAPSHOT_FILE_FAILED")?.permissions();
    perms.set_readonly(true); // hygiene only; not an access-token proof
    fs::set_permissions(&dest,perms).map_err(|_|"AGENT_SNAPSHOT_PERMS_FAILED")?;
    Ok(SourceInputDigest{relative:rel.into(),bytes:bytes.len() as u64,
        sha256:format!("{:x}",Sha256::digest(&bytes))})
}
pub(crate) fn prepare_snapshot(
    private_root:&Path,repository:&Path,approved:&[String],base_sha:&str
)->Result<PreparedWorkerSnapshot,&'static str>{
    validate_input_paths(approved)?;
    if approved.is_empty(){return Err("AGENT_SNAPSHOT_INPUTS_REQUIRED")}
    if !matches!(base_sha.len(),40|64)||!base_sha.bytes().all(|b|b.is_ascii_hexdigit()){
        return Err("AGENT_INPUT_BASE_SHA_INVALID")
    }
    let repo=dunce::canonicalize(repository)
        .map_err(|_|"AGENT_INPUT_REPOSITORY_INVALID")?;
    ordinary(&repo,true)?;
    if !repo.is_absolute()||lower(&repo).starts_with("\\\\"){
        return Err("AGENT_INPUT_REPO_UNSUPPORTED")
    }
    if crate::goal_runs::git(&repo,&["rev-parse","HEAD"])
        .map_err(|_|"AGENT_INPUT_SOURCE_DRIFT")?!=base_sha||
        !crate::goal_runs::git(&repo,&["status","--porcelain","--untracked-files=all"])
        .map_err(|_|"AGENT_INPUT_SOURCE_DRIFT")?.is_empty(){
        return Err("AGENT_INPUT_SOURCE_DRIFT")
    }
    let root=dunce::canonicalize(private_root)
        .map_err(|_|"AGENT_SNAPSHOT_ROOT_INVALID")?;
    ordinary(&root,true)?;
    let mut random=[0u8;16];
    getrandom::getrandom(&mut random).map_err(|_|"AGENT_SNAPSHOT_ENTROPY_FAILED")?;
    let path=root.join(format!("agent-v2-inputs-{}",
        crate::native_ipc_pipe::hex(&random)));
    fs::create_dir(&path).map_err(|_|"AGENT_SNAPSHOT_DIR_FAILED")?;
    let mut snapshot=PreparedWorkerSnapshot{
        root:path,entries:Vec::new(),sha256:String::new(),total:0
    };
    let mut ordered=approved.to_vec();
    ordered.sort_unstable();
    for name in ordered{
        // Prevent Git pathspec magic/glob and option injection.
        let literal=format!(":(literal){name}");
        crate::goal_runs::git(&repo,&["ls-files","--error-unmatch","--",&literal])
            .map_err(|_|"AGENT_INPUT_NOT_TRACKED")?;
        let item=copy_one(&repo,&snapshot.root,&name)?;
        snapshot.total+=item.bytes;
        if snapshot.total>MAX_TOTAL_BYTES{return Err("AGENT_SNAPSHOT_TOTAL_LIMIT")}
        snapshot.entries.push(item);
    }
    let mut hash=Sha256::new();
    hash.update(b"LAZYPROMPTING_V2_READ_ONLY_SNAPSHOT_V1\0");
    hash.update(base_sha.as_bytes());
    for entry in &snapshot.entries{
        hash.update((entry.relative.len() as u32).to_be_bytes());
        hash.update(entry.relative.as_bytes());
        hash.update(entry.bytes.to_be_bytes());
        hash.update(entry.sha256.as_bytes());
    }
    snapshot.sha256=format!("{:x}",hash.finalize());
    Ok(snapshot)
}
