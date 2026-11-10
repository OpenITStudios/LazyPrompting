// Gate A foundation: native-owned gateway process lifecycle.
// Deliberately not registered as a Tauri command. No automatic startup or browser authority.
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[derive(Default)]
pub(crate) struct GatewayChild {
    child: Mutex<Option<Child>>,
}

impl GatewayChild {
    // The caller must resolve and verify a packaged executable path before calling spawn.
    // This method never accepts shell commands, user arguments or renderer-supplied paths.
    pub(crate) fn spawn(&self, executable: &Path) -> Result<u32, &'static str> {
        if !executable.is_absolute() || !executable.is_file() {
            return Err("GATEWAY_EXECUTABLE_UNVERIFIED");
        }
        let mut slot=self.child.lock().map_err(|_|"GATEWAY_LOCK_POISONED")?;
        if let Some(child)=slot.as_mut() {
            match child.try_wait() {
                Ok(None)=>return Err("GATEWAY_ALREADY_RUNNING"),
                Ok(Some(_))=>{*slot=None;},
                Err(_)=>return Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
            }
        }
        let child=Command::new(executable)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn().map_err(|_|"GATEWAY_SPAWN_FAILED")?;
        let pid=child.id();
        *slot=Some(child);
        Ok(pid)
    }
    pub(crate) fn pid(&self) -> Result<Option<u32>, &'static str> {
        let mut slot=self.child.lock().map_err(|_|"GATEWAY_LOCK_POISONED")?;
        let Some(child)=slot.as_mut() else {return Ok(None)};
        match child.try_wait() {
            Ok(None)=>Ok(Some(child.id())),
            Ok(Some(_))=>{*slot=None;Ok(None)},
            Err(_)=>Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
        }
    }
    pub(crate) fn stop(&self) -> Result<(), &'static str> {
        let mut slot=self.child.lock().map_err(|_|"GATEWAY_LOCK_POISONED")?;
        if let Some(mut child)=slot.take() {
            match child.try_wait() {
                Ok(Some(_))=>return Ok(()),
                Ok(None)=>{},
                Err(_)=>return Err("GATEWAY_PROCESS_STATE_UNKNOWN"),
            }
            child.kill().map_err(|_|"GATEWAY_STOP_FAILED")?;
            child.wait().map_err(|_|"GATEWAY_REAP_FAILED")?;
        }
        Ok(())
    }
}
impl Drop for GatewayChild {
    fn drop(&mut self) {
        if let Ok(mut slot)=self.child.lock() {
            if let Some(mut child)=slot.take() {
                let _=child.kill();
                let _=child.wait();
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unverified_paths_and_is_idempotent_on_stop() {
        let host=GatewayChild::default();
        assert_eq!(host.spawn(Path::new("node")),Err("GATEWAY_EXECUTABLE_UNVERIFIED"));
        assert_eq!(host.pid(),Ok(None));
        assert_eq!(host.stop(),Ok(()));
        assert_eq!(host.stop(),Ok(()));
    }
}
