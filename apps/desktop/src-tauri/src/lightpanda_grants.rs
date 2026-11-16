// Native-owned, in-memory, one-use scope grants. No renderer command or IPC issuer.
// A grant identifier is NOT authentication: only an authenticated native channel may issue it.
use super::lightpanda_admission::admit_lightpanda_operation;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
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
    // Opaque target HMAC from the native page witness. The backend ID
    // must never be persisted in PromptOutbox.
    target_digest: [u8; 32],
    backend_node_id: u32,
    role: PreviewTargetRole,
    operation: PreviewTargetOperation,
    text_digest: Option<[u8; 32]>,
    reservation_nonce: [u8; 16],
}
impl PreviewTargetScope {
    // The native-only inspected CDP node is the sole source of action scope.
    // Model/public display indexes cannot supply backend IDs or document keys.
    #[cfg(windows)]
    pub(crate) fn from_native_review(
        review: &super::lightpanda_private::ReviewedOfflineTarget,
        operation: PreviewTargetOperation,
        text_digest: Option<[u8; 32]>,
        reservation_nonce: [u8; 16],
    ) -> Result<Self, &'static str> {
        let role = match review.role.as_str() {
            "button" => PreviewTargetRole::Button,
            "checkbox" => PreviewTargetRole::Checkbox,
            "searchbox" => PreviewTargetRole::Searchbox,
            "textbox" => PreviewTargetRole::Textbox,
            _ => return Err("BROWSER_ACTION_UNSAFE_ROLE"),
        };
        let scope = Self {
            workspace: review.workspace.clone(),
            origin: PREVIEW_URL.to_owned(),
            document_epoch: review.document_epoch,
            snapshot_fingerprint: review.snapshot_fingerprint,
            target_digest: review.target_digest,
            backend_node_id: review.backend_node_id,
            role, operation, text_digest, reservation_nonce,
        };
        if scope.eligible() { Ok(scope) } else { Err("BROWSER_ACTION_SCOPE_INVALID") }
    }
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
            && self.target_digest != [0; 32]
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
    // Until a host-owned durable proof and same-document witness are
    // connected, even a locally approved demo action cannot issue a
    // production grant. These functions are retained for negative unit
    // fixtures only; they are excluded from installed binaries.
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

