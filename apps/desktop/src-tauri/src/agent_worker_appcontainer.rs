// Native Windows AppContainer *identity* lifecycle for a future read-only
// worker launcher. It is not a process launcher, cannot grant file access,
// and never claims that a binary actually ran inside a sandbox.
//
// AppContainers are default-deny for user data and support explicit capability
// SIDs. This source creates a UNIQUE per-run profile with ZERO capabilities,
// including no internetClient/privateNetworkClientServer grant. A separate,
// reviewed ACL setup and suspended CreateProcessW/STARTUPINFOEXW launcher must
// be completed before any worker can run.
//
// Do not move this API into renderer/MCP. Creating a profile changes the
// operator's per-user OS registry/profile state and requires native authority.
use std::{
    ffi::OsStr,
    os::windows::ffi::OsStrExt,
    ptr::{null, null_mut},
};
use windows_sys::Win32::Security::{
    FreeSid, PSID,
};
use windows_sys::Win32::Security::Isolation::{
    CreateAppContainerProfile, DeleteAppContainerProfile,
};

fn wide(input: &OsStr) -> Vec<u16> {
    input.encode_wide().chain(std::iter::once(0)).collect()
}

// A profile/SID must remain alive while a child runs. This guard has a
// private constructor so a model-selected name or already-existing profile
// cannot be adopted to inherit someone else's AppContainer ACL grants.
pub(crate) struct WorkerAppContainer {
    moniker: Vec<u16>,
    sid: PSID,
}

impl WorkerAppContainer {
    // Source-stage private native constructor; no caller is wired to it.
    pub(crate) fn create_fresh() -> Result<Self, &'static str> {
        let mut random = [0u8; 16];
        getrandom::getrandom(&mut random)
            .map_err(|_| "AGENT_APPCONTAINER_ENTROPY_FAILED")?;
        let name = format!("LazyPromptAgentV2-{}",
            crate::native_ipc_pipe::hex(&random));
        // 50 characters, allowed Windows AppContainer moniker characters.
        if name.len() > 64 { return Err("AGENT_APPCONTAINER_NAME_INVALID"); }
        let moniker = wide(OsStr::new(&name));
        let display = wide(OsStr::new("LazyPrompting isolated worker"));
        let mut sid: PSID = null_mut();
        // SAFETY: name/display are stable NUL-terminated UTF-16 buffers,
        // capabilities is null with count zero, and sid is a live out pointer.
        let hr = unsafe {
            CreateAppContainerProfile(
                moniker.as_ptr(),
                display.as_ptr(),
                display.as_ptr(),
                null(),
                0, // no network/file/device capability SIDs
                &mut sid,
            )
        };
        // A random collision is NOT adopted. Reusing a profile can inherit
        // stale grants made for that SID by a different previous run.
        if hr < 0 || sid.is_null() {
            return Err("AGENT_APPCONTAINER_CREATE_FAILED");
        }
        Ok(Self { moniker, sid })
    }

    // This SID is only an identity for the future Win32 security-capabilities
    // launch attribute. It does not attest the token of a created process.
    pub(crate) fn sid(&self) -> PSID { self.sid }
}

impl Drop for WorkerAppContainer {
    fn drop(&mut self) {
        if !self.sid.is_null() {
            // SAFETY: this SID allocation is returned by CreateAppContainerProfile.
            unsafe { FreeSid(self.sid); }
            self.sid = null_mut();
        }
        // Deleting while a child still runs would invalidate assumptions about
        // profile ownership. A future launcher must hold this guard until the
        // job/process tree has been fully terminated and reaped.
        let _ = unsafe { DeleteAppContainerProfile(self.moniker.as_ptr()) };
    }
}
