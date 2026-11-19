// One host-owned, read-only WebView2 accessibility observation for desktop,
// CLI and MCP. No second browser, daemon, relay, model or permission owner.
// Accessibility labels are untrusted and may still contain personal data.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    net::IpAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{Manager, Webview};

const GRANT_TTL: Duration = Duration::from_secs(60);
const MAX_RAW_UNITS: usize = 128_000;
const MAX_LINES: usize = 36;
const MAX_OUTPUT_BYTES: usize = 4096;
const MAX_LABEL_CHARS: usize = 96;

#[derive(Default)]
pub(crate) struct BrowserObservation {
    state: Mutex<ObservationState>,
}
#[derive(Default)]
struct ObservationState {
    grants: BTreeMap<String, Grant>,
    previous: BTreeMap<String, Previous>,
    document_epochs: BTreeMap<String, u64>,
    loading: BTreeMap<String, bool>,
    revisions: BTreeMap<String, u64>,
}
struct Grant {
    label: String,
    url: String,
    recipient: &'static str,
    created: Instant,
    document_epoch: u64,
    revision: u64,
}
struct Previous {
    label: String,
    url: String,
    document_epoch: u64,
    lines: Vec<String>,
}
struct Capture {
    revision: u64,
    document_epoch: u64,
}

fn next_revision(map: &mut BTreeMap<String, u64>, key: &str) -> Result<u64, String> {
    let value = map.entry(key.into()).or_default();
    *value = value
        .checked_add(1)
        .ok_or("OBSERVATION_REVISION_OVERFLOW")?;
    Ok(*value)
}
fn recipient(value: &str) -> Result<&'static str, String> {
    match value {
        "desktop" => Ok("desktop"),
        "mcp" => Ok("mcp"),
        _ => Err("OBSERVATION_RECIPIENT_INVALID".into()),
    }
}
fn safe_origin(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "https"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.as_str().len() > 2048
    {
        return None;
    }
    let host = url.host_str()?.trim_end_matches('.').to_ascii_lowercase();
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    if host.is_empty()
        || bare.parse::<IpAddr>().is_ok()
        || host == "localhost"
        || [".localhost", ".local", ".lan", ".internal", ".onion"]
            .iter()
            .any(|suffix| host.ends_with(suffix))
        || host == "chatgpt.com"
        || host.ends_with(".chatgpt.com")
        || host == "openai.com"
        || host.ends_with(".openai.com")
    {
        return None;
    }
    // A public hostname can still DNS-rebind. This is an observation admission
    // rule, not a network/egress sandbox or permission to capture private data.
    Some(url.origin().ascii_serialization())
}
// A page key binds consent to the exact URL and document generation.
// It is not proof of user identity, network isolation or authenticated login.
fn page_fingerprint(label: &str, url: &str, epoch: u64) -> String {
    let mut hasher = Sha256::new();
    for value in [label, url] {
        hasher.update((value.len() as u64).to_le_bytes());
        hasher.update(value.as_bytes());
    }
    hasher.update(epoch.to_le_bytes());
    format!("{:x}", hasher.finalize())
}
fn validate_mode(mode: &str) -> Result<(), String> {
    if matches!(mode, "compact" | "delta") {
        Ok(())
    } else {
        Err("OBSERVATION_INVALID_MODE".into())
    }
}
fn tab_id(label: &str) -> String {
    label
        .strip_prefix(&format!("{}-tab-", label.get(..10).unwrap_or("")))
        .map(|n| format!("tab-{n}"))
        .unwrap_or_else(|| "main".into())
}
impl BrowserObservation {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, ObservationState>, String> {
        self.state.lock().map_err(|_| "OBSERVATION_BUSY".into())
    }
    fn fingerprint(&self, label: &str, url: &str) -> Result<String, String> {
        let state = self.lock()?;
        if state.loading.get(label) != Some(&false) {
            return Err("OBSERVATION_PAGE_STILL_LOADING".into());
        }
        Ok(page_fingerprint(
            label,
            url,
            state.document_epochs.get(label).copied().unwrap_or(0),
        ))
    }
    fn arm(
        &self,
        workspace: &str,
        label: String,
        url: String,
        target: &str,
        expected_fingerprint: &str,
    ) -> Result<(), String> {
        crate::embedded_webview::label_for(workspace)?;
        let target = recipient(target)?;
        let mut state = self.lock()?;
        let document_epoch = *state.document_epochs.get(&label).unwrap_or(&0);
        if state.loading.get(&label) != Some(&false) {
            return Err("OBSERVATION_PAGE_STILL_LOADING".into());
        }
        // Validate the operator's exact page token under this same lock as the
        // grant insertion. A reload cannot replace the document between checks.
        if page_fingerprint(&label, &url, document_epoch) != expected_fingerprint {
            return Err("OBSERVATION_PAGE_CHANGED".into());
        }
        let revision = next_revision(&mut state.revisions, workspace)?;
        state.grants.insert(
            workspace.into(),
            Grant {
                label,
                url,
                recipient: target,
                created: Instant::now(),
                document_epoch,
                revision,
            },
        );
        Ok(())
    }
    fn check_grant(
        state: &ObservationState,
        workspace: &str,
        label: &str,
        url: &str,
        target: &str,
    ) -> Result<(), String> {
        let grant = state
            .grants
            .get(workspace)
            .ok_or("OBSERVATION_APPROVAL_REQUIRED")?;
        if grant.recipient != target {
            return Err("OBSERVATION_WRONG_RECIPIENT".into());
        }
        if grant.created.elapsed() > GRANT_TTL
            || grant.label != label
            || grant.url != url
            || state.loading.get(label) != Some(&false)
            || state.document_epochs.get(label).copied().unwrap_or(0) != grant.document_epoch
            || state.revisions.get(workspace).copied().unwrap_or(0) != grant.revision
        {
            return Err("OBSERVATION_APPROVAL_EXPIRED_OR_CHANGED".into());
        }
        Ok(())
    }
    fn preflight(
        &self,
        workspace: &str,
        label: &str,
        url: &str,
        target: &str,
    ) -> Result<(), String> {
        let state = self.lock()?;
        Self::check_grant(&state, workspace, label, url, target)
    }
    fn take(
        &self,
        workspace: &str,
        label: &str,
        url: &str,
        target: &str,
    ) -> Result<Capture, String> {
        let mut state = self.lock()?;
        if let Err(reason) = Self::check_grant(&state, workspace, label, url, target) {
            if reason != "OBSERVATION_WRONG_RECIPIENT" {
                state.grants.remove(workspace);
            }
            return Err(reason);
        }
        let grant = state
            .grants
            .remove(workspace)
            .ok_or("OBSERVATION_APPROVAL_REQUIRED")?;
        Ok(Capture {
            revision: grant.revision,
            document_epoch: grant.document_epoch,
        })
    }
    pub(crate) fn invalidate_tab(&self, workspace: &str, label: &str) {
        if let Ok(mut state) = self.lock() {
            let _ = next_revision(&mut state.document_epochs, label);
            let _ = next_revision(&mut state.revisions, workspace);
            state.loading.insert(label.into(), true);
            if state
                .grants
                .get(workspace)
                .is_some_and(|g| g.label == label)
            {
                state.grants.remove(workspace);
            }
            if state
                .previous
                .get(workspace)
                .is_some_and(|p| p.label == label)
            {
                state.previous.remove(workspace);
            }
        }
    }
    pub(crate) fn mark_load_finished(&self, label: &str) {
        if let Ok(mut state) = self.lock() {
            if state.loading.get(label) == Some(&true) {
                state.loading.insert(label.into(), false);
            }
        }
    }
    pub(crate) fn clear_tab(&self, workspace: &str, label: &str) {
        self.invalidate_tab(workspace, label);
    }
    pub(crate) fn cancel_grant(&self, workspace: &str) {
        if let Ok(mut state) = self.lock() {
            let _ = next_revision(&mut state.revisions, workspace);
            state.grants.remove(workspace);
            state.previous.remove(workspace);
        }
    }
    pub(crate) fn clear_workspace(&self, workspace: &str) {
        if let Ok(mut state) = self.lock() {
            let _ = next_revision(&mut state.revisions, workspace);
            state.grants.remove(workspace);
            state.previous.remove(workspace);
            // The revision is intentionally retained for any in-flight capture.
            if let Ok(base) = crate::embedded_webview::label_for(workspace) {
                state
                    .document_epochs
                    .retain(|label, _| !label.starts_with(&base));
                state.loading.retain(|label, _| !label.starts_with(&base));
            }
        }
    }
    fn status(&self, workspace: &str, eligible: Option<(String, String)>) -> Result<Value, String> {
        crate::embedded_webview::label_for(workspace)?;
        let state = self.lock()?;
        let grant = state.grants.get(workspace).filter(|g| {
            g.created.elapsed() <= GRANT_TTL
                && state.loading.get(&g.label) == Some(&false)
                && state.document_epochs.get(&g.label).copied().unwrap_or(0) == g.document_epoch
                && state.revisions.get(workspace).copied().unwrap_or(0) == g.revision
        });
        let (eligible_origin, page_fingerprint) = eligible
            .map(|(origin, key)| (Some(origin), Some(key)))
            .unwrap_or((None, None));
        Ok(json!({
         "workspaceId":workspace,
         "armed":grant.is_some(),
         "tabId":grant.map(|g|tab_id(&g.label)).unwrap_or_default(),
         "recipient":grant.map(|g|g.recipient),
         "eligibleOrigin":eligible_origin,
         "pageFingerprint":page_fingerprint,
         "source":"NATIVE_BROWSER_OBSERVATION",
         "readOnly":true,"nextPromptAllowed":false,
        }))
    }
    fn project(
        &self,
        workspace: &str,
        label: &str,
        url: &str,
        mode: &str,
        lines: Vec<String>,
        capture: &Capture,
    ) -> Result<Value, String> {
        let mut state = self.lock()?;
        if state.revisions.get(workspace).copied().unwrap_or(0) != capture.revision
            || state.document_epochs.get(label).copied().unwrap_or(0) != capture.document_epoch
            || state.loading.get(label) != Some(&false)
        {
            return Err("OBSERVATION_CHANGED_DURING_CAPTURE".into());
        }
        let previous = state.previous.get(workspace);
        let valid = previous.is_some_and(|p| {
            p.label == label && p.url == url && p.document_epoch == capture.document_epoch
        });
        let (effective, changes) = if mode == "delta" && valid {
            // Display indexes are not stable element identity; ignore their order
            // while counting duplicate accessible controls correctly.
            let older = &previous.unwrap().lines;
            let mut unmatched = BTreeMap::<&str, usize>::new();
            for line in older {
                let key = line.split_once(' ').map(|(_, value)| value).unwrap_or(line);
                *unmatched.entry(key).or_default() += 1;
            }
            let mut added = Vec::new();
            for line in &lines {
                let key = line.split_once(' ').map(|(_, value)| value).unwrap_or(line);
                match unmatched.get_mut(key) {
                    Some(n) if *n > 0 => *n -= 1,
                    _ => added.push(format!("+ {line}")),
                }
            }
            let removed: usize = unmatched.values().sum();
            let mut changes = Vec::new();
            if removed > 0 {
                changes.push(format!("(removed {removed} previous controls)"))
            }
            changes.extend(added);
            (
                "delta",
                Some(if changes.is_empty() {
                    vec!["(no observed changes)".into()]
                } else {
                    changes
                }),
            )
        } else {
            ("compact", None)
        };
        // Compact mode borrows the original lines; delta mode owns only
        // changed labels. The full source snapshot is moved into history.
        let output = changes.as_deref().unwrap_or(&lines);
        let mut text = String::new();
        let mut truncated = false;
        for line in output {
            if text.len() + line.len() + 1 > MAX_OUTPUT_BYTES {
                truncated = true;
                break;
            }
            text.push_str(&line);
            text.push('\n');
        }
        let output_bytes = text.len();
        let items = lines.len();
        let truncated = truncated || items >= MAX_LINES;
        state.previous.insert(
            workspace.into(),
            Previous {
                label: label.into(),
                url: url.into(),
                document_epoch: capture.document_epoch,
                lines,
            },
        );
        Ok(json!({"workspaceId":workspace,"tabId":tab_id(label),
         "mode":effective,"content":text,"items":items,
         "outputBytes":output_bytes,"truncated":truncated,
         "treeDepthLimit":12,"untrustedPageContent":true,
         "source":"NATIVE_WEBVIEW2_AX_CDP",
         "status":"OBSERVED_UNVERIFIED_PAGE_CONTENT","readOnly":true,
         "snapshotLocalRefs":false,"displayIndexesOnly":true,
         "nextPromptAllowed":false,"resultVerified":false,
        }))
    }
}
fn current_view(
    app: &tauri::AppHandle,
    workspace: &str,
) -> Result<(String, Webview, tauri::Url), String> {
    let state = app.state::<crate::browser_support_tabs::BrowserSupportTabs>();
    let label = state.active_support_label(workspace)?;
    let view = app.get_webview(&label).ok_or("OBSERVATION_TAB_NOT_FOUND")?;
    let url = view.url().map_err(|_| "OBSERVATION_URL_UNAVAILABLE")?;
    safe_origin(&url).ok_or("OBSERVATION_SITE_NOT_ELIGIBLE")?;
    Ok((label, view, url))
}
fn eligibility(app: &tauri::AppHandle, workspace: &str) -> Option<(String, String)> {
    let (label, _, url) = current_view(app, workspace).ok()?;
    let observation = app.state::<BrowserObservation>();
    let key = observation.fingerprint(&label, url.as_str()).ok()?;
    safe_origin(&url).map(|origin| (origin, key))
}
fn label_text(raw: &str) -> String {
    let clean = raw
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_LABEL_CHARS)
        .collect::<String>();
    let lower = clean.to_ascii_lowercase();
    let digit_count = clean.chars().filter(|c| c.is_ascii_digit()).count();
    // A conservative heuristic, not comprehensive secret detection.
    if digit_count >= 12
        || [
            "api_key",
            "access_token",
            "secret=",
            "bearer ",
            "password:",
            "one-time",
            "otp:",
            "credit card",
            "private key",
        ]
        .iter()
        .any(|word| lower.contains(word))
        || (clean.contains('@') && clean.contains('.'))
    {
        return "[redacted]".into();
    }
    clean.split_whitespace().collect::<Vec<_>>().join(" ")
}
fn compact_ax(payload: &str) -> Result<Vec<String>, String> {
    let root: Value = serde_json::from_str(payload).map_err(|_| "OBSERVATION_CDP_INVALID")?;
    let nodes = root
        .get("nodes")
        .and_then(Value::as_array)
        .ok_or("OBSERVATION_AX_UNAVAILABLE")?;
    let roles = [
        "button",
        "link",
        "textbox",
        "searchbox",
        "checkbox",
        "radio",
        "switch",
        "combobox",
        "option",
        "menuitem",
        "tab",
        "heading",
        "status",
        "alert",
    ];
    let mut lines = Vec::new();
    for node in nodes {
        if node.get("ignored").and_then(Value::as_bool) == Some(true) {
            continue;
        }
        let role = node
            .pointer("/role/value")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !roles.contains(&role) {
            continue;
        }
        let protected = node
            .get("properties")
            .and_then(Value::as_array)
            .is_some_and(|props| {
                props.iter().any(|prop| {
                    prop.get("name").and_then(Value::as_str) == Some("protected")
                        && prop.pointer("/value/value").and_then(Value::as_bool) == Some(true)
                })
            });
        if protected {
            continue;
        }
        // Never copy AX node value, attributes, backendNodeId, DOM, URLs or input content.
        let name = node
            .pointer("/name/value")
            .and_then(Value::as_str)
            .unwrap_or("");
        if name.is_empty() {
            continue;
        }
        let label = label_text(name);
        if label.is_empty() {
            continue;
        }
        lines.push(format!(
            "#{} {} {}",
            lines.len() + 1,
            role,
            serde_json::to_string(&label).map_err(|_| "OBSERVATION_LABEL_INVALID")?
        ));
        if lines.len() >= MAX_LINES {
            break;
        }
    }
    Ok(lines)
}

