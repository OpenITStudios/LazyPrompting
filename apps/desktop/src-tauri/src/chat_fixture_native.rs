// Debug/fixture-only MCP -> WebView2 command route. NO chatgpt.com automation.
// The document window.postMessage channel is visible to the page and is NOT
// an authentication boundary. Never enable this route for external websites.
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager};

const MAX_ACTIVE: usize = 2;
const MAX_TEXT: usize = 12_000;

#[derive(Clone)]
struct Attempt {
    epoch: u64,
    prompt_id: String,
    url: String,
    prompt_digest: String,
    state: &'static str,
}

#[derive(Default)]
pub(crate) struct FixtureChatState {
    active: Mutex<BTreeMap<String, Attempt>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SendArguments {
    workspace_id: String,
    epoch: u64,
    prompt_id: String,
    text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StatusArguments {
    workspace_id: String,
}

fn valid_workspace(id: &str) -> bool {
    let Some(rest) = id.strip_prefix("workspace-") else { return false };
    rest.len() == 2 && rest.bytes().all(|b| b.is_ascii_digit()) &&
        matches!(rest.parse::<u8>(), Ok(1..=10))
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.bytes().all(|b| {
        b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b':')
    })
}

fn fixture_origin(url: &tauri::Url) -> Option<String> {
    if url.scheme() != "http" || url.host_str()? != "127.0.0.1" ||
        !url.username().is_empty() || url.password().is_some() ||
        !url.path().starts_with("/fixture-chat/") || url.fragment().is_some() {
        return None;
    }
    Some(format!("http://127.0.0.1:{}", url.port()?))
}

fn gate() -> Result<(), String> {
    if !cfg!(debug_assertions) ||
        std::env::var("LAZY_FIXTURE_BRIDGE_ENABLE").ok().as_deref() != Some("1") {
        return Err("CHAT_FIXTURE_BRIDGE_DISABLED".into());
    }
    Ok(())
}

pub(crate) fn schema(action: &str) -> Value {
    let mut properties = json!({"workspaceId":{"type":"string","pattern":"^workspace-(0[1-9]|10)$"}});
    let required = if action == "send" {
        properties["epoch"] = json!({"type":"integer","minimum":1});
        properties["promptId"] = json!({"type":"string","minLength":1,"maxLength":128});
        properties["text"] = json!({"type":"string","minLength":1,"maxLength":12000});
        json!(["workspaceId", "epoch", "promptId", "text"])
    } else {
        json!(["workspaceId"])
    };
    json!({"type":"object","additionalProperties":false,
        "properties":properties,"required":required})
}

pub(crate) async fn request(app: &AppHandle, action: &str, args: Value) -> Result<Value, String> {
    gate()?;
    match action {
        "send" => send(app, args),
        "status" => status(app, args).await,
        _ => Err("UNKNOWN_FIXTURE_ACTION".into()),
    }
}

fn send(app: &AppHandle, args: Value) -> Result<Value, String> {
    let input: SendArguments = serde_json::from_value(args)
        .map_err(|_| "INVALID_FIXTURE_ARGUMENTS")?;
    if !valid_workspace(&input.workspace_id) || input.epoch == 0 ||
        !valid_id(&input.prompt_id) || input.text.trim().is_empty() ||
        input.text.len() > MAX_TEXT {
        return Err("INVALID_FIXTURE_SCOPE".into());
    }
    let view_label = input.workspace_id.replacen("workspace-", "browser-", 1);
    let view = app.get_webview(&view_label).ok_or("FIXTURE_WEBVIEW_MISSING")?;
    let url = view.url().map_err(|_| "FIXTURE_URL_UNAVAILABLE")?;
    let origin = fixture_origin(&url).ok_or("FIXTURE_ORIGIN_REQUIRED")?;
    let url_string = url.as_str().to_owned();
    let digest = format!("{:x}", Sha256::digest(input.text.as_bytes()));
    let state = app.state::<FixtureChatState>();
    {
        let mut active = state.active.lock().map_err(|_| "FIXTURE_STATE_UNAVAILABLE")?;
        if active.contains_key(&input.workspace_id) {
            return Err("FIXTURE_PROMPT_ALREADY_PENDING".into());
        }
        if active.len() >= MAX_ACTIVE {
            return Err("FIXTURE_CONCURRENCY_LIMIT".into());
        }
        // Reserve BEFORE invoking page JS. Do not retry if eval fails or the
        // acknowledgement never arrives; the side effect may have occurred.
        active.insert(input.workspace_id.clone(), Attempt {
            epoch: input.epoch,
            prompt_id: input.prompt_id.clone(),
            url: url_string,
            prompt_digest: digest,
            state: "SEND_OUTCOME_UNKNOWN",
        });
    }
    let mut nonce = [0_u8; 16];
    getrandom::getrandom(&mut nonce).map_err(|_| "FIXTURE_NONCE_UNAVAILABLE")?;
    let request_id: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
    let packet = json!({
        "type":"LP_FIXTURE_NATIVE_REQUEST", "protocolVersion":1,
        "requestId":request_id,
        "command":{
            "type":"LP_FIXTURE_SEND", "protocolVersion":1,
            "workspaceId":input.workspace_id.clone(), "epoch":input.epoch,
            "promptId":input.prompt_id.clone(), "text":input.text.clone(),
        }
    });
    let packet_js = serde_json::to_string(&packet).map_err(|_| "FIXTURE_PACKET_INVALID")?;
    let origin_js = serde_json::to_string(&origin).map_err(|_| "FIXTURE_ORIGIN_INVALID")?;
    let url_js = serde_json::to_string(&url_string).map_err(|_| "FIXTURE_URL_INVALID")?;
    // Both origin and path are checked at time of actual JS execution in case
    // the tab navigated after our native URL check. This remains a test-only
    // message, visible to the entire owned fixture page.
    let script = format!(r#"(() => {{
        const u = new URL(location.href);
        if (u.origin !== {origin_js} || location.href !== {url_js} ||
            !u.pathname.startsWith('/fixture-chat/')) return false;
        window.postMessage({packet_js}, {origin_js});
        return true;
    }})()"#);
    view.eval(script).map_err(|_| "FIXTURE_SEND_OUTCOME_UNKNOWN")?;
    Ok(json!({
        "workspaceId":input.workspace_id,"promptId":input.prompt_id,
        "epoch":input.epoch,"state":"SEND_OUTCOME_UNKNOWN",
        "nativeEvaluationRequested":true,"fixtureOnly":true,
        "note":"JavaScript evaluation queued; not an accepted chat turn"
    }))
}

