use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tungstenite::{client, Message, WebSocket};

const PREVIEW: &str = include_str!("../../public/browser-preview.html");
const RELAY: &str = include_str!("lightpanda_relay.py");
const MAX_FRAME: usize = 1024 * 1024;
// Check an overall CDP RPC budget between received frames. The relay also
// applies a 5-second per-socket recv timeout; this is NOT a hard guarantee
// that a fragmented websocket message cannot consume more wall time.
const MAX_RPC_BUDGET: Duration = Duration::from_secs(8);
fn rpc_budget_expired(deadline: Instant) -> bool {
    Instant::now() >= deadline
}
pub(crate) const PREVIEW_URL: &str = "http://127.0.0.1:1425/browser-preview.html";

// A full semantic tree can exceed the authenticated native IPC frame.
// Bound the serialized JSON *before* handing it to the pipe (16 KiB),
// rather than truncating a tree and claiming its indices are complete.
fn bounded_preview_tree(workspace: &str, tree: &str) -> Result<Value, &'static str> {
    if tree.len() > 8 * 1024 {
        return Err("LIGHTPANDA_INDEX_TOO_LARGE");
    }
    let raw = json!({
        "source":"NATIVE_LIGHTPANDA_PREVIEW_TREE",
        "workspaceId":workspace,"url":PREVIEW_URL,
        "semanticTree":tree,"readOnly":true
    });
    if serde_json::to_vec(&raw)
        .map_err(|_| "LIGHTPANDA_INDEX_UNAVAILABLE")?
        .len() > 12 * 1024
    {
        return Err("LIGHTPANDA_INDEX_TOO_LARGE");
    }
    Ok(raw)
}

