// Native-owned lease table for installed stdio MCP clients. The identity is
// obtained from the actual Windows pipe peer, never supplied by a tool input.
use std::{
    collections::HashMap,
    os::windows::{ffi::OsStringExt, io::{AsRawHandle, FromRawHandle, OwnedHandle}},
    path::Path,
    sync::Mutex,
};
use tokio::net::windows::named_pipe::NamedPipeServer;
use windows_sys::Win32::Foundation::FILETIME;
use windows_sys::Win32::System::{
    Pipes::GetNamedPipeClientProcessId,
    Threading::{GetProcessTimes, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_QUERY_LIMITED_INFORMATION},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ClientIdentity {
    pid: u32,
    creation: u64,
}

fn process_creation(process: &OwnedHandle) -> Option<u64> {
    let mut created = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let mut exited = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let mut kernel = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let mut user = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
    let ok = unsafe {
        GetProcessTimes(process.as_raw_handle(), &mut created, &mut exited,
            &mut kernel, &mut user)
    };
    (ok != 0).then_some(((created.dwHighDateTime as u64) << 32) |
        u64::from(created.dwLowDateTime))
}

pub(crate) fn trusted_client_identity(
    pipe: &NamedPipeServer,
    executable: &Path,
) -> Option<ClientIdentity> {
    let mut pid = 0;
    if unsafe { GetNamedPipeClientProcessId(pipe.as_raw_handle(), &mut pid) } == 0 || pid == 0 {
        return None;
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if process.is_null() { return None; }
    let process = unsafe { OwnedHandle::from_raw_handle(process) };
    let mut buffer = vec![0u16; 32768];
    let mut length = buffer.len() as u32;
    if unsafe {
        QueryFullProcessImageNameW(process.as_raw_handle(), 0, buffer.as_mut_ptr(), &mut length)
    } == 0 { return None; }
    let filename = std::ffi::OsString::from_wide(&buffer[..length as usize]);
    if dunce::canonicalize(filename).ok().as_deref() != Some(executable) {
        return None;
    }
    Some(ClientIdentity { pid, creation: process_creation(&process)? })
}

// A PID alone is insufficient: Windows can reuse it for an unrelated process.
// Check the creation time before considering an old lease still live.
fn owner_alive(owner: ClientIdentity) -> bool {
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, owner.pid) };
    if process.is_null() {
        // Unknown access failures fail closed; invalid PID means exited.
        return std::io::Error::last_os_error().raw_os_error() != Some(87);
    }
    let process = unsafe { OwnedHandle::from_raw_handle(process) };
    process_creation(&process).map_or(true, |creation| creation == owner.creation)
}

#[derive(Default)]
pub(crate) struct McpWorkspaceLeases {
    entries: Mutex<HashMap<String, ClientIdentity>>,
}

impl McpWorkspaceLeases {
    pub(crate) fn authorize(
        &self, workspace: &str, caller: ClientIdentity, release: bool
    ) -> Result<(), &'static str> {
        self.authorize_with(workspace, caller, release, owner_alive)
    }

    fn authorize_with<F: Fn(ClientIdentity) -> bool>(
        &self, workspace: &str, caller: ClientIdentity, release: bool, alive: F
    ) -> Result<(), &'static str> {
        let mut entries = self.entries.lock().map_err(|_| "WORKSPACE_LEASE_UNAVAILABLE")?;
        if let Some(existing) = entries.get(workspace).copied() {
            if existing == caller {
                if release { entries.remove(workspace); }
                return Ok(());
            }
            if alive(existing) { return Err("WORKSPACE_OWNED_BY_OTHER_CLIENT"); }
        }
        if release { return Err("WORKSPACE_NOT_OWNED"); }
        if entries.len() >= 512 {
            entries.retain(|_, owner| alive(*owner));
            if entries.len() >= 512 { return Err("MCP_LEASE_CAPACITY"); }
        }
        entries.insert(workspace.to_owned(), caller);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn workspace_lease_is_exclusive_and_reclaimable_after_client_exit() {
        let leases = McpWorkspaceLeases::default();
        let a = ClientIdentity {pid: 111, creation: 1};
        let b = ClientIdentity {pid: 222, creation: 2};
        assert_eq!(leases.authorize_with("workspace-01",a,false,|_|true),Ok(()));
        assert_eq!(leases.authorize_with("workspace-01",b,false,|_|true),
            Err("WORKSPACE_OWNED_BY_OTHER_CLIENT"));
        assert_eq!(leases.authorize_with("workspace-01",b,true,|_|true),
            Err("WORKSPACE_OWNED_BY_OTHER_CLIENT"));
        assert_eq!(leases.authorize_with("workspace-01",b,false,|_|false),Ok(()));
        assert_eq!(leases.authorize_with("workspace-01",b,true,|_|true),Ok(()));
        assert_eq!(leases.authorize_with("workspace-01",b,true,|_|true),
            Err("WORKSPACE_NOT_OWNED"));
    }
}
