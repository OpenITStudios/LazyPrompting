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
#[derive(serde::Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ViewBounds { x: f64, y: f64, width: f64, height: f64 }
fn validated_bounds(bounds: &ViewBounds) -> Result<(LogicalPosition<f64>,LogicalSize<f64>),String> {
    if ![bounds.x,bounds.y,bounds.width,bounds.height].iter().all(|v|v.is_finite()) ||
       bounds.x<0.0 || bounds.y<0.0 || bounds.width<160.0 || bounds.height<120.0 ||
       bounds.x>10000.0 || bounds.y>10000.0 || bounds.width>10000.0 || bounds.height>10000.0 {
        return Err("INVALID_VIEW_BOUNDS".into());
    }
    Ok((LogicalPosition::new(bounds.x,bounds.y),LogicalSize::new(bounds.width,bounds.height)))
}
// A local proof page must never be allowed to navigate to arbitrary localhost
// services or to another origin merely because it uses HTTP(S).
fn allowed_preview_navigation(url: &tauri::Url) -> bool {
    if url.path() != "/browser-preview.html" { return false; }
    match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => matches!(url.host_str(), Some("localhost") | Some("127.0.0.1"))
            && url.port_or_known_default().is_some_and(|port| port == 1425),
        _ => false,
    }
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
pub async fn mount_embedded_view(window: Window, workspace_id: String, bounds: ViewBounds) -> Result<EmbeddedViewSnapshot,String> {
    ensure_main(&window)?;
    let label=label_for(&workspace_id)?;
    let (position,size)=validated_bounds(&bounds)?;
    if window.get_webview(&label).is_none() {
        // Fixed local page only. No renderer-provided URL or external navigation.
        let builder=WebviewBuilder::new(label.clone(),WebviewUrl::App("browser-preview.html".into()))
            .on_navigation(allowed_preview_navigation);
        window.add_child(builder,position,size)
            .map_err(|_|"NATIVE_WEBVIEW_MOUNT_FAILED".to_string())?;
    }
    let view=window.get_webview(&label).ok_or("NATIVE_WEBVIEW_MOUNT_FAILED")?;
    view.set_position(position).map_err(|_|"NATIVE_VIEW_POSITION_FAILED".to_string())?;
    view.set_size(size).map_err(|_|"NATIVE_VIEW_SIZE_FAILED".to_string())?;
    // Hide all other children BEFORE showing the selected one.
    // A failed hide aborts without exposing a second view.
    for n in 1..=10 {
        let other=format!("browser-{n:02}");
        if other!=label {
            if let Some(child)=window.get_webview(&other) {
                child.hide().map_err(|_|"NATIVE_VIEW_HIDE_FAILED".to_string())?;
            }
        }
    }
    view.show().map_err(|_|"NATIVE_VIEW_SHOW_FAILED".to_string())?;
    Ok(EmbeddedViewSnapshot {workspace_id,view_label:label,mounted:true,source:"NATIVE_TAURI_WINDOW_REGISTRY"})
}
#[tauri::command]
pub async fn hide_embedded_views(window: Window) -> Result<(),String> {
    ensure_main(&window)?;
    for n in 1..=10 {
        if let Some(view)=window.get_webview(&format!("browser-{n:02}")) {
            view.hide().map_err(|_|"NATIVE_VIEW_HIDE_FAILED".to_string())?;
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::{label_for,allowed_preview_navigation};
    use tauri::Url;
    #[test] fn preview_navigation_does_not_allow_other_local_services() {
        for url in ["https://example.com/browser-preview.html","http://127.0.0.1:3000/browser-preview.html","http://localhost:1425/admin","file:///browser-preview.html"] {
            assert!(!allowed_preview_navigation(&Url::parse(url).unwrap()));
        }
        assert!(allowed_preview_navigation(&Url::parse("http://127.0.0.1:1425/browser-preview.html").unwrap()));
    }
    #[test] fn only_ten_canonical_slots() {
        for n in 1..=10 {assert_eq!(label_for(&format!("workspace-{n:02}")).unwrap(),format!("browser-{n:02}"));}
        for bad in ["workspace-00","workspace-11","workspace-1","workspace-01x","other-01","workspace-99"] {assert!(label_for(bad).is_err());}
    }
}