// Native-only read-only B2 preview inspector. This inspects known,
// owned offline controls and cannot be invoked from renderer, MCP or Code
// Mode. Public indexed labels never act as executable node references.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum OfflineControl {
    ActionButton,
    Checkbox,
    SearchField,
}
impl OfflineControl {
    fn label(self) -> &'static str {
        match self {
            Self::ActionButton => "Check preview",
            Self::Checkbox => "Preview checked",
            Self::SearchField => "Preview query",
        }
    }
    fn accepts_role(self, role: &str) -> bool {
        match self {
            Self::ActionButton => role == "button",
            Self::Checkbox => role == "checkbox",
            // Search inputs may be represented as an AX textbox by a
            // pinned older engine; inputType must still be search.
            Self::SearchField => matches!(role, "searchbox" | "textbox"),
        }
    }
    fn accepts_tag(self, tag: &str) -> bool {
        match self {
            Self::ActionButton => tag.eq_ignore_ascii_case("button"),
            Self::Checkbox | Self::SearchField => tag.eq_ignore_ascii_case("input"),
        }
    }
}
fn unwrap_semantic_name(text: &str) -> Option<&str> {
    let text = text.trim();
    if text.len() < 2 {
        return None;
    }
    if text.starts_with('\'') && text.ends_with('\'')
        || text.starts_with('"') && text.ends_with('"')
    {
        Some(&text[1..text.len()-1])
    } else {
        None
    }
}
// The parser is deliberately narrow. It does not accept arbitrary
// selectors, untrusted user names, or use a display index as identity.
fn find_offline_control(tree: &str, control: OfflineControl)
    -> Result<(u32, String), &'static str>
{
    if tree.len() > 8 * 1024 {
        return Err("LIGHTPANDA_REVIEW_TREE_TOO_LARGE");
    }
    let mut chosen: Option<(u32, String)> = None;
    for line in tree.lines() {
        let Some((id, tail)) = line.trim_start().split_once(' ') else {
            continue;
        };
        let Some(tail) = tail.trim_start().strip_prefix("[i] ") else {
            continue;
        };
        let Some((role, name)) = tail.split_once(' ') else {
            continue;
        };
        if !control.accepts_role(role)
            || unwrap_semantic_name(name) != Some(control.label())
        {
            continue;
        }
        let id: u32 = id.parse().map_err(|_| "LIGHTPANDA_REVIEW_NODE_INVALID")?;
        if id == 0 || id > i32::MAX as u32 {
            return Err("LIGHTPANDA_REVIEW_NODE_INVALID");
        }
        if chosen.replace((id, role.to_owned())).is_some() {
            return Err("LIGHTPANDA_REVIEW_TARGET_AMBIGUOUS");
        }
    }
    chosen.ok_or("LIGHTPANDA_REVIEW_TARGET_MISSING")
}
fn validate_offline_node(detail: &Value, control: OfflineControl,
    id: u32, role: &str) -> Result<(), &'static str>
{
    if detail["backendNodeId"].as_u64() != Some(u64::from(id))
        || detail["role"].as_str() != Some(role)
        || detail["name"].as_str() != Some(control.label())
        || detail["isInteractive"] != true
        || detail["disabled"] == true
        || !detail["tagName"].as_str().is_some_and(|t| control.accepts_tag(t))
    {
        return Err("LIGHTPANDA_REVIEW_TARGET_CHANGED");
    }
    let input_type = detail["inputType"].as_str();
    let safe = match control {
        OfflineControl::ActionButton => input_type.is_none()
            || input_type == Some("button"),
        OfflineControl::Checkbox => input_type.is_none()
            || input_type == Some("checkbox"),
        OfflineControl::SearchField => input_type == Some("search"),
    };
    if !safe {
        return Err("LIGHTPANDA_REVIEW_INPUT_TYPE_DENIED");
    }
    Ok(())
}
// Only a read-only document marker. performance.timeOrigin is useful
// to detect normal same-URL navigation but NOT an OS security boundary.
fn valid_preview_marker(marker: &Value) -> bool {
    marker["url"].as_str() == Some(PREVIEW_URL)
        && marker["epoch"].as_f64().is_some_and(|t| t.is_finite() && t > 0.0)
}
fn read_preview_marker(slot: &mut PreviewSlot) -> Result<Value, &'static str> {
    let result = slot.connection.rpc(
        "Runtime.evaluate",
        json!({"expression":"({url:location.href,epoch:performance.timeOrigin})",
            "returnByValue":true}),
        Some(&slot.session),
    )?;
    let marker = &result["result"]["value"];
    if !valid_preview_marker(marker) {
        return Err("LIGHTPANDA_REVIEW_DOCUMENT_CHANGED");
    }
    Ok(marker.clone())
}

struct Relay {
    process: Child,
    stdin: Option<ChildStdin>,
    stdout: ChildStdout,
}

impl Relay {
    fn exchange(
        &mut self,
        operation: u8,
        channel: u8,
        size: usize,
        input: &[u8],
        output: &mut [u8],
    ) -> io::Result<usize> {
        let stdin = self.stdin.as_mut().ok_or(io::ErrorKind::BrokenPipe)?;
        let mut header = [operation, channel, 0, 0, 0, 0];
        header[2..].copy_from_slice(&(size as u32).to_be_bytes());
        stdin.write_all(&header)?;
        stdin.write_all(input)?;
        stdin.flush()?;
        let mut length = [0; 4];
        self.stdout.read_exact(&mut length)?;
        let count = u32::from_be_bytes(length) as usize;
        if count > output.len() {
            return Err(io::ErrorKind::ConnectionAborted.into());
        }
        self.stdout.read_exact(&mut output[..count])?;
        Ok(count)
    }
}

struct Channel {
    relay: Arc<Mutex<Relay>>,
    id: u8,
}

impl Read for Channel {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        let count = bytes.len().min(MAX_FRAME);
        if count == 0 {
            return Ok(0);
        }
        self.relay
            .lock()
            .map_err(|_| io::ErrorKind::BrokenPipe)?
            .exchange(3, self.id, count, &[], &mut bytes[..count])
    }
}

