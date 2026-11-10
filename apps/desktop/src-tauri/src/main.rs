#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::State;
mod browser_admission;
mod embedded_webview;
mod lightpanda_host;
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
fn list_shared_profile_views(registry: State<'_, SharedProfileRegistry>) -> Result<Vec<ViewBinding>, String> {
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

fn main() {
    tauri::Builder::default()
        .manage(SharedProfileRegistry::default())
        .invoke_handler(tauri::generate_handler![runtime_status, list_shared_profile_views, webview_provider_status, scheduler_host_status, embedded_webview::mount_embedded_view, embedded_webview::embedded_view_snapshot, embedded_webview::hide_embedded_views, lightpanda_host::lightpanda_host_status, lightpanda_host::lightpanda_probe, lightpanda_host::lightpanda_discover, lightpanda_host::lightpanda_handshake, lightpanda_host::lightpanda_protocol_probe])
        .run(tauri::generate_context!())
        .expect("LazyPrompting desktop startup failed");
}
