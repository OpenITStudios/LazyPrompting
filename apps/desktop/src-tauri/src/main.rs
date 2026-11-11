#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::{Manager, State};
mod browser_admission;
#[cfg(windows)]
mod codex_controls;
mod embedded_webview;
mod gateway_child;
mod gateway_integrity;
mod gateway_reader;
mod gateway_session;
mod gateway_stdio;
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
mod browser_mcp_pipe;
#[cfg(windows)]
mod chat_fixture_native;
#[cfg(windows)]
mod goal_runs;
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
        .manage(gateway_session::GatewaySession::default());
    #[cfg(windows)]
    let builder = builder
        .manage(lightpanda_controls::PreviewControls::default())
        .manage(codex_controls::CodexControls::default())
        .manage(chat_fixture_native::FixtureChatState::default());
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
            lightpanda_controls::lightpanda_preview,
            #[cfg(windows)]
            codex_controls::managed_codex,
            embedded_webview::mount_embedded_view,
            embedded_webview::embedded_view_snapshot,
            embedded_webview::close_embedded_view,
            embedded_webview::hide_embedded_views,
            embedded_webview::browser_action,
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
                let _ = app.state::<gateway_session::GatewaySession>().stop();
            }
        });
}