impl Write for Channel {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        let count = bytes.len().min(MAX_FRAME);
        if count == 0 {
            return Ok(0);
        }
        self.relay
            .lock()
            .map_err(|_| io::ErrorKind::BrokenPipe)?
            .exchange(2, self.id, count, &bytes[..count], &mut [])?;
        Ok(count)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Drop for Channel {
    fn drop(&mut self) {
        if let Ok(mut relay) = self.relay.lock() {
            let _ = relay.exchange(4, self.id, 0, &[], &mut []);
        }
    }
}

impl Drop for Relay {
    fn drop(&mut self) {
        self.stdin.take();
        let deadline = Instant::now() + Duration::from_secs(3);
        while matches!(self.process.try_wait(), Ok(None)) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        if matches!(self.process.try_wait(), Ok(None)) {
            let _ = self.process.kill();
        }
        let _ = self.process.wait();
    }
}

// All operations run off the UI thread. No TCP connection is exposed to
// Windows or the rest of the WSL distro.
pub(crate) struct PrivateLightpanda {
    relay: Arc<Mutex<Relay>>,
    slots: HashMap<u8, PreviewSlot>,
}

struct PreviewSlot {
    connection: CdpConnection,
    context: String,
    session: String,
}

struct CdpConnection {
    socket: WebSocket<Channel>,
    next_id: u32,
}

impl PrivateLightpanda {
    pub(crate) fn start(binary: &str) -> Result<Self, &'static str> {
        if !binary.starts_with('/') || binary.len() > 2048 || binary.contains('\0') {
            return Err("LIGHTPANDA_BINARY_PATH_REQUIRED");
        }
        let system_root = std::env::var_os("SystemRoot").ok_or("WINDOWS_SYSTEM_ROOT_REQUIRED")?;
        let wsl = PathBuf::from(&system_root).join("System32/wsl.exe");
        if !wsl.is_absolute() {
            return Err("WINDOWS_SYSTEM_ROOT_REQUIRED");
        }
        let mut process = Command::new(wsl)
            .args([
                "-d",
                "Ubuntu",
                "--exec",
                "/usr/bin/unshare",
                "-Urn",
                "/usr/bin/python3",
                "-I",
                "-c",
                RELAY,
                binary,
                PREVIEW,
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "LIGHTPANDA_RELAY_SPAWN_FAILED")?;
        let relay = Arc::new(Mutex::new(Relay {
            stdin: process.stdin.take(),
            stdout: process.stdout.take().expect("piped relay stdout"),
            process,
        }));
        let backend = Self {
            relay,
            slots: HashMap::new(),
        };
        // Confirm the pinned child speaks CDP before issuing any grant.
        drop(backend.connect(1)?);
        Ok(backend)
    }

