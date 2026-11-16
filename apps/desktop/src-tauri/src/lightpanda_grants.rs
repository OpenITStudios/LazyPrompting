// Native-owned, in-memory, one-use scope grants. No renderer command or IPC issuer.
// A grant identifier is NOT authentication: only an authenticated native channel may issue it.
use super::lightpanda_admission::admit_lightpanda_operation;
use std::collections::HashMap;
use std::time::{Duration, Instant};

const MAX_GRANTS: usize = 64;
const MAX_TTL: Duration = Duration::from_secs(30);
// Target grants are more restrictive than ordinary metadata/read grants.
const MAX_TARGET_TTL: Duration = Duration::from_secs(8);
const PREVIEW_URL: &str = "http://127.0.0.1:1425/browser-preview.html";

// This is the ONE native grant store. A target action is never authorized
// by a model index or a renderer-supplied "approved" flag. No production
// constructor or action-dispatch caller is wired until native review and
// durable reservation are proven by the existing owners.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PreviewTargetRole {
    Button,
    Checkbox,
    Searchbox,
    Textbox,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PreviewTargetOperation {
    Click,
    TypeText,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PreviewTargetScope {
    workspace: String,
    origin: String,
    document_epoch: u64,
    snapshot_fingerprint: [u8; 32],
    backend_node_id: u32,
    role: PreviewTargetRole,
    operation: PreviewTargetOperation,
    text_digest: Option<[u8; 32]>,
    reservation_nonce: [u8; 16],
}
impl PreviewTargetScope {
    fn eligible(&self) -> bool {
        let matching_operation = match (&self.operation, &self.role, &self.text_digest) {
            (PreviewTargetOperation::Click,
                PreviewTargetRole::Button | PreviewTargetRole::Checkbox, None) => true,
            (PreviewTargetOperation::TypeText,
                PreviewTargetRole::Searchbox | PreviewTargetRole::Textbox, Some(digest))
                => *digest != [0; 32],
            _ => false,
        };
        super::lightpanda_admission::workspace_allowed(&self.workspace)
            && self.origin == PREVIEW_URL
            && self.document_epoch != 0
            && (1..=i32::MAX as u32).contains(&self.backend_node_id)
            && self.snapshot_fingerprint != [0; 32]
            && self.reservation_nonce != [0; 16]
            && matching_operation
    }
}

#[derive(Clone)]
struct Grant {
    capability: String,
    workspace: String,
    url: Option<String>,
    expires: Instant,
    // None = original Open/Snapshot/Close grant. Some = exact target
    // binding with its own one-use consumption path; never interchangeable.
    target: Option<PreviewTargetScope>,
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
        let mut random = [0u8; 32];
        if getrandom::getrandom(&mut random).is_err() {
            return None;
        }
        let mut id = String::with_capacity(64);
        for byte in random {
            use std::fmt::Write;
            let _ = write!(&mut id, "{byte:02x}");
        }
        if self.issue(
            id.clone(),
            capability,
            workspace,
            url,
            ttl,
            operator_approved,
            transport_verified,
            compliance_verified,
        ) {
            Some(id)
        } else {
            None
        }
    }
    fn issue(
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
        if self.stopped
            || id.is_empty()
            || id.len() > 128
            || ttl.is_zero()
            || ttl > MAX_TTL
            || self.grants.len() >= MAX_GRANTS
            || self.grants.contains_key(&id)
            || !admit_lightpanda_operation(
                capability,
                workspace,
                url,
                operator_approved,
                transport_verified,
                compliance_verified,
                self.stopped,
            )
        {
            return false;
        }
        self.grants.insert(
            id,
            Grant {
                capability: capability.into(),
                workspace: workspace.into(),
                url: url.map(str::to_owned),
                expires: Instant::now() + ttl,
                target: None,
            },
        );
        true
    }

    // Single-use even on mismatch. Prevent replay and scope probing.
    pub(crate) fn consume(
        &mut self,
        id: &str,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
    ) -> bool {
        if self.stopped {
            return false;
        }
        let Some(grant) = self.grants.remove(id) else {
            return false;
        };
        Instant::now() < grant.expires
            && grant.target.is_none()
            && grant.capability == capability
            && grant.workspace == workspace
            && grant.url.as_deref() == url
    }
    // Source-only B2 contract. No production caller can construct
    // PreviewTargetScope yet. Later native review must create the exact
    // scope, and the canonical durable outbox must issue reservation_nonce
    // BEFORE this grant is ever connected to a mutating CDP operation.
    #[allow(dead_code)]
    pub(crate) fn issue_reviewed_target(
        &mut self,
        scope: PreviewTargetScope,
        ttl: Duration,
        operator_approved: bool,
        transport_verified: bool,
        compliance_verified: bool,
    ) -> Option<String> {
        if self.stopped || !scope.eligible() || ttl.is_zero()
            || ttl > MAX_TARGET_TTL || !operator_approved
            || !transport_verified || !compliance_verified
            || self.grants.len() >= MAX_GRANTS
        {
            return None;
        }
        let mut random = [0u8; 32];
        getrandom::getrandom(&mut random).ok()?;
        let mut id = String::with_capacity(64);
        for byte in random {
            use std::fmt::Write;
            let _ = write!(&mut id, "{byte:02x}");
        }
        if self.grants.contains_key(&id) {
            return None;
        }
        self.grants.insert(id.clone(), Grant {
            capability: "lightpanda.preview.target".into(),
            workspace: scope.workspace.clone(),
            url: Some(scope.origin.clone()),
            expires: Instant::now() + ttl,
            target: Some(scope),
        });
        Some(id)
    }

    // Consume BEFORE any possible effect, including when the supplied
    // scope is stale or foreign. An ambiguous outcome cannot be replayed.
    #[allow(dead_code)]
    pub(crate) fn consume_reviewed_target(
        &mut self, id: &str, expected: &PreviewTargetScope,
    ) -> bool {
        if self.stopped {
            return false;
        }
        let Some(grant) = self.grants.remove(id) else {
            return false;
        };
        Instant::now() < grant.expires
            && grant.capability == "lightpanda.preview.target"
            && grant.workspace == expected.workspace
            && grant.url.as_deref() == Some(expected.origin.as_str())
            && grant.target.as_ref() == Some(expected)
            && expected.eligible()
    }
    pub(crate) fn revoke(&mut self, id: &str) -> bool {
        self.grants.remove(id).is_some()
    }
    pub(crate) fn stop(&mut self) {
        self.stopped = true;
        self.grants.clear();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    const URL: &str = "http://127.0.0.1:1425/browser-preview.html";
    fn issue(store: &mut LightpandaGrantStore, id: &str, ttl: Duration) -> bool {
        store.issue(
            id.into(),
            "lightpanda.open",
            "workspace-01",
            Some(URL),
            ttl,
            true,
            true,
            true,
        )
    }
    #[test]
    fn one_use_and_scope_locked() {
        let mut store = LightpandaGrantStore::default();
        assert!(issue(&mut store, "grant-a", Duration::from_secs(5)));
        assert!(!issue(&mut store, "grant-a", Duration::from_secs(5)));
        assert!(!store.consume("grant-a", "lightpanda.open", "workspace-02", Some(URL)));
        assert!(!store.consume("grant-a", "lightpanda.open", "workspace-01", Some(URL)));
        assert!(issue(&mut store, "grant-b", Duration::from_secs(5)));
        assert!(store.consume("grant-b", "lightpanda.open", "workspace-01", Some(URL)));
        assert!(!store.consume("grant-b", "lightpanda.open", "workspace-01", Some(URL)));
    }
    #[test]
    fn indexed_read_grant_cannot_be_used_for_metadata_or_replayed() {
        let mut store=LightpandaGrantStore::default();
        let read=store.issue_secure(
            "lightpanda.snapshot.index", "workspace-01", None,
            Duration::from_secs(5), true, true, true
        ).expect("test OS entropy unavailable");
        // Mismatched operation consumes the one-use authorization.
        assert!(!store.consume(&read,"lightpanda.snapshot","workspace-01",None));
        assert!(!store.consume(&read,"lightpanda.snapshot.index","workspace-01",None));
        let granted=store.issue_secure(
            "lightpanda.snapshot.index", "workspace-01", None,
            Duration::from_secs(5), true, true, true
        ).expect("test OS entropy unavailable");
        assert!(!store.consume(&granted,"lightpanda.snapshot.index","workspace-02",None));
        assert!(!store.consume(&granted,"lightpanda.snapshot.index","workspace-01",None));
        let valid=store.issue_secure(
            "lightpanda.snapshot.index", "workspace-01", None,
            Duration::from_secs(5), true, true, true
        ).expect("test OS entropy unavailable");
        assert!(store.consume(&valid,"lightpanda.snapshot.index","workspace-01",None));
        assert!(!store.consume(&valid,"lightpanda.snapshot.index","workspace-01",None));
        assert!(store.issue_secure(
            "lightpanda.review","workspace-01",None,
            Duration::from_secs(5),true,true,true
        ).is_none());
    }
    #[test]
    fn expires_revokes_and_stops() {
        let mut store = LightpandaGrantStore::default();
        assert!(!issue(&mut store, "zero", Duration::ZERO));
        assert!(!issue(&mut store, "long", Duration::from_secs(31)));
        assert!(issue(&mut store, "short", Duration::from_millis(1)));
        std::thread::sleep(Duration::from_millis(5));
        assert!(!store.consume("short", "lightpanda.open", "workspace-01", Some(URL)));
        assert!(issue(&mut store, "revoke", Duration::from_secs(5)));
        assert!(store.revoke("revoke"));
        assert!(!store.consume("revoke", "lightpanda.open", "workspace-01", Some(URL)));
        assert!(issue(&mut store, "stop", Duration::from_secs(5)));
        store.stop();
        assert!(!store.consume("stop", "lightpanda.open", "workspace-01", Some(URL)));
        assert!(!issue(&mut store, "after", Duration::from_secs(5)));
    }
    fn example_target() -> PreviewTargetScope {
        PreviewTargetScope {
            workspace: "workspace-01".to_owned(),
            origin: PREVIEW_URL.to_owned(),
            document_epoch: 4,
            snapshot_fingerprint: [5;32],
            backend_node_id: 17,
            role: PreviewTargetRole::Button,
            operation: PreviewTargetOperation::Click,
            text_digest: None,
            reservation_nonce: [7;16],
        }
    }
    #[test]
    fn target_action_binding_denies_substitution_and_replay() {
        let mut store = LightpandaGrantStore::default();
        let baseline=example_target();
        let read=store.issue_secure(
            "lightpanda.snapshot.index","workspace-01",None,
            Duration::from_secs(3),true,true,true
        ).expect("OS RNG unavailable");
        assert!(!store.consume_reviewed_target(&read,&baseline));
        assert!(!store.consume(&read,"lightpanda.snapshot.index","workspace-01",None));
        let id=store.issue_reviewed_target(
            baseline.clone(),Duration::from_secs(3),true,true,true
        ).expect("OS RNG unavailable");
        assert!(!store.consume(&id,"lightpanda.snapshot.index","workspace-01",None));
        assert!(!store.consume_reviewed_target(&id,&baseline));
        for modified in [
            PreviewTargetScope { workspace:"workspace-02".into(),..baseline.clone() },
            PreviewTargetScope { document_epoch:5,..baseline.clone() },
            PreviewTargetScope { backend_node_id:18,..baseline.clone() },
            PreviewTargetScope { snapshot_fingerprint:[8;32],..baseline.clone() },
            PreviewTargetScope { reservation_nonce:[9;16],..baseline.clone() },
            PreviewTargetScope { role:PreviewTargetRole::Checkbox,..baseline.clone() },
            PreviewTargetScope { operation:PreviewTargetOperation::TypeText,..baseline.clone() },
        ] {
            // Each mismatch gets a distinct grant: one failed attempt
            // consumes it, never leaving a reusable authorization.
            let id=store.issue_reviewed_target(
                baseline.clone(),Duration::from_secs(3),true,true,true
            ).unwrap();
            assert!(!store.consume_reviewed_target(&id,&modified));
            assert!(!store.consume_reviewed_target(&id,&baseline));
        }
        let id=store.issue_reviewed_target(
            baseline.clone(),Duration::from_secs(3),true,true,true
        ).unwrap();
        assert!(store.consume_reviewed_target(&id,&baseline));
        assert!(!store.consume_reviewed_target(&id,&baseline));
    }
    #[test]
    fn target_action_scope_requires_native_review_and_reservation_material() {
        let base=example_target();
        let mut store=LightpandaGrantStore::default();
        for invalid in [
            PreviewTargetScope {workspace:"workspace-11".into(),..base.clone()},
            PreviewTargetScope {origin:"https://example.org".into(),..base.clone()},
            PreviewTargetScope {document_epoch:0,..base.clone()},
            PreviewTargetScope {backend_node_id:0,..base.clone()},
            PreviewTargetScope {backend_node_id:u32::MAX,..base.clone()},
            PreviewTargetScope {snapshot_fingerprint:[0;32],..base.clone()},
            PreviewTargetScope {reservation_nonce:[0;16],..base.clone()},
            PreviewTargetScope {text_digest:Some([1;32]),..base.clone()},
            PreviewTargetScope {operation:PreviewTargetOperation::TypeText,..base.clone()},
        ] {
            assert!(!invalid.eligible());
            assert!(store.issue_reviewed_target(invalid,
                Duration::from_secs(3),true,true,true).is_none());
        }
        let fill=PreviewTargetScope{
            role:PreviewTargetRole::Searchbox,operation:PreviewTargetOperation::TypeText,
            text_digest:Some([3;32]),..base.clone()
        };
        assert!(fill.eligible());
        assert!(store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(3),false,true,true).is_none());
        assert!(store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(3),true,false,true).is_none());
        assert!(store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(3),true,true,false).is_none());
        assert!(store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(9),true,true,true).is_none());
        let id=store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(1),true,true,true).unwrap();
        let changed_value = PreviewTargetScope {
            text_digest:Some([4;32]), ..fill.clone()
        };
        assert!(!store.consume_reviewed_target(&id,&changed_value));
        assert!(!store.consume_reviewed_target(&id,&fill));
        let id=store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(1),true,true,true).unwrap();
        assert!(store.consume_reviewed_target(&id,&fill));
        let id=store.issue_reviewed_target(fill.clone(),
            Duration::from_millis(1),true,true,true).unwrap();
        std::thread::sleep(Duration::from_millis(5));
        assert!(!store.consume_reviewed_target(&id,&fill));
        let id=store.issue_reviewed_target(fill.clone(),
            Duration::from_secs(1),true,true,true).unwrap();
        store.stop();
        assert!(!store.consume_reviewed_target(&id,&fill));
        assert!(store.issue_reviewed_target(fill,
            Duration::from_secs(1),true,true,true).is_none());
    }
    #[test]
    fn os_random_grants_are_unique_and_one_use() {
        let mut store = LightpandaGrantStore::default();
        let a = store
            .issue_secure(
                "lightpanda.open",
                "workspace-01",
                Some(URL),
                Duration::from_secs(5),
                true,
                true,
                true,
            )
            .expect("OS RNG unavailable");
        let b = store
            .issue_secure(
                "lightpanda.open",
                "workspace-01",
                Some(URL),
                Duration::from_secs(5),
                true,
                true,
                true,
            )
            .expect("OS RNG unavailable");
        assert_eq!(a.len(), 64);
        assert_ne!(a, b);
        assert!(store.consume(&a, "lightpanda.open", "workspace-01", Some(URL)));
        assert!(!store.consume(&a, "lightpanda.open", "workspace-01", Some(URL)));
        assert!(store.consume(&b, "lightpanda.open", "workspace-01", Some(URL)));
    }
    #[test]
    fn no_grant_without_native_gates() {
        let mut store = LightpandaGrantStore::default();
        assert!(!store.issue(
            "bad".into(),
            "lightpanda.open",
            "workspace-01",
            Some(URL),
            Duration::from_secs(1),
            true,
            false,
            true
        ));
        assert!(!store.issue(
            "bad".into(),
            "lightpanda.open",
            "workspace-01",
            Some(URL),
            Duration::from_secs(1),
            false,
            true,
            true
        ));
        assert!(!store.issue(
            "bad".into(),
            "lightpanda.open",
            "workspace-01",
            Some(URL),
            Duration::from_secs(1),
            true,
            true,
            false
        ));
    }
}
