// Explicit main-window operator send attempt for one owned WebView2 workspace.
// This fixed-source fallback does not read responses, use the extension popup,
// or provide automated delivery/continuation. Queuing eval is not a send receipt.
use std::{collections::{HashMap, HashSet}, sync::Mutex, time::{Duration, Instant}};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::Manager;

#[derive(Default)]
struct OperatorState {
    attempted: HashSet<(String, String)>,
    latest: HashMap<String, Attempt>,
}

#[derive(Clone)]
struct Attempt {
    url: String,
    started: Instant,
    generating_seen: bool,
    state: &'static str,
}

#[derive(Default)]
pub(crate) struct OperatorSendLedger {
    state: Mutex<OperatorState>,
}

#[tauri::command]
pub(crate) async fn operator_send_once(
    webview: tauri::Webview,
    state: tauri::State<'_, OperatorSendLedger>,
    workspace_id: String,
    text: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("OPERATOR_MAIN_WINDOW_REQUIRED".into());
    }
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    if text.trim().is_empty() || text.len() > 12_000 ||
        text.chars().any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
    {
        return Err("OPERATOR_PROMPT_INVALID".into());
    }
    let target = webview.app_handle().get_webview(&label)
        .ok_or("OPERATOR_BROWSER_CLOSED")?;
    let url = target.url().map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?;
    if url.scheme() != "https" || url.host_str() != Some("chatgpt.com") ||
        url.username() != "" || url.password().is_some() ||
        url.query_pairs().any(|(key, _)| {
            let key = key.to_ascii_lowercase().replace(['-', '_'], "");
            key == "temporarychat"
        })
    {
        return Err("OPERATOR_ORDINARY_CHAT_REQUIRED".into());
    }
    let digest = format!("{:x}", Sha256::digest(text.as_bytes()));
    // Reserve before the irreversible UI action. A repeated click or an
    // uncertain outcome must not retry the same prompt automatically.
    {
        let mut guard = state.state.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        if !guard.attempted.insert((workspace_id.clone(), digest)) {
            return Err("OPERATOR_PROMPT_ALREADY_ATTEMPTED".into());
        }
    }
    let encoded = serde_json::to_string(&text)
        .map_err(|_| "OPERATOR_PROMPT_ENCODING_FAILED")?;
    let script = format!(r#"(() => {{
      if (location.protocol !== 'https:' || location.hostname !== 'chatgpt.com' ||
          [...new URL(location.href).searchParams.keys()].some(k =>
             /^temporary[-_]?chat$/i.test(k))) return;
      const editors = ['#prompt-textarea', '[data-testid="composer-text-input"]',
        '[role="textbox"][contenteditable="true"]'];
      const sends = ['[data-testid="send-button"]',
        'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]',
        'button[type="submit"]'];
      const first = (root, keys) => keys.map(k => root.querySelector(k)).find(Boolean);
      const editor = first(document, editors);
      const button = editor && first(editor.closest('form') ?? document, sends);
      if (!editor || !button || editor.disabled || editor.readOnly ||
          button.disabled || !editor.getClientRects().length) return;
      const existing = ('value' in editor ? editor.value : editor.textContent) ?? '';
      if (String(existing).trim()) return;
      const text = {encoded};
      editor.focus();
      if ('value' in editor) {{
        const setter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(editor), 'value')?.set;
        if (setter) setter.call(editor, text);
        else editor.value = text;
      }} else {{
        if (editor.getAttribute('contenteditable') !== 'true' ||
            document.execCommand('insertText', false, text) !== true) return;
      }}
      editor.dispatchEvent(new Event('input', {{ bubbles: true }}));
      const inserted = ('value' in editor ? editor.value : editor.textContent) ?? '';
      if (String(inserted) !== text || button.disabled) return;
      button.click();
    }})()"#);
    {
        let mut guard = state.state.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        guard.latest.insert(workspace_id.clone(), Attempt {
            url: url.to_string(), started: Instant::now(),
            generating_seen: false, state: "WAITING"
        });
    }
    if target.eval(script).is_err() {
        let mut guard = state.state.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        if let Some(attempt) = guard.latest.get_mut(&workspace_id) {
            attempt.state = "UNKNOWN";
        }
        return Err("OPERATOR_SEND_OUTCOME_UNKNOWN".into());
    }
    Ok(json!({
        "workspaceId": workspace_id,
        "status": "UI_ACTION_REQUESTED",
        "sent": false,
        "deliveryVerified": false,
        "resultVerified": false,
        "nextPromptAllowed": false
    }))
}