    pub(crate) fn invoke(
        &mut self,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
    ) -> Result<Value, &'static str> {
        use super::lightpanda_admission::workspace_allowed;
        if !workspace_allowed(workspace) {
            return Err("INVALID_WORKSPACE");
        }
        let id = workspace["workspace-".len()..]
            .parse::<u8>()
            .map_err(|_| "INVALID_WORKSPACE")?;
        match (capability, url) {
            ("lightpanda.open", Some(PREVIEW_URL)) => {
                if !self.slots.contains_key(&id) {
                    let slot = self.open(id)?;
                    self.slots.insert(id, slot);
                }
                Ok(json!({"workspaceId":workspace,"url":PREVIEW_URL}))
            }
            // Internal grant scope for one preview-only indexed read. It
            // never becomes a fifth public MCP tool or an action grant.
            ("lightpanda.snapshot.index", None) => {
                let slot = self.slots.get_mut(&id).ok_or("WORKSPACE_NOT_OPEN")?;
                let result = slot.connection.rpc(
                    "LP.getSemanticTree",
                    json!({"format":"text","interactiveOnly":true}),
                    Some(&slot.session),
                )?;
                let tree = result["semanticTree"].as_str()
                    .ok_or("LIGHTPANDA_INDEX_UNAVAILABLE")?;
                if tree.len() > 8 * 1024 {
                    return Err("LIGHTPANDA_INDEX_TOO_LARGE");
                }
                // The preview is a fixed, offline page. Confirm it has not
                // left the permitted URL after the semantic read.
                let location = slot.connection.rpc(
                    "Runtime.evaluate",
                    json!({"expression":"location.href","returnByValue":true}),
                    Some(&slot.session),
                )?;
                if location["result"]["value"] != PREVIEW_URL {
                    self.slots.remove(&id);
                    return Err("BROWSER_NAVIGATION_CHANGED");
                }
                // This raw tree is PRIVATE to the authenticated gateway
                // pipe; JS must project it before exposing tool output.
                bounded_preview_tree(workspace, tree)
            }
            ("lightpanda.snapshot", None) => {
                let slot = self.slots.get_mut(&id).ok_or("WORKSPACE_NOT_OPEN")?;
                let result = slot.connection.rpc("Runtime.evaluate", json!({
                    "expression":"({url:location.href,title:document.title})","returnByValue":true
                }), Some(&slot.session))?;
                let value = &result["result"]["value"];
                if value["url"] != PREVIEW_URL {
                    self.slots.remove(&id);
                    return Err("BROWSER_NAVIGATION_CHANGED");
                }
                let title: String = value["title"]
                    .as_str()
                    .ok_or("INVALID_PREVIEW_TITLE")?
                    .chars()
                    .take(200)
                    .collect();
                Ok(json!({"workspaceId":workspace,"url":PREVIEW_URL,"title":title}))
            }
            ("lightpanda.close", None) => {
                let Some(mut slot) = self.slots.remove(&id) else {
                    return Ok(json!({"closed":false}));
                };
                slot.connection.rpc(
                    "Target.disposeBrowserContext",
                    json!({
                        "browserContextId":slot.context
                    }),
                    None,
                )?;
                Ok(json!({"closed":true}))
            }
            _ => Err("BROWSER_TARGET_DENIED"),
        }
    }

    // Read-only native review, intentionally not connected to any external
    // action, grant issuer or Tauri command. The returned receipt contains
    // no node ID, selector, input value or copyable permission.
    #[allow(dead_code)]
    fn review_offline_control(&mut self, workspace: &str, control: OfflineControl)
        -> Result<Value, &'static str>
    {
        use super::lightpanda_admission::workspace_allowed;
        if !workspace_allowed(workspace) {
            return Err("INVALID_WORKSPACE");
        }
        let id: u8 = workspace["workspace-".len()..].parse()
            .map_err(|_| "INVALID_WORKSPACE")?;
        let slot = self.slots.get_mut(&id).ok_or("WORKSPACE_NOT_OPEN")?;
        let before = read_preview_marker(slot)?;
        let tree_reply = slot.connection.rpc(
            "LP.getSemanticTree",
            json!({"format":"text","interactiveOnly":true}),
            Some(&slot.session),
        )?;
        let tree = tree_reply["semanticTree"].as_str()
            .ok_or("LIGHTPANDA_REVIEW_TREE_UNAVAILABLE")?;
        let (backend_id, role) = find_offline_control(tree, control)?;
        let detail_reply = slot.connection.rpc(
            "LP.getNodeDetails",
            json!({"backendNodeId":backend_id}),
            Some(&slot.session),
        )?;
        validate_offline_node(
            &detail_reply["nodeDetails"], control, backend_id, &role
        )?;
        let after = read_preview_marker(slot)?;
        if before != after {
            return Err("LIGHTPANDA_REVIEW_DOCUMENT_CHANGED");
        }
        Ok(json!({
            "source":"NATIVE_LIGHTPANDA_OFFLINE_TARGET_REVIEW",
            "workspaceId":workspace,"role":role,"label":control.label(),
            "status":"NATIVE_ACTION_GRANT_REQUIRED",
            "readOnly":true,"untrustedPageContent":true,
            "actionAuthorized":false,"nextPromptAllowed":false,
            "resultVerified":false,"qa":"NOT_EXECUTED"
        }))
    }

