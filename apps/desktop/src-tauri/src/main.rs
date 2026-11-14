#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::{Manager, State};
mod browser_admission;
#[cfg(windows)]
mod browser_mcp_pipe;
#[cfg(windows)]
mod chat_fixture_native;
#[cfg(windows)]
mod chat_manual_handoff;
#[cfg(windows)]
mod chat_operator_send;
#[cfg(windows)]
mod chat_bookmarks;
#[cfg(windows)]
mod codex_controls;
#[cfg(windows)]
mod agent_worker_profiles;
#[cfg(windows)]
mod agent_goal_authority;
#[cfg(windows)]
mod agent_worker_job;
#[cfg(windows)]
mod agent_worker_appcontainer;
#[cfg(windows)]
mod agent_worker_spawn;
#[cfg(windows)]
mod agent_worker_snapshot;
#[cfg(windows)]
mod agent_worker_snapshot_acl;
#[cfg(windows)]
mod agent_worker_io;
#[cfg(windows)]
mod agent_worker_stdio;
#[cfg(windows)]
mod agent_worker_io_pump;
mod embedded_webview;
mod browser_support_tabs;
#[cfg(windows)]
mod browser_tab_sessions;
mod gateway_child;
mod gateway_integrity;
mod gateway_reader;
mod gateway_session;
mod gateway_stdio;
#[cfg(windows)]
mod goal_runs;
mod lightpanda_admission;
#[cfg(windows)]
mod lightpanda_controls;
mod lightpanda_grants;
mod lightpanda_host;
#[cfg(windows)]
mod lightpanda_private;
#[cfg(windows)]
mod mcp_stdio_host;
#[cfg(windows)]
mod mcp_workspace_leases;
mod native_ipc_auth;
mod native_ipc_frame;
#[cfg(windows)]
mod native_ipc_pipe;
#[cfg(windows)]
mod operator_confirmation;
mod resource_budget;
mod shared_profile_registry;
mod webview_provider;
use shared_profile_registry::{SharedProfileRegistry, ViewBinding};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStatus {
    mode: &'static str,
    max_workspaces: usize,
    active_browser_instances: usize,
    transport_connected: bool,
    automation_enabled: bool,
}

#[tauri::command]
fn runtime_status() -> RuntimeStatus {
    RuntimeStatus {
        mode: "SOURCE_FOUNDATION",
        max_workspaces: 10,
        active_browser_instances: 0,
        transport_connected: false,
        automation_enabled: false,
    }
}

#[tauri::command]
fn list_shared_profile_views(
    registry: State<'_, SharedProfileRegistry>,
) -> Result<Vec<ViewBinding>, String> {
    registry.snapshot()
}

#[tauri::command]
fn webview_provider_status() -> webview_provider::WebviewProviderStatus {
    webview_provider::status()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SchedulerHostStatus {
    source: &'static str,
    connected: bool,
    authenticated: bool,
    snapshot: Option<()>,
    reason: &'static str,
}

// Host-owned status; never accept renderer-provided trusted flags.
#[tauri::command]
fn scheduler_host_status() -> SchedulerHostStatus {
    SchedulerHostStatus {
        source: "NATIVE_HOST",
        connected: false,
        authenticated: false,
        snapshot: None,
        reason: "TRUSTED_SCHEDULER_NOT_CONFIGURED",
    }
}

#[tauri::command]
async fn probe_gateway(webview: tauri::WebviewWindow) -> Result<(), &'static str> {
    if webview.label() != "main" {
        return Err("INVALID_GATEWAY_CALLER");
    }
    let app = webview.app_handle().clone();
    let root = app
        .path()
        .resource_dir()
        .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
        .join("gateway");
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<gateway_session::GatewaySession>()
            .probe_packaged(&root)
    })
    .await
    .map_err(|_| "GATEWAY_PROBE_FAILED")?
}

// Native status discovery is read-only and cannot bind or activate any worker.
// The gateway is packaged and authenticated before its private v2 call is made.
#[cfg(windows)]
#[tauri::command]
async fn agent_gateway_status(webview: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
    if webview.label() != "main" {
        return Err("INVALID_AGENT_GATEWAY_CALLER".into());
    }
    let app = webview.app_handle().clone();
    let root = app.path().resource_dir()
        .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
        .join("gateway");
    tauri::async_runtime::spawn_blocking(move || {
        let gateway = app.state::<gateway_session::GatewaySession>();
        gateway.probe_packaged(&root).map_err(str::to_owned)?;
        gateway.request_agent(&app, serde_json::json!({"action":"status"}))
    }).await.map_err(|_| "AGENT_GATEWAY_STATUS_FAILED".to_owned())?
}