async fn status(app: &AppHandle, args: Value) -> Result<Value, String> {
    let input: StatusArguments = serde_json::from_value(args)
        .map_err(|_| "INVALID_FIXTURE_ARGUMENTS")?;
    if !valid_workspace(&input.workspace_id) {
        return Err("INVALID_FIXTURE_SCOPE".into());
    }
    let attempt = {
        let state = app.state::<FixtureChatState>();
        let active = state.active.lock().map_err(|_| "FIXTURE_STATE_UNAVAILABLE")?;
        active.get(&input.workspace_id).cloned()
    };
    let Some(attempt) = attempt else {
        return Ok(json!({"workspaceId":input.workspace_id,"fixtureOnly":true,"state":"IDLE"}));
    };
    let label = input.workspace_id.replacen("workspace-", "browser-", 1);
    let view = app.get_webview(&label).ok_or("FIXTURE_WEBVIEW_MISSING")?;
    let url = view.url().map_err(|_| "FIXTURE_URL_UNAVAILABLE")?;
    if url.as_str() != attempt.url || fixture_origin(&url).is_none() {
        return Err("FIXTURE_SESSION_CHANGED_RECONCILE_REQUIRED".into());
    }
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    view.eval_with_callback(
        "(() => ({fixturePhase: String(document.querySelector('#status')?.textContent ?? 'UNKNOWN').trim(), href: location.href}))()",
        move |value| { let _ = tx.send(value); }
    ).map_err(|_| "FIXTURE_OBSERVATION_UNAVAILABLE")?;
    // Never block the UI or Tokio executor thread waiting for JavaScript.
    let payload = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(2)))
        .await.map_err(|_| "FIXTURE_OBSERVATION_DROPPED")?
        .map_err(|_| "FIXTURE_OBSERVATION_TIMEOUT")?;
    let observed: Value = serde_json::from_str(&payload)
        .map_err(|_| "FIXTURE_OBSERVATION_INVALID")?;
    let phase = observed["fixturePhase"].as_str().unwrap_or("UNKNOWN");
    let safe_phase = match phase {
        "IDLE" | "GENERATING" | "DONE" | "ERROR" | "MANUAL_STOP" => phase,
        _ => "UNKNOWN",
    };
    if observed["href"].as_str() != Some(attempt.url.as_str()) {
        return Err("FIXTURE_SESSION_CHANGED_RECONCILE_REQUIRED".into());
    }
    Ok(json!({
        "workspaceId":input.workspace_id,"fixtureOnly":true,
        "epoch":attempt.epoch,"promptId":attempt.prompt_id,
        "promptDigest":attempt.prompt_digest,
        "state":attempt.state,"observedUiPhase":safe_phase,
        "observationTrusted":false,"sourceVerified":false,
        "nextPromptAllowed":false,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reject_real_websites_and_invalid_scopes() {
        assert!(fixture_origin(&tauri::Url::parse("https://chatgpt.com/").unwrap()).is_none());
        assert!(fixture_origin(&tauri::Url::parse("http://localhost:38771/fixture-chat/").unwrap()).is_none());
        assert!(fixture_origin(&tauri::Url::parse("http://127.0.0.1:38771/other").unwrap()).is_none());
        assert_eq!(fixture_origin(&tauri::Url::parse("http://127.0.0.1:38771/fixture-chat/index.html").unwrap()).as_deref(), Some("http://127.0.0.1:38771"));
        assert!(valid_workspace("workspace-01"));
        assert!(valid_workspace("workspace-10"));
        assert!(!valid_workspace("workspace-11"));
        assert!(!valid_workspace("workspace-1"));
        assert!(valid_id("task_01:turn-2"));
        assert!(!valid_id("path/to/file"));
    }
}