    fn open(&self, id: u8) -> Result<PreviewSlot, &'static str> {
        let mut connection = self.connect(id)?;
        let context = connection.rpc("Target.createBrowserContext", json!({}), None)?;
        let context = context["browserContextId"]
            .as_str()
            .ok_or("CDP_CONTEXT_REQUIRED")?
            .to_owned();
        let target = connection.rpc(
            "Target.createTarget",
            json!({
                "url":"about:blank","browserContextId":context
            }),
            None,
        )?;
        let attached = connection.rpc(
            "Target.attachToTarget",
            json!({
                "targetId":target["targetId"].as_str().ok_or("CDP_TARGET_REQUIRED")?, "flatten":true
            }),
            None,
        )?;
        let session = attached["sessionId"]
            .as_str()
            .ok_or("CDP_SESSION_REQUIRED")?
            .to_owned();
        let navigation =
            connection.rpc("Page.navigate", json!({"url":PREVIEW_URL}), Some(&session))?;
        if navigation.get("errorText").is_some() {
            return Err("CDP_NAVIGATION_FAILED");
        }
        Ok(PreviewSlot {
            connection,
            context,
            session,
        })
    }

    fn connect(&self, id: u8) -> Result<CdpConnection, &'static str> {
        self.relay
            .lock()
            .map_err(|_| "LIGHTPANDA_RELAY_LOCK_FAILED")?
            .exchange(1, id, 0, &[], &mut [])
            .map_err(|_| "LIGHTPANDA_CHANNEL_OPEN_FAILED")?;
        let channel = Channel {
            relay: self.relay.clone(),
            id,
        };
        let config = tungstenite::protocol::WebSocketConfig {
            max_message_size: Some(MAX_FRAME),
            max_frame_size: Some(MAX_FRAME),
            ..Default::default()
        };
        let (socket, _) = client::client_with_config("ws://127.0.0.1:9222/", channel, Some(config))
            .map_err(|_| "LIGHTPANDA_PRIVATE_HANDSHAKE_FAILED")?;
        let mut connection = CdpConnection { socket, next_id: 0 };
        let version = connection.rpc("Browser.getVersion", json!({}), None)?;
        // The sealed binary supplies identity. Lightpanda advertises Chrome
        // here for CDP compatibility.
        if version["protocolVersion"] != "1.3" {
            return Err("LIGHTPANDA_PROTOCOL_MISMATCH");
        }
        Ok(connection)
    }
}