// A private host read checks the EXACT row the canonical PromptOutbox
// persisted before a potential browser effect. A model-provided receipt
// or unsigned nonce alone is never sufficient. The root and file must
// be selected by trusted native owner code, not by Tauri/MCP input.
#[allow(dead_code)]
pub(crate) fn verify_preview_dispatch_reservation_at(
    app_data_root: &Path,
    outbox_file: &Path,
    scope: &PreviewTargetScope,
    action_id: &str,
) -> Result<(), &'static str> {
    if !scope.eligible()
        || action_id.len() != 36
        || !action_id.bytes().enumerate().all(|(i, byte)| {
            if matches!(i, 8 | 13 | 18 | 23) { byte == b'-' }
            else { byte.is_ascii_digit() || matches!(byte, b'a'..=b'f') }
        })
    {
        return Err("BROWSER_ACTION_RESERVATION_INVALID");
    }
    // Refuse symlink leaf files, directory traversal, and files outside
    // the actual app-owned data root. The caller must obtain root from
    // app.path().app_local_data_dir(), never a user-supplied string.
    let metadata = fs::symlink_metadata(outbox_file)
        .map_err(|_| "BROWSER_ACTION_OUTBOX_UNAVAILABLE")?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > 1024 * 1024
    {
        return Err("BROWSER_ACTION_OUTBOX_INVALID");
    }
    let root = fs::canonicalize(app_data_root)
        .map_err(|_| "BROWSER_ACTION_OUTBOX_UNAVAILABLE")?;
    let file = fs::canonicalize(outbox_file)
        .map_err(|_| "BROWSER_ACTION_OUTBOX_UNAVAILABLE")?;
    if !file.starts_with(&root) {
        return Err("BROWSER_ACTION_OUTBOX_INVALID");
    }
    let raw = fs::read(file)
        .map_err(|_| "BROWSER_ACTION_OUTBOX_UNAVAILABLE")?;
    if raw.len() > 1024 * 1024 {
        return Err("BROWSER_ACTION_OUTBOX_INVALID");
    }
    let document: serde_json::Value = serde_json::from_slice(&raw)
        .map_err(|_| "BROWSER_ACTION_OUTBOX_INVALID")?;
    if document["schemaVersion"] != 1
        || !document["items"].is_array()
    {
        return Err("BROWSER_ACTION_OUTBOX_INVALID");
    }
    let rows = document["browserActions"].as_array()
        .ok_or("BROWSER_ACTION_OUTBOX_INVALID")?;
    if rows.len() > 1000 {
        return Err("BROWSER_ACTION_OUTBOX_INVALID");
    }
    let mut action_ids = HashSet::new();
    let mut workspaces = HashSet::new();
    let mut matched = 0usize;
    let fp = encode_hex32(&scope.snapshot_fingerprint);
    let target = encode_hex32(&scope.target_digest);
    let nonce = encode_hex16(&scope.reservation_nonce);
    let digest = scope.text_digest.map(|bytes| encode_hex32(&bytes));
    let operation = match scope.operation {
        PreviewTargetOperation::Click => "CLICK",
        PreviewTargetOperation::TypeText => "TYPE_TEXT",
    };
    for row in rows {
        let Some(obj) = row.as_object() else {
            return Err("BROWSER_ACTION_OUTBOX_INVALID");
        };
        let expected = ["actionId","documentEpoch","operation","origin",
            "reservationNonce","snapshotFingerprint","state",
            "targetDigest","textDigest","workspaceId"];
        if obj.len() != expected.len()
            || expected.iter().any(|key| !obj.contains_key(*key))
        {
            return Err("BROWSER_ACTION_OUTBOX_INVALID");
        }
        let Some(id) = row["actionId"].as_str() else {
            return Err("BROWSER_ACTION_OUTBOX_INVALID");
        };
        let Some(workspace) = row["workspaceId"].as_str() else {
            return Err("BROWSER_ACTION_OUTBOX_INVALID");
        };
        if !action_ids.insert(id) || !workspaces.insert(workspace) {
            return Err("BROWSER_ACTION_OUTBOX_AMBIGUOUS");
        }
        if id != action_id {
            continue;
        }
        // Never approve a still-RESERVED row: seal DISPATCH_PENDING
        // durably BEFORE issuing a one-use action grant.
        if workspace == scope.workspace
            && row["origin"].as_str() == Some(scope.origin.as_str())
            && row["documentEpoch"].as_u64() == Some(scope.document_epoch)
            && row["snapshotFingerprint"].as_str() == Some(fp.as_str())
            && row["targetDigest"].as_str() == Some(target.as_str())
            && row["reservationNonce"].as_str() == Some(nonce.as_str())
            && row["operation"].as_str() == Some(operation)
            && row["textDigest"].as_str() == digest.as_deref()
            && (scope.operation == PreviewTargetOperation::Click
                || digest.is_some())
            && row["state"].as_str() == Some("DISPATCH_PENDING")
        {
            matched += 1;
        }
    }
    if matched == 1 {
        Ok(())
    } else {
        Err("BROWSER_ACTION_DISPATCH_PROOF_MISMATCH")
    }
}
fn encode_hex32(data: &[u8; 32]) -> String {
    data.iter().map(|byte| format!("{byte:02x}")).collect()
}
fn encode_hex16(data: &[u8; 16]) -> String {
    data.iter().map(|byte| format!("{byte:02x}")).collect()
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
            target_digest: [6;32],
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
            PreviewTargetScope { target_digest:[8;32],..baseline.clone() },
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
            PreviewTargetScope {target_digest:[0;32],..base.clone()},
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
    fn persisted_browser_dispatch_must_match_native_target_and_state() {
        let mut random = [0u8; 8];
        getrandom::getrandom(&mut random).expect("test entropy unavailable");
        let root = std::env::temp_dir()
            .join(format!("lazy-browser-proof-{}", random.iter()
                .map(|b| format!("{b:02x}")).collect::<String>()));
        fs::create_dir(&root).unwrap();
        let file = root.join("outbox.json");
        let scope = example_target();
        let action_id = "12345678-1234-1234-1234-123456789abc";
        let exact = serde_json::json!({
            "schemaVersion": 1,
            "items": [],
            "browserActions": [{
                "actionId":action_id,
                "workspaceId":scope.workspace.clone(),
                "origin":scope.origin.clone(),
                "documentEpoch":scope.document_epoch,
                "snapshotFingerprint":encode_hex32(&scope.snapshot_fingerprint),
                "targetDigest":encode_hex32(&scope.target_digest),
                "operation":"CLICK",
                "textDigest":null,
                "reservationNonce":encode_hex16(&scope.reservation_nonce),
                "state":"DISPATCH_PENDING"
            }]
        });
        let write = |value: &serde_json::Value| fs::write(&file,
            serde_json::to_vec(value).unwrap()).unwrap();
        write(&exact);
        assert_eq!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,action_id),Ok(()));
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,"different-action-id").is_err());
        let mut changed = exact.clone();
        changed["browserActions"][0]["state"] = serde_json::json!("RESERVED");
        write(&changed);
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,action_id).is_err());
        changed["browserActions"][0]["state"] = serde_json::json!("RECONCILE_REQUIRED");
        write(&changed);
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,action_id).is_err());
        for (field,value) in [
            ("workspaceId",serde_json::json!("workspace-02")),
            ("documentEpoch",serde_json::json!(5)),
            ("targetDigest",serde_json::json!("f".repeat(64))),
            ("snapshotFingerprint",serde_json::json!("d".repeat(64))),
            ("reservationNonce",serde_json::json!("a".repeat(32))),
            ("operation",serde_json::json!("TYPE_TEXT")),
        ] {
            let mut mismatch = exact.clone();
            mismatch["browserActions"][0][field]=value;
            write(&mismatch);
            assert!(verify_preview_dispatch_reservation_at(
                &root,&file,&scope,action_id).is_err());
        }
        let mut wrong = scope.clone();
        wrong.target_digest = [9; 32];
        write(&exact);
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&wrong,action_id).is_err());
        let mut malformed = exact.clone();
        malformed["browserActions"][0]["approved"] = serde_json::json!(true);
        write(&malformed);
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,action_id).is_err());
        let mut duplicate = exact.clone();
        duplicate["browserActions"].as_array_mut().unwrap()
            .push(exact["browserActions"][0].clone());
        write(&duplicate);
        assert!(verify_preview_dispatch_reservation_at(
            &root,&file,&scope,action_id).is_err());
        let outside_root = root.parent().unwrap()
            .join(format!("browser-outside-{}", random.iter()
                .map(|b| format!("{b:02x}")).collect::<String>()));
        fs::write(&outside_root,serde_json::to_vec(&exact).unwrap()).unwrap();
        assert!(verify_preview_dispatch_reservation_at(
            &root,&outside_root,&scope,action_id).is_err());
        fs::remove_file(&outside_root).unwrap();
        fs::remove_dir_all(root).unwrap();
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
