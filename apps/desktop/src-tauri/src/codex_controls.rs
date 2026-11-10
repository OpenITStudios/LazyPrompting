use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};

use crate::gateway_session::GatewaySession;
use crate::lightpanda_admission::workspace_allowed;
use crate::lightpanda_controls::{PreviewAction, PreviewControls, BINARY_ENV};

#[derive(Default)]
pub(crate) struct CodexControls(Mutex<()>);

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum CodexAction {
    Dispatch {
        cwd: String,
        prompt: String,
        #[serde(rename = "followUp")]
        follow_up: Option<String>,
        #[serde(rename = "expectedResponse")]
        expected_response: Option<String>,
    },
    Observe,
    Stop,
}

#[tauri::command]
pub(crate) async fn managed_codex(
    webview: WebviewWindow,
    workspace_id: String,
    request: CodexAction,
) -> Result<Value, String> {
    if webview.label() != "main" || !workspace_allowed(&workspace_id) {
        return Err("INVALID_CODEX_SCOPE".into());
    }
    let owner = webview.hwnd().map_err(|_| "CODEX_WINDOW_UNAVAILABLE")?.0 as usize;
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<CodexControls>();
        let _guard = state.0.try_lock().map_err(|_| "CODEX_BUSY")?;
        let executable = std::env::var_os("LAZYPROMPTING_CODEX_EXE")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute() && path.is_file())
            .ok_or("CODEX_EXECUTABLE_NOT_CONFIGURED")?;
        let data_dir = app.path().app_local_data_dir().map_err(|_| "CODEX_DATA_DIR_UNAVAILABLE")?
            .join("managed-codex");
        let mut params = json!({"workspaceId":workspace_id,"dataDir":data_dir,"executable":executable});
        match request {
            CodexAction::Dispatch { cwd, prompt, follow_up, expected_response } => {
                if cwd.len() > 2048 || prompt.chars().count() > 1_200 || prompt.trim().is_empty() || prompt.contains('\0') {
                    return Err("INVALID_CODEX_WORKSPACE_INPUT".into());
                }
                let cwd = PathBuf::from(cwd);
                if !cwd.is_absolute() || !cwd.is_dir() {
                    return Err("CODEX_WORKSPACE_DIRECTORY_REQUIRED".into());
                }
                let directory = dunce::canonicalize(cwd).map_err(|_| "CODEX_WORKSPACE_DIRECTORY_REQUIRED")?;
                let mut message = format!(
                    "Send one read-only Codex turn for {workspace_id} in {}? This uses the signed-in Codex account.\n\nTask:\n{prompt}",
                    directory.display()
                );
                match (follow_up, expected_response) {
                    (None, None) => {}
                    (Some(next), Some(expected)) if !next.trim().is_empty()
                        && !expected.trim().is_empty() && next.encode_utf16().count() <= 600
                        && expected.encode_utf16().count() <= 300
                        && !next.contains('\0') && !expected.contains('\0') => {
                            message.push_str(&format!(
                                "\n\nIf the verified response exactly matches:\n{expected}\n\nSend one read-only follow-up:\n{next}"
                            ));
                            params["followUp"] = json!(next);
                            params["expectedResponse"] = json!(expected);
                        }
                    _ => return Err("INVALID_CODEX_CONTINUATION".into()),
                }
                if !crate::operator_confirmation::confirm(owner, "LazyPrompting · Codex permission", &message) {
                    return Err("CODEX_DISPATCH_NOT_APPROVED".into());
                }
                params["action"] = json!("dispatch");
                params["cwd"] = json!(directory);
                params["prompt"] = json!(prompt);
            }
            CodexAction::Observe => params["action"] = json!("observe"),
            CodexAction::Stop => params["action"] = json!("stop"),
        }
        if app.get_webview_window("main").is_none() {
            return Err("CODEX_WINDOW_UNAVAILABLE".into());
        }
        let root = app.path().resource_dir().map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?.join("gateway");
        let gateway = app.state::<GatewaySession>();
        gateway.probe_packaged(&root)?;
        let result = gateway.request_codex(params.clone())?;
        if result["status"] != "TOOL_REQUEST" {
            return Ok(result);
        }
        service_preview_tool(
            &gateway,
            &app.state::<PreviewControls>(),
            params,
            result,
            std::env::var(BINARY_ENV).ok().as_deref(),
            |message| crate::operator_confirmation::confirm(
                owner, "LazyPrompting · Codex preview permission", message
            ) && app.get_webview_window("main").is_some(),
        )
    }).await.map_err(|_| "CODEX_WORKER_FAILED")?
}

pub(crate) fn service_preview_tool(
    gateway: &GatewaySession,
    preview: &PreviewControls,
    mut params: Value,
    request: Value,
    binary: Option<&str>,
    confirm: impl FnOnce(&str) -> bool,
) -> Result<Value, String> {
    let workspace = params["workspaceId"]
        .as_str()
        .filter(|id| workspace_allowed(id))
        .ok_or("INVALID_CODEX_SCOPE")?
        .to_owned();
    let action: PreviewAction = serde_json::from_value(request["action"].clone())
        .map_err(|_| "INVALID_CODEX_PREVIEW_ACTION")?;
    let token = request["token"]
        .as_str()
        .filter(|token| {
            token.len() == 36
                && token
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
        })
        .ok_or("INVALID_CODEX_TOOL_TOKEN")?;
    let message = format!(
        "Codex requests permission to {} for {workspace}. Allow this operation once?",
        action.description()
    );
    params["action"] = json!("claimTool");
    params["toolToken"] = json!(token);
    params["approved"] = json!(confirm(&message));
    if gateway.request_codex(params.clone())?["status"] != "TOOL_CLAIMED" {
        return Ok(json!({"status":"WAITING","reason":"CODEX_PREVIEW_NOT_APPROVED"}));
    }
    let result = match preview.invoke_approved(gateway, &workspace, action, binary) {
        Ok(value) => json!({"ok":true,"preview":value}),
        Err(error) => json!({"ok":false,"error":error}),
    };
    params["action"] = json!("answerTool");
    params["toolResult"] = result;
    gateway.request_codex(params)
}