impl CdpConnection {
    fn rpc(
        &mut self,
        method: &str,
        params: Value,
        session: Option<&str>,
    ) -> Result<Value, &'static str> {
        let id = self.next_id.checked_add(1).ok_or("CDP_ID_EXHAUSTED")?;
        self.next_id = id;
        let mut request = json!({"id":id,"method":method,"params":params});
        if let Some(session) = session {
            request["sessionId"] = json!(session);
        }
        let deadline = Instant::now()
            .checked_add(MAX_RPC_BUDGET)
            .ok_or("CDP_INVALID_DEADLINE")?;
        self.socket
            .send(Message::Text(request.to_string().into()))
            .map_err(|_| "CDP_WRITE_FAILED")?;
        for _ in 0..256 {
            if rpc_budget_expired(deadline) {
                return Err("CDP_RESPONSE_DEADLINE_EXCEEDED");
            }
            let message = self.socket.read().map_err(|_| "CDP_READ_FAILED")?;
            // Even a matching late reply cannot become a verified result.
            if rpc_budget_expired(deadline) {
                return Err("CDP_RESPONSE_DEADLINE_EXCEEDED");
            }
            if let Message::Text(text) = message {
                let reply: Value =
                    serde_json::from_str(&text).map_err(|_| "CDP_INVALID_RESPONSE")?;
                if reply["id"] != id {
                    continue;
                }
                if reply.get("sessionId").and_then(Value::as_str) != session {
                    return Err("CDP_SESSION_MISMATCH");
                }
                return reply
                    .get("result")
                    .filter(|result| result.is_object())
                    .cloned()
                    .ok_or("CDP_COMMAND_FAILED");
            }
        }
        Err("CDP_RESPONSE_LIMIT")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn offline_target_review_parser_rejects_missing_ambiguous_and_changed() {
        let tree = concat!(
            "1 RootWebArea 'Offline'\n",
            "16 [i] button 'Check preview'\n",
            "17 [i] checkbox 'Preview checked'\n",
            "18 [i] searchbox 'Preview query'\n"
        );
        assert_eq!(find_offline_control(tree, OfflineControl::ActionButton),
            Ok((16,"button".into())));
        assert_eq!(find_offline_control(tree, OfflineControl::Checkbox),
            Ok((17,"checkbox".into())));
        assert_eq!(find_offline_control(tree, OfflineControl::SearchField),
            Ok((18,"searchbox".into())));
        assert_eq!(find_offline_control("1 RootWebArea 'Empty'",
            OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_TARGET_MISSING"));
        assert_eq!(find_offline_control("0 [i] button 'Check preview'",
            OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_NODE_INVALID"));
        assert_eq!(find_offline_control(
            "16 [i] link 'Check preview'",OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_TARGET_MISSING"));
        assert_eq!(find_offline_control(
            "16 [i] button 'Check preview'\n22 [i] button 'Check preview'",
            OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_TARGET_AMBIGUOUS"));
        assert_eq!(find_offline_control(
            "2147483648 [i] button 'Check preview'",
            OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_NODE_INVALID"));
        assert_eq!(find_offline_control(&"x".repeat(8193),
            OfflineControl::ActionButton),
            Err("LIGHTPANDA_REVIEW_TREE_TOO_LARGE"));
        let details=json!({"backendNodeId":16,"role":"button",
            "name":"Check preview","isInteractive":true,"tagName":"button",
            "selector":"#private","value":"NEVER EXPOSE"});
        assert_eq!(validate_offline_node(&details,
            OfflineControl::ActionButton,16,"button"),Ok(()));
        for invalid in [
            json!({"backendNodeId":17,"role":"button",
                "name":"Check preview","isInteractive":true,"tagName":"button"}),
            json!({"backendNodeId":16,"role":"link",
                "name":"Check preview","isInteractive":true,"tagName":"button"}),
            json!({"backendNodeId":16,"role":"button",
                "name":"Changed","isInteractive":true,"tagName":"button"}),
            json!({"backendNodeId":16,"role":"button",
                "name":"Check preview","isInteractive":false,"tagName":"button"}),
            json!({"backendNodeId":16,"role":"button",
                "name":"Check preview","isInteractive":true,"tagName":"button",
                "disabled":true}),
        ] {
            assert_eq!(validate_offline_node(&invalid,
                OfflineControl::ActionButton,16,"button"),
                Err("LIGHTPANDA_REVIEW_TARGET_CHANGED"));
        }
        assert_eq!(validate_offline_node(
            &json!({"backendNodeId":18,"role":"searchbox",
                "name":"Preview query","isInteractive":true,"tagName":"input",
                "inputType":"password"}),
            OfflineControl::SearchField,18,"searchbox"),
            Err("LIGHTPANDA_REVIEW_INPUT_TYPE_DENIED"));
        assert_eq!(validate_offline_node(
            &json!({"backendNodeId":18,"role":"searchbox",
                "name":"Preview query","isInteractive":true,"tagName":"input",
                "inputType":"search"}),
            OfflineControl::SearchField,18,"searchbox"),Ok(()));
    }
    #[test]
    fn offline_review_document_marker_is_bounded_to_the_fixed_page() {
        let valid=json!({"url":PREVIEW_URL,"epoch":1770000000000.25});
        assert!(valid_preview_marker(&valid));
        for invalid in [
            json!({"url":"https://chatgpt.com","epoch":1770000000000.25}),
            json!({"url":PREVIEW_URL,"epoch":0}),
            json!({"url":PREVIEW_URL,"epoch":"2026-11-16"}),
            json!({"url":PREVIEW_URL,"epoch":null}),
        ] {
            assert!(!valid_preview_marker(&invalid));
        }
        // These are illustrative markers, not native/browser runtime proof.
        assert_ne!(json!({"url":PREVIEW_URL,"epoch":5.1}),
                   json!({"url":PREVIEW_URL,"epoch":5.2}));
    }
    #[test]
    fn private_semantic_tree_fits_authenticated_pipe() {
        let bounded=bounded_preview_tree("workspace-01",
            "1 RootWebArea 'Offline'\n16 [i] button 'Check preview'").unwrap();
        assert_eq!(bounded["source"],"NATIVE_LIGHTPANDA_PREVIEW_TREE");
        assert_eq!(bounded["readOnly"],true);
        assert!(serde_json::to_vec(&bounded).unwrap().len()<16*1024);
        assert_eq!(bounded_preview_tree("workspace-01",&"x".repeat(8193)),
            Err("LIGHTPANDA_INDEX_TOO_LARGE"));
    }
    #[test]
    fn expired_native_cdp_reply_is_never_accepted() {
        let now = Instant::now();
        let expired = now.checked_sub(Duration::from_secs(1)).unwrap();
        let valid = now.checked_add(Duration::from_secs(1)).unwrap();
        assert!(rpc_budget_expired(expired));
        assert!(!rpc_budget_expired(valid));
    }

    use crate::gateway_session::GatewaySession;
    use std::path::Path;

    #[test]
    #[ignore = "requires the exact sealed Lightpanda binary and isolated Ubuntu WSL2 on the user's PC"]
    fn pinned_wsl_lightpanda_reports_interactive_fixture() {
        // This is a REAL binary compatibility gate, not a mock or proof
        // that the current pinned SHA supports the latest LP domain.
        let binary = std::env::var("LAZY_LIGHTPANDA_TEST_BINARY").unwrap();
        let mut browser = PrivateLightpanda::start(&binary).unwrap();
        browser.invoke("lightpanda.open", "workspace-01", Some(PREVIEW_URL)).unwrap();
        let slot = browser.slots.get_mut(&1).unwrap();
        // The sealed release is Lightpanda 1.0.3; LP.waitUntil was
        // introduced later, so synchronize through the older selector API.
        let wait = slot.connection.rpc(
            "LP.waitForSelector",
            json!({"selector":"#preview-query","timeout":5000}),
            Some(&slot.session),
        );
        assert!(wait.is_ok(), "pinned LP.waitForSelector protocol is unsupported");
        let tree = slot.connection.rpc(
            "LP.getSemanticTree",
            json!({"format":"text","interactiveOnly":true}),
            Some(&slot.session),
        ).expect("pinned LP.getSemanticTree protocol is unsupported");
        let output = tree["semanticTree"].as_str()
            .expect("LP.getSemanticTree did not return semanticTree text");
        assert!(output.contains("Preview query"), "search input absent from semantic tree");
        assert!(output.contains("Preview checked"), "checkbox absent from semantic tree");
        assert!(output.contains("Check preview"), "button absent from semantic tree");
        // Native source-level API readiness: live CDP node details need
        // independent verification on this pinned runtime later.
        let checked = browser.review_offline_control(
            "workspace-01",OfflineControl::ActionButton
        ).expect("LP.getNodeDetails/button check failed on sealed browser");
        assert_eq!(checked["actionAuthorized"],false);
        assert_eq!(checked["status"],"NATIVE_ACTION_GRANT_REQUIRED");
        assert!(checked.get("backendNodeId").is_none());
        assert!(checked.get("selector").is_none());
        browser.invoke("lightpanda.close", "workspace-01", None).unwrap();
    }

    #[test]
    #[ignore = "requires staged gateway and a pinned Lightpanda binary in Ubuntu WSL2"]
    fn private_wsl_browser_isolates_ten_workspaces() {
        let binary = std::env::var("LAZY_LIGHTPANDA_TEST_BINARY").unwrap();
        let mut browser = PrivateLightpanda::start(&binary).unwrap();
        let gateway = GatewaySession::default();
        let resources = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway");
        gateway
            .probe_packaged(&resources.canonicalize().unwrap())
            .unwrap();
        assert_eq!(
            gateway.invoke_lightpanda(
                &mut browser,
                "lightpanda.open",
                "workspace-01",
                Some(PREVIEW_URL),
                false
            ),
            Err("NATIVE_ADMISSION_DENIED")
        );
        assert_eq!(
            gateway.invoke_lightpanda(
                &mut browser,
                "lightpanda.open",
                "workspace-01",
                Some("http://127.0.0.1:1425/admin"),
                true
            ),
            Err("NATIVE_ADMISSION_DENIED")
        );

        for id in 1..=10 {
            let workspace = format!("workspace-{id:02}");
            let opened = gateway
                .invoke_lightpanda(
                    &mut browser,
                    "lightpanda.open",
                    &workspace,
                    Some(PREVIEW_URL),
                    true,
                )
                .unwrap();
            assert_eq!(
                opened["result"]["structuredContent"]["workspaceId"],
                workspace
            );
            let snapshot = gateway
                .invoke_lightpanda(&mut browser, "lightpanda.snapshot", &workspace, None, true)
                .unwrap();
            assert_eq!(
                snapshot["result"]["structuredContent"]["title"],
                "Browser 01 · Local WebView Proof"
            );
            let slot = browser.slots.get_mut(&id).unwrap();
            let wrote = slot
                .connection
                .rpc(
                    "Runtime.evaluate",
                    json!({
                        "expression":format!("localStorage.setItem('workspace', '{id}')")
                    }),
                    Some(&slot.session),
                )
                .unwrap();
            assert!(wrote.get("exceptionDetails").is_none());
        }

        let closed = gateway
            .invoke_lightpanda(&mut browser, "lightpanda.close", "workspace-01", None, true)
            .unwrap();
        assert_eq!(closed["result"]["structuredContent"]["closed"], true);
        let missing = gateway
            .invoke_lightpanda(
                &mut browser,
                "lightpanda.snapshot",
                "workspace-01",
                None,
                true,
            )
            .unwrap();
        assert_eq!(
            missing["result"]["content"][0]["text"],
            "WORKSPACE_NOT_OPEN"
        );
        for id in 2..=10 {
            let slot = browser.slots.get_mut(&id).unwrap();
            let result = slot
                .connection
                .rpc(
                    "Runtime.evaluate",
                    json!({
                        "expression":"localStorage.getItem('workspace')","returnByValue":true
                    }),
                    Some(&slot.session),
                )
                .unwrap();
            assert_eq!(result["result"]["value"], id.to_string());
            let workspace = format!("workspace-{id:02}");
            let closed = gateway
                .invoke_lightpanda(&mut browser, "lightpanda.close", &workspace, None, true)
                .unwrap();
            assert_eq!(closed["result"]["structuredContent"]["closed"], true);
        }
        assert!(browser.slots.is_empty());
        gateway.stop().unwrap();
    }
}
