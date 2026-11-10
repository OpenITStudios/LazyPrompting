// Pure native admission contract. No process launch, browser navigation or credentials.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase { Unbound, Admitted, Starting, Running, Suspending, Suspended, Resuming, Stopping, Stopped, RecoveryRequired }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Evidence { ProviderApproved, ProcessStarted, ProcessObserved, SuspendObserved, ResumeObserved, ProcessExited, FailureObserved }
#[derive(Clone, Debug)]
pub struct BrowserInstance {
    pub workspace_id: String,
    pub phase: Phase,
    pub provider_id: Option<String>,
    pub process_identity: Option<String>,
}
impl BrowserInstance {
    pub fn new(workspace_id: String) -> Self { Self { workspace_id, phase: Phase::Unbound, provider_id: None, process_identity: None } }
    pub fn transition(&mut self, next: Phase, evidence: Evidence, provider: Option<&str>, process: Option<&str>) -> Result<(), &'static str> {
        use Evidence::*;
        use Phase::*;
        let allowed = matches!(
            (self.phase, next, evidence),
            (Unbound, Admitted, ProviderApproved) |
            (Admitted, Starting, ProviderApproved) |
            (Starting, Running, ProcessStarted) |
            (Running, Suspending, ProviderApproved) |
            (Suspending, Suspended, SuspendObserved) |
            (Suspended, Resuming, ProviderApproved) |
            (Resuming, Running, ResumeObserved) |
            (Running, Stopping, ProviderApproved) |
            (Suspended, Stopping, ProviderApproved) |
            (Stopping, Stopped, ProcessExited) |
            (Starting, RecoveryRequired, FailureObserved) |
            (Running, RecoveryRequired, FailureObserved) |
            (Suspending, RecoveryRequired, FailureObserved) |
            (Resuming, RecoveryRequired, FailureObserved) |
            (Stopping, RecoveryRequired, FailureObserved)
        );
        if !allowed { return Err("INVALID_BROWSER_TRANSITION"); }
        if next == Admitted {
            let id = provider.ok_or("PROVIDER_REQUIRED")?;
            if id.is_empty() || id.len() > 128 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b,b'_'|b'-'|b':')) { return Err("INVALID_PROVIDER"); }
            self.provider_id = Some(id.to_string());
        }
        if next == Running {
            let id = process.ok_or("PROCESS_EVIDENCE_REQUIRED")?;
            if id.is_empty() || id.len() > 128 { return Err("INVALID_PROCESS_IDENTITY"); }
            if self.phase == Resuming && self.process_identity.as_deref() != Some(id) { return Err("PROCESS_IDENTITY_CHANGED"); }
            self.process_identity = Some(id.to_string());
        }
        if next == Stopped { self.process_identity = None; }
        self.phase = next;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn requires_proof_and_preserves_identity() {
        let mut i=BrowserInstance::new("chat-1".into());
        assert!(i.transition(Phase::Running,Evidence::ProcessStarted,None,Some("p")).is_err());
        i.transition(Phase::Admitted,Evidence::ProviderApproved,Some("local-preview"),None).unwrap();
        i.transition(Phase::Starting,Evidence::ProviderApproved,None,None).unwrap();
        assert!(i.transition(Phase::Running,Evidence::ProcessStarted,None,None).is_err());
        i.transition(Phase::Running,Evidence::ProcessStarted,None,Some("process-1")).unwrap();
        i.transition(Phase::Suspending,Evidence::ProviderApproved,None,None).unwrap();
        i.transition(Phase::Suspended,Evidence::SuspendObserved,None,None).unwrap();
        i.transition(Phase::Resuming,Evidence::ProviderApproved,None,None).unwrap();
        assert!(i.transition(Phase::Running,Evidence::ResumeObserved,None,Some("process-2")).is_err());
    }
}
