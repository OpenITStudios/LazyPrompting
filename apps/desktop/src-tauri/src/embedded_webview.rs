// Explicit, local-only proof-of-concept for one embedded WebView.
// No external URL, authentication, Lightpanda control, or automatic startup.
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl, Window};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedViewSnapshot {
    pub workspace_id: &'static str,
    pub view_label: &'static str,
    pub mounted: bool,
    pub source: &'static str,
}

#[tauri::command]
pub async fn browser_01_snapshot(window: Window) -> Result<EmbeddedViewSnapshot, String> {
    if window.label() != "main" { return Err("INVALID_PARENT_WINDOW".into()); }
    Ok(EmbeddedViewSnapshot {
        workspace_id: "workspace-01",
        view_label: "browser-01",
        mounted: window.get_webview("browser-01").is_some(),
        source: "NATIVE_TAURI_WINDOW_REGISTRY",
    })
}

use tauri::webview::WebviewBuilder;

#[tauri::command]
pub async fn mount_browser_01(window: Window) -> Result<&'static str, String> {
    if window.label() != "main" { return Err("INVALID_PARENT_WINDOW".into()); }
    if window.get_webview("browser-01").is_some() { return Ok("ALREADY_MOUNTED"); }
    // Fixed local proof page; never accept a renderer-supplied URL.
    let builder = WebviewBuilder::new("browser-01", WebviewUrl::App("browser-preview.html".into()))
        .on_navigation(|url| {
            // No external navigation in the admission proof.
            matches!(url.scheme(), "tauri" | "http" | "https")
                && (url.host_str() == Some("localhost") || url.host_str() == Some("tauri.localhost"))
        });
    window.add_child(builder, LogicalPosition::new(220.0, 100.0), LogicalSize::new(700.0, 500.0))
        .map_err(|_| "NATIVE_WEBVIEW_MOUNT_FAILED".to_string())?;
    Ok("MOUNTED_LOCAL_PROOF")
}