// A single authority boundary for all read-only prepared-goal diagnostics.
// No renderer-provided fields except exact runId and fixed action reach Node.
#[cfg(windows)]
async fn agent_gateway_read_only(
    webview: tauri::WebviewWindow,
    run_id: String,
    action: &'static str,
) -> Result<serde_json::Value, String> {
    if webview.label() != "main" {
        return Err("INVALID_AGENT_GATEWAY_CALLER".into());
    }
    let Some((id, suffix)) = run_id.split_once('.') else {
        return Err("INVALID_AGENT_RUN_ID".into());
    };
    if id.len() != 36 || suffix.len() != 32 ||
        !id.bytes().enumerate().all(|(i, b)| {
            if matches!(i, 8 | 13 | 18 | 23) { b == b'-' }
            else { b.is_ascii_hexdigit() }
        }) || !suffix.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("INVALID_AGENT_RUN_ID".into());
    }
    if !matches!(action, "inspect" | "source") {
        return Err("INVALID_AGENT_GATEWAY_ACTION".into());
    }
    let app = webview.app_handle().clone();
    let root = app.path().resource_dir()
        .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
        .join("gateway");
    tauri::async_runtime::spawn_blocking(move || {
        let gateway = app.state::<gateway_session::GatewaySession>();
        gateway.probe_packaged(&root).map_err(str::to_owned)?;
        gateway.request_agent(&app, serde_json::json!({
            "action": action, "runId": run_id.to_ascii_lowercase()
        }))
    }).await.map_err(|_| "AGENT_GATEWAY_READ_FAILED".to_owned())?
}

#[cfg(windows)]
#[tauri::command]
async fn agent_gateway_inspect(
    webview: tauri::WebviewWindow,
    run_id: String,
) -> Result<serde_json::Value, String> {
    agent_gateway_read_only(webview, run_id, "inspect").await
}

#[cfg(windows)]
#[tauri::command]
async fn agent_gateway_source_binding(
    webview: tauri::WebviewWindow,
    run_id: String,
) -> Result<serde_json::Value, String> {
    agent_gateway_read_only(webview, run_id, "source").await
}

fn main() {
    #[cfg(windows)]
    if std::env::args().nth(1).as_deref() == Some("mcp") {
        if let Err(error) = mcp_stdio_host::run() {
            eprintln!("LazyPrompting MCP: {error}");
            std::process::exit(1);
        }
        return;
    }
    let builder = tauri::Builder::default()
        .manage(SharedProfileRegistry::default())
        .manage(gateway_session::GatewaySession::default())
        .manage(browser_support_tabs::BrowserSupportTabs::default());
    #[cfg(windows)]
    let builder = builder
        .manage(lightpanda_controls::PreviewControls::default())
        .manage(codex_controls::CodexControls::default())
        .manage(agent_worker_job::NativeWorkerJobs::default())
        .manage(chat_fixture_native::FixtureChatState::default())
        .manage(chat_operator_send::OperatorSendLedger::default());
    builder
        .setup(|app| {
            #[cfg(windows)]
            {
                browser_mcp_pipe::start(app.handle().clone())?;
                goal_runs::resume_interrupted(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            runtime_status,
            list_shared_profile_views,
            webview_provider_status,
            scheduler_host_status,
            probe_gateway,
            #[cfg(windows)]
            agent_gateway_status,
            #[cfg(windows)]
            agent_gateway_inspect,
            #[cfg(windows)]
            agent_gateway_source_binding,
            #[cfg(windows)]
            lightpanda_controls::lightpanda_preview,
            #[cfg(windows)]
            codex_controls::managed_codex,
            #[cfg(windows)]
            agent_worker_profiles::list_agent_worker_profiles,
            embedded_webview::mount_embedded_view,
            embedded_webview::embedded_view_snapshot,
            embedded_webview::close_embedded_view,
            embedded_webview::hide_embedded_views,
            embedded_webview::browser_action,
            browser_support_tabs::browser_tabs_snapshot,
            browser_support_tabs::open_support_tab,
            browser_support_tabs::select_browser_tab,
            browser_support_tabs::close_support_tab,
            browser_support_tabs::browser_active_action,
            #[cfg(windows)]
            browser_tab_sessions::save_browser_tabs,
            #[cfg(windows)]
            browser_tab_sessions::read_saved_browser_tabs,
            #[cfg(windows)]
            chat_bookmarks::chat_bookmark_status,
            #[cfg(windows)]
            chat_bookmarks::save_chat_bookmark,
            #[cfg(windows)]
            chat_bookmarks::restore_chat_bookmark,
            #[cfg(windows)]
            chat_bookmarks::forget_chat_bookmark,
            #[cfg(windows)]
            chat_operator_send::operator_send_once,
            #[cfg(windows)]
            chat_operator_send::operator_chat_status,
            lightpanda_host::lightpanda_host_status,
            lightpanda_host::lightpanda_probe,
            lightpanda_host::lightpanda_discover,
            lightpanda_host::lightpanda_handshake,
            lightpanda_host::lightpanda_protocol_probe
        ])
        .build(tauri::generate_context!())
        .expect("LazyPrompting desktop startup failed")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                #[cfg(windows)]
                app.state::<lightpanda_controls::PreviewControls>().stop();
                #[cfg(windows)]
                app.state::<agent_worker_job::NativeWorkerJobs>().stop_all();
                let _ = app.state::<gateway_session::GatewaySession>().stop();
            }
        });
}
