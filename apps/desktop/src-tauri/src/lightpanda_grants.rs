// Native-owned, in-memory, one-use scope grants. No renderer command or IPC issuer.
// A grant identifier is NOT authentication: only an authenticated native channel may issue it.
use std::collections::HashMap;
use std::time::{Duration, Instant};
use super::lightpanda_admission::admit_lightpanda_operation;

const MAX_GRANTS: usize = 64;
const MAX_TTL: Duration = Duration::from_secs(30);

#[derive(Clone)]
struct Grant {
    capability: String,
    workspace: String,
    url: Option<String>,
    expires: Instant,
}

#[derive(Default)]
pub(crate) struct LightpandaGrantStore {
    grants: HashMap<String, Grant>,
    stopped: bool,
}

impl LightpandaGrantStore {
    // Generate opaque 256-bit IDs using the OS CSPRNG. No caller-chosen IDs on this path.
    pub(crate) fn issue_secure(
        &mut self,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
        ttl: Duration,
        operator_approved: bool,
        transport_verified: bool,
        compliance_verified: bool,
    ) -> Option<String> {
        let mut random=[0u8;32];
        if getrandom::getrandom(&mut random).is_err() {return None;}
        let mut id=String::with_capacity(64);
        for byte in random {use std::fmt::Write;let _=write!(&mut id,"{byte:02x}");}
        if self.issue(id.clone(),capability,workspace,url,ttl,operator_approved,transport_verified,compliance_verified) {Some(id)} else {None}
    }
    pub(crate) fn issue(
        &mut self,
        id: String,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
        ttl: Duration,
        operator_approved: bool,
        transport_verified: bool,
        compliance_verified: bool,
    ) -> bool {
        if self.stopped || id.is_empty() || id.len()>128 || ttl.is_zero() || ttl>MAX_TTL ||
            self.grants.len()>=MAX_GRANTS || self.grants.contains_key(&id) ||
            !admit_lightpanda_operation(capability,workspace,url,operator_approved,transport_verified,compliance_verified,self.stopped) {
            return false;
        }
        self.grants.insert(id, Grant {
            capability:capability.into(),
            workspace:workspace.into(),
            url:url.map(str::to_owned),
            expires:Instant::now()+ttl,
        });
        true
    }

    // Single-use even on mismatch. Prevent replay and scope probing.
    pub(crate) fn consume(&mut self,id:&str,capability:&str,workspace:&str,url:Option<&str>) -> bool {
        if self.stopped {return false;}
        let Some(grant)=self.grants.remove(id) else {return false};
        Instant::now()<grant.expires &&
        grant.capability==capability && grant.workspace==workspace && grant.url.as_deref()==url
    }
    pub(crate) fn revoke(&mut self,id:&str) -> bool {self.grants.remove(id).is_some()}
    pub(crate) fn stop(&mut self) {self.stopped=true;self.grants.clear();}
}
#[cfg(test)]
mod tests {
    use super::*;
    const URL:&str="http://127.0.0.1:1425/browser-preview.html";
    fn issue(store:&mut LightpandaGrantStore,id:&str,ttl:Duration)->bool {
        store.issue(id.into(),"lightpanda.open","workspace-01",Some(URL),ttl,true,true,true)
    }
    #[test] fn one_use_and_scope_locked() {
        let mut store=LightpandaGrantStore::default();
        assert!(issue(&mut store,"grant-a",Duration::from_secs(5)));
        assert!(!issue(&mut store,"grant-a",Duration::from_secs(5)));
        assert!(!store.consume("grant-a","lightpanda.open","workspace-02",Some(URL)));
        assert!(!store.consume("grant-a","lightpanda.open","workspace-01",Some(URL)));
        assert!(issue(&mut store,"grant-b",Duration::from_secs(5)));
        assert!(store.consume("grant-b","lightpanda.open","workspace-01",Some(URL)));
        assert!(!store.consume("grant-b","lightpanda.open","workspace-01",Some(URL)));
    }
    #[test] fn expires_revokes_and_stops() {
        let mut store=LightpandaGrantStore::default();
        assert!(!issue(&mut store,"zero",Duration::ZERO));
        assert!(!issue(&mut store,"long",Duration::from_secs(31)));
        assert!(issue(&mut store,"short",Duration::from_millis(1)));
        std::thread::sleep(Duration::from_millis(5));
        assert!(!store.consume("short","lightpanda.open","workspace-01",Some(URL)));
        assert!(issue(&mut store,"revoke",Duration::from_secs(5)));
        assert!(store.revoke("revoke"));
        assert!(!store.consume("revoke","lightpanda.open","workspace-01",Some(URL)));
        assert!(issue(&mut store,"stop",Duration::from_secs(5)));
        store.stop();
        assert!(!store.consume("stop","lightpanda.open","workspace-01",Some(URL)));
        assert!(!issue(&mut store,"after",Duration::from_secs(5)));
    }
    #[test] fn os_random_grants_are_unique_and_one_use() {
        let mut store=LightpandaGrantStore::default();
        let a=store.issue_secure("lightpanda.open","workspace-01",Some(URL),Duration::from_secs(5),true,true,true).expect("OS RNG unavailable");
        let b=store.issue_secure("lightpanda.open","workspace-01",Some(URL),Duration::from_secs(5),true,true,true).expect("OS RNG unavailable");
        assert_eq!(a.len(),64);
        assert_ne!(a,b);
        assert!(store.consume(&a,"lightpanda.open","workspace-01",Some(URL)));
        assert!(!store.consume(&a,"lightpanda.open","workspace-01",Some(URL)));
        assert!(store.consume(&b,"lightpanda.open","workspace-01",Some(URL)));
    }
    #[test] fn no_grant_without_native_gates() {
        let mut store=LightpandaGrantStore::default();
        assert!(!store.issue("bad".into(),"lightpanda.open","workspace-01",Some(URL),Duration::from_secs(1),true,false,true));
        assert!(!store.issue("bad".into(),"lightpanda.open","workspace-01",Some(URL),Duration::from_secs(1),false,true,true));
        assert!(!store.issue("bad".into(),"lightpanda.open","workspace-01",Some(URL),Duration::from_secs(1),true,true,false));
    }
}
