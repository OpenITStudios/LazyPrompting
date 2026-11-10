// Ten-slot embedded WebView proof. Native host owns identity, URL and lifecycle.
// Local preview only; no external navigation, shared-session claims or Lightpanda control.
use serde::Serialize;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl, Window};
use tauri::webview::WebviewBuilder;

fn label_for(workspace_id: &str) -> Result<String, String> {
    let number = workspace_id.strip_prefix("workspace-").ok_or("INVALID_WORKSPACE")?;
    if number.len()!=2 || !number.bytes().all(|b|b.is_ascii_digit()) { return Err("INVALID_WORKSPACE".into()); }
    let n: u8 = number.parse().map_err(|_| "INVALID_WORKSPACE")?;
    if !(1..=10).contains(&n) { return Err("INVALID_WORKSPACE".into()); }
    Ok(format!("browser-{number}"))
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct EmbeddedViewSnapshot {
    pub workspace_id: String,
    pub view_label: String,
    pub mounted: bool,
    pub source: &'static str,
}
fn ensure_main(window: &Window) -> Result<(), String> {
    if window.label()!="main" { Err("INVALID_PARENT_WINDOW".into()) } else { Ok(()) }
}
#[tauri::command]
pub async fn embedded_view_snapshot(window: Window, workspace_id: String) -> Result<EmbeddedViewSnapshot,String> {
    ensure_main(&window)?;
    let label=label_for(&workspace_id)?;
    Ok(EmbeddedViewSnapshot {workspace_id, mounted:window.get_webview(&label).is_some(),view_label:label,source:"NATIVE_TAURI_WINDOW_REGISTRY"})
}
#[tauri::command]
pub async fn mount_embedded_view(window: Window, workspace_id: String) -> Result<EmbeddedViewSnapshot,String> {
    ensure_main(&window)?;
    let label=label_for(&workspace_id)?;
    if window.get_webview(&label).is_none() {
        // Fixed local page only. No renderer-provided URL or external navigation.
        let builder=WebviewBuilder::new(label.clone(),WebviewUrl::App("browser-preview.html".into()))
            .on_navigation(|url| matches!(url.scheme(),"tauri"|"http"|"https")
                && matches!(url.host_str(),Some("localhost")|Some("tauri.localhost")|Some("127.0.0.1")));
        window.add_child(builder,LogicalPosition::new(220.0,100.0),LogicalSize::new(700.0,500.0))
            .map_err(|_|"NATIVE_WEBVIEW_MOUNT_FAILED".to_string())?;
    }
    Ok(EmbeddedViewSnapshot {workspace_id,view_label:label,mounted:true,source:"NATIVE_TAURI_WINDOW_REGISTRY"})
}
#[cfg(test)]
mod tests {
    use super::label_for;
    #[test] fn only_ten_canonical_slots() {
        for n in 1..=10 {assert_eq!(label_for(&format!("workspace-{n:02}")).unwrap(),format!("browser-{n:02}"));}
        for bad in ["workspace-00","workspace-11","workspace-1","workspace-01x","other-01","workspace-99"] {assert!(label_for(bad).is_err());}
    }
}
