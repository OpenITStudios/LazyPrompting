#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::State;
mod instance_registry;
mod browser_admission;
mod resource_budget;
use instance_registry::{Instance, InstanceRegistry};

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
fn list_workspace_instances(registry: State<'_, InstanceRegistry>) -> Result<Vec<Instance>, String> {
    registry.list()
}

fn main() {
    tauri::Builder::default()
        .manage(InstanceRegistry::default())
        .invoke_handler(tauri::generate_handler![runtime_status, list_workspace_instances])
        .run(tauri::generate_context!())
        .expect("LazyPrompting desktop startup failed");
}