#[tauri::command]
pub(crate) async fn operator_chat_status(
    webview: tauri::Webview,
    state: tauri::State<'_, OperatorSendLedger>,
    workspace_id: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("OPERATOR_MAIN_WINDOW_REQUIRED".into());
    }
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    let current = {
        let guard = state.state.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        guard.latest.get(&workspace_id).cloned()
    };
    let Some(attempt) = current else {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    };
    let view = webview.app_handle().get_webview(&label)
        .ok_or("OPERATOR_BROWSER_CLOSED")?;
    let url = view.url().map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?;
    if url.as_str() != attempt.url {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    }
    // Read control presence only. No response text, transcript, token, cookie,
    // private endpoint, or page state is returned to the host.
    let script = r#"(() => {
      if (location.protocol !== 'https:' || location.hostname !== 'chatgpt.com')
        return {href:location.href, valid:false};
      const visible = selectors => selectors.some(selector => {
        const el=document.querySelector(selector);
        return !!el && !el.disabled && el.getClientRects().length > 0;
      });
      return {
        href:location.href, valid:true,
        stop:visible(['[data-testid="stop-button"]',
          'button[aria-label="Stop generating"]',
          'button[aria-label="Stop response"]', 'button[aria-label="Stop"]']),
        error:visible(['[data-testid="conversation-turn-error"]',
          '[data-testid="response-error"]'])
      };
    })()"#;
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    view.eval_with_callback(script, move |value| {
        let _ = tx.send(value);
    }).map_err(|_| "OPERATOR_STATUS_UNAVAILABLE")?;
    let raw = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(2))
    }).await.map_err(|_| "OPERATOR_STATUS_UNAVAILABLE")?
        .map_err(|_| "OPERATOR_STATUS_TIMEOUT")?;
    let data: Value = serde_json::from_str(&raw)
        .map_err(|_| "OPERATOR_STATUS_INVALID")?;
    if data["href"].as_str() != Some(attempt.url.as_str()) ||
        data["valid"] != true ||
        view.url().map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?.as_str() != attempt.url
    {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    }
    let stop = data["stop"].as_bool().ok_or("OPERATOR_STATUS_INVALID")?;
    let error = data["error"].as_bool().ok_or("OPERATOR_STATUS_INVALID")?;
    let mut guard = state.state.lock()
        .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
    let Some(live) = guard.latest.get_mut(&workspace_id) else {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    };
    // A newer operator action must not inherit the previous observation.
    if live.started != attempt.started || live.url != attempt.url {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    }
    if error {
        live.state = "ERROR";
    } else if stop {
        live.generating_seen = true;
        live.state = "GENERATING";
    } else if live.generating_seen && live.state == "GENERATING" {
        // Loss of Stop is only a UI hint; do not complete the outbox.
        live.state = "POSSIBLY_COMPLETED";
    } else if live.state == "WAITING" &&
        live.started.elapsed() >= Duration::from_secs(90) {
        live.state = "UNKNOWN";
    } else if live.state == "GENERATING" &&
        live.started.elapsed() >= Duration::from_secs(15 * 60) {
        live.state = "UNKNOWN";
    }
    Ok(status_receipt(&workspace_id, live.state))
}

fn status_receipt(workspace_id: &str, phase: &str) -> Value {
    json!({
        "workspaceId": workspace_id, "state": phase,
        "source": "UNVERIFIED_NATIVE_WEBVIEW_UI",
        "deliveryVerified": false, "resultVerified": false,
        "nextPromptAllowed": false
    })
}
