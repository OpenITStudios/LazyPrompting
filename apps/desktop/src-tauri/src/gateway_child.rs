// Gate A foundation: native-owned gateway process lifecycle.
// Deliberately not registered as a Tauri command. No automatic startup or browser authority.
#[cfg(windows)]
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct GatewayChild {
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    job: Mutex<Option<OwnedHandle>>,
}

impl GatewayChild {
    // The caller must resolve and verify both packaged Node and gateway script paths before calling spawn.
    // This method never accepts shell commands, user arguments or renderer-supplied paths.
    pub(crate) fn spawn(&self, executable: &Path, script: &Path) -> Result<u32, &'static str> {
        if !executable.is_absolute()
            || !executable.is_file()
            || !script.is_absolute()
            || !script.is_file()
            || script.extension().and_then(|x| x.to_str()) != Some("mjs")
        {
            return Err("GATEWAY_EXECUTABLE_UNVERIFIED");
        }
        let mut slot = self.child.lock().map_err(|_| "GATEWAY_LOCK_POISONED")?;
        if let Some(child) = slot.as_mut() {
            match child.try_wait() {
                Ok(None) => return Err("GATEWAY_ALREADY_RUNNING"),
                Ok(Some(_)) => {
                    *slot = None;
                }
                Err(_) => return Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
            }
        }
        let mut command = Command::new(executable);
        command.env_clear();
        for name in [
            "SystemRoot",
            "USERPROFILE",
            "APPDATA",
            "LOCALAPPDATA",
            "TEMP",
            "TMP",
            "CODEX_HOME",
        ] {
            if let Some(value) = std::env::var_os(name) {
                command.env(name, value);
            }
        }
        #[cfg(windows)]
        command
            .creation_flags(0x08000000)
            .env("LAZY_NATIVE_BOOTSTRAP", "1"); // CREATE_NO_WINDOW
        let mut child = command
            // Node's ESM entrypoint does not accept a Win32 verbatim drive path.
            .arg(dunce::simplified(script))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "GATEWAY_SPAWN_FAILED")?;
        let pid = child.id();
        #[cfg(windows)]
        {
            let assigned = (|| {
                let mut job = self.job.lock().map_err(|_| "GATEWAY_JOB_LOCK_FAILED")?;
                *job = Some(kill_on_close_job(&child)?);
                Ok::<(), &'static str>(())
            })();
            if let Err(error) = assigned {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        }
        *slot = Some(child);
        Ok(pid)
    }
    // Transfer both MCP pipes together to a dedicated framed stdio transport.
    // Never read protocol output on the UI thread; a missing consumer can block the child.
    pub(crate) fn take_stdio(&self) -> Result<(ChildStdin, ChildStdout), &'static str> {
        let mut slot = self.child.lock().map_err(|_| "GATEWAY_LOCK_POISONED")?;
        let child = slot.as_mut().ok_or("GATEWAY_NOT_RUNNING")?;
        match child.try_wait() {
            Ok(Some(_)) => return Err("GATEWAY_NOT_RUNNING"),
            Ok(None) => {}
            Err(_) => return Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
        }
        if child.stdin.is_none() || child.stdout.is_none() {
            return Err("GATEWAY_STDIO_ALREADY_TAKEN");
        }
        let input = child.stdin.take().ok_or("GATEWAY_STDIO_ALREADY_TAKEN")?;
        let output = child.stdout.take().ok_or("GATEWAY_STDIO_ALREADY_TAKEN")?;
        Ok((input, output))
    }
    pub(crate) fn pid(&self) -> Result<Option<u32>, &'static str> {
        let mut slot = self.child.lock().map_err(|_| "GATEWAY_LOCK_POISONED")?;
        let Some(child) = slot.as_mut() else {
            return Ok(None);
        };
        match child.try_wait() {
            Ok(None) => Ok(Some(child.id())),
            Ok(Some(_)) => {
                *slot = None;
                Ok(None)
            }
            Err(_) => Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
        }
    }
    pub(crate) fn stop(&self) -> Result<(), &'static str> {
        let mut slot = self.child.lock().map_err(|_| "GATEWAY_LOCK_POISONED")?;
        #[cfg(windows)]
        if let Some(job) = self
            .job
            .lock()
            .map_err(|_| "GATEWAY_JOB_LOCK_FAILED")?
            .take()
        {
            drop(job);
            if let Some(child) = slot.as_mut() {
                child.wait().map_err(|_| "GATEWAY_REAP_FAILED")?;
            }
            *slot = None;
            return Ok(());
        }
        if let Some(child) = slot.as_mut() {
            match child.try_wait() {
                Ok(Some(_)) => {
                    *slot = None;
                    return Ok(());
                }
                Ok(None) => {}
                Err(_) => return Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
            }
            // Retain ownership on errors so Drop can retry cleanup.
            child.kill().map_err(|_| "GATEWAY_STOP_FAILED")?;
            child.wait().map_err(|_| "GATEWAY_REAP_FAILED")?;
            *slot = None;
        }
        Ok(())
    }
}

#[cfg(windows)]
fn kill_on_close_job(child: &Child) -> Result<OwnedHandle, &'static str> {
    use std::ptr::null;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    let raw = unsafe { CreateJobObjectW(null(), null()) };
    if raw.is_null() {
        return Err("GATEWAY_JOB_CREATE_FAILED");
    }
    let job = unsafe { OwnedHandle::from_raw_handle(raw) };
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if unsafe {
        SetInformationJobObject(
            raw,
            JobObjectExtendedLimitInformation,
            (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
            std::mem::size_of_val(&limits) as u32,
        ) == 0
            || AssignProcessToJobObject(raw, child.as_raw_handle()) == 0
    } {
        return Err("GATEWAY_JOB_ASSIGN_FAILED");
    }
    Ok(job)
}
impl Drop for GatewayChild {
    fn drop(&mut self) {
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut child) = slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unverified_paths_and_is_idempotent_on_stop() {
        let host = GatewayChild::default();
        assert_eq!(
            host.spawn(Path::new("node"), Path::new("gateway.mjs")),
            Err("GATEWAY_EXECUTABLE_UNVERIFIED")
        );
        assert_eq!(host.pid(), Ok(None));
        assert!(matches!(host.take_stdio(), Err("GATEWAY_NOT_RUNNING")));
        assert_eq!(host.stop(), Ok(()));
        assert_eq!(host.stop(), Ok(()));
    }
}
