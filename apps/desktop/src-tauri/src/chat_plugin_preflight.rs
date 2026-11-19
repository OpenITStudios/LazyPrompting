// Native scope-only preflight for an eventual ChatGPT-hosted plugin goal.
// Main window only. Never calls the gateway, displays OAuth data, reserves
// a PromptOutbox row, sends ChatGPT content or grants execution.
use serde_json::{json, Value};
use tauri::Manager;

fn project_checked_scope(workspace_id: &str, run_id: &str) -> Value {
    json!({
        "source":"NATIVE_CHAT_PLUGIN_SOURCE_PREFLIGHT",
        "status":"OAUTH_AND_OPERATOR_BINDING_REQUIRED",
        "workspaceId":workspace_id,
        "runId":run_id,
        "codexSourceReviewed":true,
        "chatBookmarkMatched":true,
        "oauthVerified":false,
        "operatorChatApproved":false,
        "chatSessionVerified":false,
        "pluginAuthorized":false,
        "sent":false,
        "qa":"NOT_EXECUTED",
        "nextPromptAllowed":false
    })
}

#[tauri::command]
pub(crate) async fn chat_plugin_scope_preflight(
    webview: tauri::Webview,
    workspace_id: String,
    run_id: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("CHAT_PLUGIN_MAIN_WINDOW_REQUIRED".into());
    }
    crate::embedded_webview::label_for(&workspace_id)?;
    if run_id.len() != 69 {
        return Err("CHAT_PLUGIN_RUN_ID_INVALID".into());
    }
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let goal = crate::goal_runs::chat_plugin_source_preflight(&app, &run_id)?;
        let chat = crate::chat_bookmarks::plugin_chat_digest(&app, &workspace_id)?;
        // Repeat after both independent reads. A navigation or source change
        // during the check is a hold, not a positive scope result.
        if goal != crate::goal_runs::chat_plugin_source_preflight(&app, &run_id)?
            || chat != crate::chat_bookmarks::plugin_chat_digest(&app, &workspace_id)?
        {
            return Err("CHAT_PLUGIN_SOURCE_RECONCILE_REQUIRED".into());
        }
        Ok(project_checked_scope(&workspace_id, &run_id))
    })
    .await
    .map_err(|_| "CHAT_PLUGIN_PREFLIGHT_WORKER_UNAVAILABLE".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preflight_projection_is_never_an_execution_grant() {
        let value = project_checked_scope(
            "workspace-01",
            "12345678-1234-1234-1234-123456789abc.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        assert_eq!(value["codexSourceReviewed"], true);
        assert_eq!(value["chatBookmarkMatched"], true);
        assert_eq!(value["pluginAuthorized"], false);
        assert_eq!(value["oauthVerified"], false);
        assert_eq!(value["operatorChatApproved"], false);
        assert_eq!(value["chatSessionVerified"], false);
        assert_eq!(value["nextPromptAllowed"], false);
        assert_eq!(value["sent"], false);
    }
}
