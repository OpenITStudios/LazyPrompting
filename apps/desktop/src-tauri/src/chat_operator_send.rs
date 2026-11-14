// Explicit main-window operator send attempt for one owned WebView2 workspace.
// This fixed-source fallback does not read responses, use the extension popup,
// or provide automated delivery/continuation. Queuing eval is not a send receipt.
use std::{collections::HashSet, sync::Mutex};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::Manager;

#[derive(Default)]
pub(crate) struct OperatorSendLedger {
    attempted: Mutex<HashSet<(String, String)>>,
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
        let mut attempts = state.attempted.lock()
            .map_err(|_| "OPERATOR_SEND_LEDGER_UNAVAILABLE")?;
        if !attempts.insert((workspace_id.clone(), digest)) {
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
    target.eval(script).map_err(|_| "OPERATOR_SEND_OUTCOME_UNKNOWN")?;
    Ok(json!({
        "workspaceId": workspace_id,
        "status": "UI_ACTION_REQUESTED",
        "sent": false,
        "deliveryVerified": false,
        "resultVerified": false,
        "nextPromptAllowed": false
    }))
}