// Called only by the operator-controlled Tauri main view; never from MCP.
#[tauri::command]
pub(crate) fn browser_observation_arm(
    view: Webview,
    workspace_id: String,
    recipient: String,
    expected_origin: String,
    expected_fingerprint: String,
    state: tauri::State<'_, BrowserObservation>,
) -> Result<Value, String> {
    if view.label() != "main" {
        return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into());
    }
    let (label, _, url) = current_view(view.app_handle(), &workspace_id)?;
    let actual = safe_origin(&url).ok_or("OBSERVATION_SITE_NOT_ELIGIBLE")?;
    if expected_origin != actual {
        return Err("OBSERVATION_SITE_CHANGED".into());
    }
    if state.fingerprint(&label, url.as_str())? != expected_fingerprint {
        return Err("OBSERVATION_PAGE_CHANGED".into());
    }
    state.arm(
        &workspace_id,
        label,
        url.to_string(),
        &recipient,
        &expected_fingerprint,
    )?;
    state.status(&workspace_id, eligibility(view.app_handle(), &workspace_id))
}
#[tauri::command]
pub(crate) fn browser_observation_cancel(
    view: Webview,
    workspace_id: String,
    state: tauri::State<'_, BrowserObservation>,
) -> Result<Value, String> {
    if view.label() != "main" {
        return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into());
    }
    state.cancel_grant(&workspace_id);
    state.status(&workspace_id, eligibility(view.app_handle(), &workspace_id))
}
#[tauri::command]
pub(crate) fn browser_observation_status(
    view: Webview,
    workspace_id: String,
    state: tauri::State<'_, BrowserObservation>,
) -> Result<Value, String> {
    if view.label() != "main" {
        return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into());
    }
    state.status(&workspace_id, eligibility(view.app_handle(), &workspace_id))
}
#[tauri::command]
pub(crate) async fn browser_observe(
    view: Webview,
    workspace_id: String,
    mode: Option<String>,
) -> Result<Value, String> {
    if view.label() != "main" {
        return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into());
    }
    observe(
        view.app_handle(),
        &workspace_id,
        mode.as_deref().unwrap_or("compact"),
        "desktop",
    )
    .await
}
// The installed trusted native MCP pipe uses this same owner, not a second adapter.
pub(crate) fn preflight(app: &tauri::AppHandle, workspace: &str) -> Result<(), String> {
    let (label, _, url) = current_view(app, workspace)?;
    app.state::<BrowserObservation>()
        .preflight(workspace, &label, url.as_str(), "mcp")
}
pub(crate) async fn observe(
    app: &tauri::AppHandle,
    workspace: &str,
    mode: &str,
    target: &str,
) -> Result<Value, String> {
    validate_mode(mode)?;
    recipient(target)?;
    let (label, view, address) = current_view(app, workspace)?;
    let url = address.to_string();
    let state = app.state::<BrowserObservation>();
    // One-shot authorization is consumed BEFORE any CDP call, including errors.
    let capture = state.take(workspace, &label, &url, target)?;
    let raw = read_ax_tree(&view).await?;
    // Detect same-URL reload, navigation, tab replacement, approval revocation,
    // and changes in owner identity; never reveal stale observations.
    if current_view(app, workspace)
        .map(|(active, _, now)| active == label && now.as_str() == url)
        .unwrap_or(false)
        == false
    {
        return Err("OBSERVATION_TAB_CHANGED".into());
    }
    let lines = compact_ax(&raw)?;
    state.project(workspace, &label, &url, mode, lines, &capture)
}
async fn read_ax_tree(view: &Webview) -> Result<String, String> {
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows_core::PCWSTR;
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    let sender = Arc::new(Mutex::new(Some(tx)));
    let handle = Arc::clone(&sender);
    view.with_webview(move |platform| {
        let operation = (|| -> windows_core::Result<()> {
            unsafe {
                let core = platform.controller().CoreWebView2()?;
                let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |hr, result| {
                        let reply = if !hr.is_ok() {
                            Err("OBSERVATION_CDP_FAILED".into())
                        } else if result.is_empty() {
                            Err("OBSERVATION_CDP_EMPTY".into())
                        } else if result.len() > MAX_RAW_UNITS {
                            Err("OBSERVATION_CDP_TOO_LARGE".into())
                        } else {
                            Ok(result)
                        };
                        if let Ok(mut state) = handle.lock() {
                            if let Some(sender) = state.take() {
                                let _ = sender.send(reply);
                            }
                        }
                        Ok(())
                    },
                ));
                let method: Vec<u16> = "Accessibility.getFullAXTree"
                    .encode_utf16()
                    .chain(std::iter::once(0))
                    .collect();
                let params: Vec<u16> =
                    r#"{"depth":12}"#.encode_utf16().chain(std::iter::once(0)).collect();
                core.CallDevToolsProtocolMethod(
                    PCWSTR(method.as_ptr()),
                    PCWSTR(params.as_ptr()),
                    &callback,
                )?;
                Ok(())
            }
        })();
        if operation.is_err() {
            if let Ok(mut state) = sender.lock() {
                if let Some(tx) = state.take() {
                    let _ = tx.send(Err("OBSERVATION_CDP_DISPATCH_FAILED".into()));
                }
            }
        }
    })
    .map_err(|_| "OBSERVATION_WEBVIEW_UNAVAILABLE")?;
    tokio::time::timeout(Duration::from_secs(3), rx)
        .await
        .map_err(|_| "OBSERVATION_CDP_TIMEOUT")?
        .map_err(|_| "OBSERVATION_CDP_DROPPED")?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn approve(
        gate: &BrowserObservation,
        workspace: &str,
        label: &str,
        url: &str,
        target: &str,
    ) -> Result<(), String> {
        let fingerprint = gate.fingerprint(label, url)?;
        gate.arm(workspace, label.into(), url.into(), target, &fingerprint)
    }
    #[test]
    fn compact_ax_excludes_values_password_fields_and_private_labels() {
        let input = json!({"nodes":[
         {"role":{"value":"button"},"name":{"value":"Open menu"}},
         {"role":{"value":"textbox"},"name":{"value":"Search docs"},
          "value":{"value":"private query"}},
         {"role":{"value":"textbox"},"name":{"value":"Password value"},
          "properties":[{"name":"protected","value":{"value":true}}]},
         {"role":{"value":"button"},"name":{"value":"token@example.com"}},
         {"role":{"value":"generic"},"name":{"value":"private body"}},
         {"role":{"value":"button"},"name":{"value":"Open docs"}}
        ]})
        .to_string();
        let lines = compact_ax(&input).unwrap();
        assert_eq!(lines.len(), 4);
        assert!(lines[0].contains("Open menu"));
        assert!(lines[1].contains("Search docs"));
        assert!(lines[2].contains("[redacted]"));
        assert!(lines[3].contains("Open docs"));
        assert!(!lines.join(" ").contains("private query"));
        assert!(!lines.join(" ").contains("Password value"));
        assert!(!lines.join(" ").contains("token@example.com"));
    }
    #[test]
    fn one_shot_approval_is_recipient_scoped_and_not_stolen() {
        let gate = BrowserObservation::default();
        gate.invalidate_tab("workspace-01", "browser-01-tab-01");
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "mcp",
        )
        .unwrap();
        assert!(gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "desktop"
            )
            .is_err());
        let accepted = gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "mcp",
            )
            .unwrap();
        assert!(gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "mcp"
            )
            .is_err());
        assert_eq!(accepted.document_epoch, 1);
    }
    #[test]
    fn navigation_and_cancel_invalidate_inflight_capture() {
        let gate = BrowserObservation::default();
        gate.invalidate_tab("workspace-01", "browser-01-tab-01");
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        let old = gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "desktop",
            )
            .unwrap();
        gate.invalidate_tab("workspace-01", "browser-01-tab-01");
        assert!(gate
            .project(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "compact",
                vec!["old".into()],
                &old
            )
            .is_err());
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        let fresh = gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "desktop",
            )
            .unwrap();
        gate.cancel_grant("workspace-01");
        assert!(gate
            .project(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "compact",
                vec!["old".into()],
                &fresh
            )
            .is_err());
    }
    #[test]
    fn delta_does_not_replay_removed_page_labels() {
        let gate = BrowserObservation::default();
        let previous = vec!["#1 button \"Old account\"".to_string()];
        let current = vec!["#1 button \"Public docs\"".to_string()];
        gate.invalidate_tab("workspace-01", "browser-01-tab-01");
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        let first = gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "desktop",
            )
            .unwrap();
        gate.project(
            "workspace-01",
            "browser-01-tab-01",
            "https://example.org/",
            "compact",
            previous,
            &first,
        )
        .unwrap();
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        let second = gate
            .take(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "desktop",
            )
            .unwrap();
        let output = gate
            .project(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "delta",
                current,
                &second,
            )
            .unwrap();
        assert!(!output["content"].as_str().unwrap().contains("Old account"));
        assert!(output["content"].as_str().unwrap().contains("removed 1"));
        assert_eq!(output["mode"], "delta");
    }
    #[test]
    fn public_host_admission_rejects_local_and_chatgpt_addresses() {
        for text in [
            "https://127.0.0.1/",
            "https://[::1]/",
            "https://chatgpt.com/c/test",
            "https://sub.openai.com/",
            "https://docs.example.org/?auth=x",
            "https://user:pass@example.org/",
            "http://docs.example.org/",
        ] {
            assert!(
                safe_origin(&tauri::Url::parse(text).unwrap()).is_none(),
                "{text}"
            );
        }
        assert_eq!(
            safe_origin(&tauri::Url::parse("https://docs.example.org/manual").unwrap()),
            Some("https://docs.example.org".into())
        );
    }
    #[test]
    fn page_load_blocks_grant_and_invalidates_same_url_capture() {
        let gate = BrowserObservation::default();
        assert!(approve(
            &gate,
            "workspace-02",
            "browser-02-tab-01".into(),
            "https://example.org/".into(),
            "desktop"
        )
        .is_err());
        gate.invalidate_tab("workspace-02", "browser-02-tab-01");
        gate.mark_load_finished("browser-02-tab-01");
        approve(
            &gate,
            "workspace-02",
            "browser-02-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        let token = gate
            .take(
                "workspace-02",
                "browser-02-tab-01",
                "https://example.org/",
                "desktop",
            )
            .unwrap();
        gate.invalidate_tab("workspace-02", "browser-02-tab-01");
        gate.mark_load_finished("browser-02-tab-01");
        assert!(gate
            .project(
                "workspace-02",
                "browser-02-tab-01",
                "https://example.org/",
                "compact",
                vec!["#1 button \"Old\"".into()],
                &token
            )
            .is_err());
    }

    #[test]
    fn cancelling_grant_does_not_make_loaded_tab_ineligible() {
        let gate = BrowserObservation::default();
        gate.invalidate_tab("workspace-01", "browser-01-tab-01");
        gate.mark_load_finished("browser-01-tab-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "desktop",
        )
        .unwrap();
        gate.cancel_grant("workspace-01");
        approve(
            &gate,
            "workspace-01",
            "browser-01-tab-01".into(),
            "https://example.org/".into(),
            "mcp",
        )
        .unwrap();
        assert!(gate
            .preflight(
                "workspace-01",
                "browser-01-tab-01",
                "https://example.org/",
                "mcp"
            )
            .is_ok());
    }

    #[test]
    fn consent_page_key_changes_with_url_tab_or_epoch() {
        let first = page_fingerprint("browser-01-tab-01", "https://example.org/a", 1);
        assert_eq!(first.len(), 64);
        assert_ne!(
            first,
            page_fingerprint("browser-01-tab-01", "https://example.org/b", 1)
        );
        assert_ne!(
            first,
            page_fingerprint("browser-01-tab-01", "https://example.org/a", 2)
        );
        assert_ne!(
            first,
            page_fingerprint("browser-02-tab-01", "https://example.org/a", 1)
        );
    }

    #[test]
    fn stale_page_fingerprint_cannot_authorize_a_new_document() {
        let gate = BrowserObservation::default();
        let label = "browser-01-tab-01";
        let url = "https://example.org/";
        gate.invalidate_tab("workspace-01", label);
        gate.mark_load_finished(label);
        let prior = gate.fingerprint(label, url).unwrap();
        gate.invalidate_tab("workspace-01", label);
        gate.mark_load_finished(label);
        assert_eq!(
            gate.arm("workspace-01", label.into(), url.into(), "mcp", &prior)
                .unwrap_err(),
            "OBSERVATION_PAGE_CHANGED"
        );
        assert!(gate.status("workspace-01", None).unwrap()["armed"] == false);
        let current = gate.fingerprint(label, url).unwrap();
        gate.arm("workspace-01", label.into(), url.into(), "mcp", &current)
            .unwrap();
        assert!(gate.preflight("workspace-01", label, url, "mcp").is_ok());
    }

    #[test]
    fn semantic_delta_ignores_reorder_and_tracks_duplicate_count() {
        let gate = BrowserObservation::default();
        let workspace = "workspace-01";
        let label = "browser-01-tab-01";
        let url = "https://example.org/";
        gate.invalidate_tab(workspace, label);
        gate.mark_load_finished(label);
        let mut current = vec![
            "#1 button \"Go\"".into(),
            "#2 button \"Go\"".into(),
            "#3 link \"Docs\"".into(),
        ];
        approve(&gate, workspace, label, url, "desktop").unwrap();
        let token = gate.take(workspace, label, url, "desktop").unwrap();
        gate.project(workspace, label, url, "compact", current, &token)
            .unwrap();
        current = vec![
            "#1 link \"Docs\"".into(),
            "#2 button \"Go\"".into(),
            "#3 button \"Go\"".into(),
        ];
        approve(&gate, workspace, label, url, "desktop").unwrap();
        let token = gate.take(workspace, label, url, "desktop").unwrap();
        let same = gate
            .project(workspace, label, url, "delta", current, &token)
            .unwrap();
        assert_eq!(same["content"], "(no observed changes)\n");
        approve(&gate, workspace, label, url, "desktop").unwrap();
        let token = gate.take(workspace, label, url, "desktop").unwrap();
        current = vec!["#1 button \"Go\"".into(), "#2 link \"Docs\"".into()];
        let fewer = gate
            .project(workspace, label, url, "delta", current, &token)
            .unwrap();
        assert_eq!(fewer["content"], "(removed 1 previous controls)\n");
    }
    #[test]
    fn compact_projection_retains_exact_lines_for_subsequent_delta() {
        let gate = BrowserObservation::default();
        let workspace = "workspace-01";
        let label = "browser-01-tab-01";
        let url = "https://example.org/";
        gate.invalidate_tab(workspace, label);
        gate.mark_load_finished(label);
        approve(&gate, workspace, label, url, "desktop").unwrap();
        let token = gate.take(workspace, label, url, "desktop").unwrap();
        let first = gate
            .project(
                workspace,
                label,
                url,
                "compact",
                vec!["#1 button \"Save\"".into(), "#2 link \"Docs\"".into()],
                &token,
            )
            .unwrap();
        assert_eq!(first["content"], "#1 button \"Save\"\n#2 link \"Docs\"\n");
        assert_eq!(first["items"], 2);
        assert_eq!(first["mode"], "compact");
        assert_eq!(first["truncated"], false);

        approve(&gate, workspace, label, url, "desktop").unwrap();
        let token = gate.take(workspace, label, url, "desktop").unwrap();
        let same = gate
            .project(
                workspace,
                label,
                url,
                "delta",
                vec!["#1 link \"Docs\"".into(), "#2 button \"Save\"".into()],
                &token,
            )
            .unwrap();
        assert_eq!(same["content"], "(no observed changes)\n");
        assert_eq!(same["items"], 2);
    }
}
