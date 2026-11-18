use serde::Deserialize;
use serde_json::{json, Value};
use tauri::Manager;

const API_WORKSPACE: &str = "api-workspace-01";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ApiGoalSettings {
    goal: String,
    model: String,
    max_turns: u8,
    max_output_tokens: u16,
    max_total_tokens: u32,
}
impl ApiGoalSettings {
    fn validate(&self) -> Result<(), &'static str> {
        let model = self.model.as_bytes();
        if self.goal.trim().is_empty()
            || self.goal.len() > 2000
            || self
                .goal
                .chars()
                .any(|c| c.is_control() && c != '\n' && c != '\t')
            || !(1..=5).contains(&self.max_turns)
            || !(256..=2048).contains(&self.max_output_tokens)
            || !(2048..=80000).contains(&self.max_total_tokens)
            || model.len() < 2
            || model.len() > 80
            || !model[0].is_ascii_alphabetic()
            || !model
                .iter()
                .all(|b| b.is_ascii_alphanumeric() || matches!(*b, b'-' | b'_' | b'.'))
        {
            return Err("API_GOAL_INVALID_SETTINGS");
        }
        Ok(())
    }
}
fn api_gateway(app: &tauri::AppHandle, action: &str, extra: Value) -> Result<Value, String> {
    if !matches!(action, "start" | "status" | "stop") || !extra.is_object() {
        return Err("API_GOAL_INVALID_ACTION".into());
    }
    let root = app
        .path()
        .resource_dir()
        .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
        .join("gateway");
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "API_GOAL_DATA_DIR_UNAVAILABLE")?;
    let gateway = app.state::<crate::gateway_session::GatewaySession>();
    gateway.probe_packaged(&root)?;
    let mut p = json!({"action":action,"workspaceId":API_WORKSPACE,
        "dataDir":data_dir.to_string_lossy()});
    let pairs = extra.as_object().ok_or("API_GOAL_INVALID_ACTION")?;
    for (key, value) in pairs {
        if matches!(key.as_str(), "action" | "workspaceId" | "dataDir") {
            return Err("API_GOAL_INVALID_ACTION".into());
        }
        p[key] = value.clone();
    }
    gateway.request_api_goal(p)
}

#[tauri::command]
pub(crate) async fn api_goal_start(
    window: tauri::WebviewWindow,
    settings: ApiGoalSettings,
) -> Result<Value, String> {
    if window.label() != "main" {
        return Err("API_GOAL_MAIN_WINDOW_REQUIRED".into());
    }
    settings.validate()?;
    let owner = window.hwnd().map_err(|_| "API_GOAL_WINDOW_UNAVAILABLE")?.0 as usize;
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move||{
        let explanation=format!(
          "Start one OpenAI Platform API goal?\n\nThis is NOT your ordinary ChatGPT conversation. API usage is billed separately.\n\nModel: {}\nMax model turns: {}\nMax output tokens per turn: {}\nTotal-token stop threshold (not a strict price cap): {}\n\nGoal:\n{}\n\nEach model-generated next prompt is allowed ONLY inside this bounded run. STOP prevents new turns. Configure project hard-spend limits separately.",
          settings.model,settings.max_turns,settings.max_output_tokens,
          settings.max_total_tokens,settings.goal
        );
        if !crate::operator_confirmation::confirm(
            owner,"LazyPrompting · Approve billed API goal",&explanation
        ){
            return Err("API_GOAL_OPERATOR_DECLINED".into());
        }
        if app.get_webview_window("main").is_none(){
            return Err("API_GOAL_MAIN_WINDOW_CLOSED".into());
        }
        // GatewayChild clears inherited environment. Load the key only
        // AFTER native operator approval, then send once over the local
        // authenticated gateway RPC. Never expose it to the renderer.
        let api_key=std::env::var("OPENAI_API_KEY")
            .map_err(|_|"OPENAI_API_KEY_OR_CLIENT_UNAVAILABLE")?;
        if api_key.len()<20||api_key.len()>512||
           !api_key.bytes().all(|b|b.is_ascii_graphic()) {
            return Err("OPENAI_API_KEY_OR_CLIENT_UNAVAILABLE".into());
        }
        api_gateway(&app,"start",json!({
            "apiKey":api_key,
            "goal":settings.goal,
            "model":settings.model,
            "maxTurns":settings.max_turns,
            "maxOutputTokens":settings.max_output_tokens,
            "maxTotalTokens":settings.max_total_tokens
        }))
    }).await.map_err(|_|"API_GOAL_WORKER_FAILED")?
}

fn valid_run_id(run_id: &str) -> bool {
    let bytes = run_id.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(i, b)| {
            if matches!(i, 8 | 13 | 18 | 23) {
                *b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
async fn api_existing(
    window: tauri::WebviewWindow,
    action: &'static str,
    run_id: String,
) -> Result<Value, String> {
    if window.label() != "main" || !valid_run_id(&run_id) {
        return Err("API_GOAL_RUN_SCOPE_INVALID".into());
    }
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || api_gateway(&app, action, json!({"runId":run_id})))
        .await
        .map_err(|_| "API_GOAL_WORKER_FAILED")?
}
#[tauri::command]
pub(crate) async fn api_goal_status(
    window: tauri::WebviewWindow,
    run_id: Option<String>,
) -> Result<Value, String> {
    if window.label() != "main" || run_id.as_deref().is_some_and(|id| !valid_run_id(id)) {
        return Err("API_GOAL_RUN_SCOPE_INVALID".into());
    }
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        api_gateway(&app, "status", json!({"runId":run_id}))
    })
    .await
    .map_err(|_| "API_GOAL_WORKER_FAILED")?
}
#[tauri::command]
pub(crate) async fn api_goal_stop(
    window: tauri::WebviewWindow,
    run_id: String,
) -> Result<Value, String> {
    api_existing(window, "stop", run_id).await
}

#[cfg(test)]
mod tests {
    use super::{valid_run_id, ApiGoalSettings};
    #[test]
    fn native_api_billing_settings_are_bounded() {
        let ok = ApiGoalSettings {
            goal: "Inspect source".into(),
            model: "gpt-6-astra".into(),
            max_turns: 3,
            max_output_tokens: 1024,
            max_total_tokens: 10000,
        };
        assert!(ok.validate().is_ok());
        assert!(!valid_run_id("workspace-01"));
        assert!(valid_run_id("11111111-1111-1111-1111-111111111111"));
        let mut bad = ok;
        bad.max_turns = 6;
        assert!(bad.validate().is_err());
        bad.max_turns = 3;
        bad.model = "curl://localhost".into();
        assert!(bad.validate().is_err());
        bad.model = "gpt-6-astra".into();
        bad.goal = "\0".into();
        assert!(bad.validate().is_err());
    }
}
