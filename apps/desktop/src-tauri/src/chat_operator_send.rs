// Explicit main-window operator send attempt for one owned WebView2 workspace.
// This fixed-source fallback does not read responses, use the extension popup,
// or provide automated delivery/continuation. Queuing eval is not a send receipt.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::Manager;

#[derive(Default)]
struct OperatorState {
    // Only transient control hints. Canonical PromptOutbox owns all
    // persistent at-most-once operator-send attempts.
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
    if text.trim().is_empty()
        || text.len() > 12_000
        || text
            .chars()
            .any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
    {
        return Err("OPERATOR_PROMPT_INVALID".into());
    }
    let target = webview
        .app_handle()
        .get_webview(&label)
        .ok_or("OPERATOR_BROWSER_CLOSED")?;
    let url = target.url().map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?;
    // The user must have pinned this exact existing ordinary /c/ chat.
    // A bare homepage or foreign conversation is not a safe target.
    let saved_url = crate::chat_bookmarks::verify_operator_send_target(
        webview.app_handle(),
        &workspace_id,
        &url,
    )?;
    let expected_href =
        serde_json::to_string(&saved_url).map_err(|_| "OPERATOR_CHAT_URL_INVALID")?;
    let prompt_digest = format!("{:x}", Sha256::digest(text.as_bytes()));
    let conversation_digest = format!("{:x}", Sha256::digest(saved_url.as_bytes()));
    let encoded = serde_json::to_string(&text).map_err(|_| "OPERATOR_PROMPT_ENCODING_FAILED")?;
    let script = format!(
        r#"(() => {{
      // A queued eval must not send to a different page after navigation.
      if (location.href !== {expected_href} ||
          location.protocol !== 'https:' ||
          location.hostname !== 'chatgpt.com') return;
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
    }})()"#
    );
    // Before ANY possible external effect, atomically persist one
    // digest-only attempt in the shared app-local PromptOutbox. A
    // timeout after reservation may have persisted the intent, so
    // callers must inspect the original ChatGPT conversation, not retry.
    let app = webview.app_handle().clone();
    let reserved_workspace = workspace_id.clone();
    let admitted = tauri::async_runtime::spawn_blocking(move || {
        let root = app
            .path()
            .resource_dir()
            .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
            .join("gateway");
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|_| "OPERATOR_CHAT_DATA_DIR_UNAVAILABLE")?;
        let gateway = app.state::<crate::gateway_session::GatewaySession>();
        gateway.probe_packaged(&root)?;
        gateway.reserve_operator_chat_send(
            &data_dir,
            &reserved_workspace,
            &conversation_digest,
            &prompt_digest,
        )
    })
    .await
    .map_err(|_| "OPERATOR_CHAT_RESERVATION_WORKER_FAILED")??;
    if admitted["reserved"] != true
        || !admitted["attemptId"]
            .as_str()
            .is_some_and(|id| id.len() == 36)
        || admitted["deliveryVerified"] != false
        || admitted["resultVerified"] != false
        || admitted["nextPromptAllowed"] != false
    {
        return Err(admitted["reason"]
            .as_str()
            .filter(|reason| {
                matches!(
                    *reason,
                    "OPERATOR_PROMPT_ALREADY_ATTEMPTED"
                        | "WORKSPACE_PROMPT_PENDING"
                        | "WORKSPACE_BROWSER_ACTION_PENDING"
                )
            })
            .unwrap_or("OPERATOR_CHAT_RESERVATION_UNVERIFIED")
            .into());
    }
    {
        let mut guard = state
            .state
            .lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        guard.latest.insert(
            workspace_id.clone(),
            Attempt {
                url: url.to_string(),
                started: Instant::now(),
                generating_seen: false,
                state: "WAITING",
            },
        );
    }
    // Re-check the exact current bookmark and its durable FULL status while
    // holding the same native lock used by the operator's Mark Full action.
    // The outbox reservation remains held if the outcome is uncertain.
    let queued = crate::chat_bookmarks::queue_operator_send_if_active(
        webview.app_handle(), &workspace_id, &url,
        || target.eval(script).map_err(|_| "OPERATOR_SEND_OUTCOME_UNKNOWN".into()),
    );
    if let Err(error) = queued {
        let mut guard = state.state.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        if let Some(attempt) = guard.latest.get_mut(&workspace_id) {
            attempt.state = "UNKNOWN";
        }
        return Err(error);
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
        let guard = state
            .state
            .lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        guard.latest.get(&workspace_id).cloned()
    };
    let Some(attempt) = current else {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    };
    let view = webview
        .app_handle()
        .get_webview(&label)
        .ok_or("OPERATOR_BROWSER_CLOSED")?;
    let url = view.url().map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?;
    if url.as_str() != attempt.url
        || crate::chat_bookmarks::verify_operator_chat_target(
            webview.app_handle(),
            &workspace_id,
            &url,
        )
        .is_err()
    {
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
      // Match the Companion's latest-turn-only error scope. A historical
      // failed turn must not override the current response or unlock retry.
      const selectors=[
        'main [data-testid^="conversation-turn-"]',
        'main [data-testid="conversation-turn"]',
        'main section[data-turn]',
        'main article[data-turn]'
      ];
      let latest=null;
      for(const selector of selectors){
        const turns=document.querySelectorAll(selector);
        if(turns.length){latest=turns[turns.length-1];break;}
      }
      const error=!!latest && [
        '[data-testid="conversation-turn-error"]',
        '[data-testid="response-error"]'
      ].some(selector=>{
        const el=latest.querySelector(selector);
        return !!el && el.getClientRects().length>0;
      });
      return {
        href:location.href, valid:true,
        stop:visible(['[data-testid="stop-button"]',
          'button[aria-label="Stop generating"]',
          'button[aria-label="Stop response"]', 'button[aria-label="Stop"]']),
        error
      };
    })()"#;
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    view.eval_with_callback(script, move |value| {
        let _ = tx.send(value);
    })
    .map_err(|_| "OPERATOR_STATUS_UNAVAILABLE")?;
    let raw = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(2)))
        .await
        .map_err(|_| "OPERATOR_STATUS_UNAVAILABLE")?
        .map_err(|_| "OPERATOR_STATUS_TIMEOUT")?;
    let data: Value = serde_json::from_str(&raw).map_err(|_| "OPERATOR_STATUS_INVALID")?;
    if data["href"].as_str() != Some(attempt.url.as_str())
        || data["valid"] != true
        || view
            .url()
            .map_err(|_| "OPERATOR_CHAT_URL_UNKNOWN")?
            .as_str()
            != attempt.url
    {
        return Ok(status_receipt(&workspace_id, "UNKNOWN"));
    }
    let stop = data["stop"].as_bool().ok_or("OPERATOR_STATUS_INVALID")?;
    let error = data["error"].as_bool().ok_or("OPERATOR_STATUS_INVALID")?;
    let mut guard = state
        .state
        .lock()
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
    } else if live.state == "WAITING" && live.started.elapsed() >= Duration::from_secs(90) {
        live.state = "UNKNOWN";
    } else if live.state == "GENERATING" && live.started.elapsed() >= Duration::from_secs(15 * 60) {
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
