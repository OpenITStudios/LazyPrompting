// The workspaces are tabs in one browser profile, separate from the app shell.
// Ordinary ChatGPT Chat is the default; Temporary Chat is not a supported workspace mode.
const ORDINARY_CHAT_HOME: &str = "https://chatgpt.com/";
use serde::Serialize;
use tauri::webview::WebviewBuilder;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl, Window};

pub(crate) fn set_memory_saving(view: &tauri::Webview, enabled: bool) {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows_core::Interface;

        // This is a best-effort hint. Older runtimes can still show and hide views.
        let _ = view.with_webview(move |platform| unsafe {
            if let Ok(webview) = platform
                .controller()
                .CoreWebView2()
                .and_then(|core| core.cast::<ICoreWebView2_19>())
            {
                let level = if enabled {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                } else {
                    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                };
                let _ = webview.SetMemoryUsageTargetLevel(level);
            }
        });
    }
    #[cfg(not(windows))]
    let _ = (view, enabled);
}

pub(crate) fn label_for(workspace_id: &str) -> Result<String, String> {
    let number = workspace_id
        .strip_prefix("workspace-")
        .ok_or("INVALID_WORKSPACE")?;
    if number.len() != 2 || !number.bytes().all(|b| b.is_ascii_digit()) {
        return Err("INVALID_WORKSPACE".into());
    }
    let n: u8 = number.parse().map_err(|_| "INVALID_WORKSPACE")?;
    if !(1..=10).contains(&n) {
        return Err("INVALID_WORKSPACE".into());
    }
    Ok(format!("browser-{number}"))
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedViewSnapshot {
    pub workspace_id: String,
    pub view_label: String,
    pub mounted: bool,
    pub source: &'static str,
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}
pub(crate) fn validated_bounds(
    bounds: &ViewBounds,
) -> Result<(LogicalPosition<f64>, LogicalSize<f64>), String> {
    if ![bounds.x, bounds.y, bounds.width, bounds.height]
        .iter()
        .all(|v| v.is_finite())
        || bounds.x < 0.0
        || bounds.y < 0.0
        || bounds.width < 160.0
        || bounds.height < 120.0
        || bounds.x > 10000.0
        || bounds.y > 10000.0
        || bounds.width > 10000.0
        || bounds.height > 10000.0
    {
        return Err("INVALID_VIEW_BOUNDS".into());
    }
    Ok((
        LogicalPosition::new(bounds.x, bounds.y),
        LogicalSize::new(bounds.width, bounds.height),
    ))
}
fn is_temporary_chatgpt_url(url: &tauri::Url) -> bool {
    matches!(
        url.host_str(),
        Some("chatgpt.com" | "www.chatgpt.com" | "chat.openai.com")
    ) && url.query_pairs().any(|(key, _)| {
        key.eq_ignore_ascii_case("temporary-chat")
            || key.eq_ignore_ascii_case("temporary_chat")
            || key.eq_ignore_ascii_case("temporarychat")
    })
}

fn allowed_browser_navigation(url: &tauri::Url) -> bool {
    url.as_str() == "about:blank"
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some_and(|host| {
                !host.trim_end_matches('.').ends_with(".localhost")
                    && !(cfg!(dev)
                        && matches!(host, "localhost" | "127.0.0.1")
                        && url.port() == Some(1425))
            })
            && url.username().is_empty()
            && url.password().is_none()
            && !is_temporary_chatgpt_url(url))
}
pub(crate) fn browser_address(address: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(address.trim()).map_err(|_| "INVALID_BROWSER_ADDRESS")?;
    if address.len() > 2048
        || !matches!(url.scheme(), "http" | "https")
        || !allowed_browser_navigation(&url)
    {
        return Err("INVALID_BROWSER_ADDRESS".into());
    }
    Ok(url)
}

// Debug mode is not a permission to load an arbitrary unpacked extension.
// Pin manifest plus executable scripts independently of the WebView2 profile.
#[cfg(windows)]
fn verify_fixture_extension_assets(extension: &std::path::Path) -> Result<(), &'static str> {
    use sha2::Digest as _;
    for (filename, expected_sha256) in [
        (
            "manifest.json",
            "c2a9d9611e8b036b55ff96f6d505c292e5a5d0f6d24821520564f292bd32d2dc",
        ),
        (
            "background.js",
            "d60b0431b96b6d2c1a835c45635271b3a6c4e08ee2d804bd0d87d9688d283403",
        ),
        (
            "content-script.js",
            "d135a579fc2f2308203a094e5f183c7fca72f5fe5e6a2ceba45f3fff5f0f9d33",
        ),
    ] {
        let bytes = std::fs::read(extension.join(filename))
            .map_err(|_| "FIXTURE_EXTENSION_ASSET_MISSING")?;
        if format!("{:x}", sha2::Sha256::digest(&bytes)) != expected_sha256 {
            return Err("FIXTURE_EXTENSION_INTEGRITY_MISMATCH");
        }
    }
    Ok(())
}

// The operator composer is opt-in. Only the exact source-shipped bundle is
// eligible for the normal WebView2 profile; a path or manifest alone is not
// trusted to supply executable extension content.
#[cfg(windows)]
fn verify_operator_composer_assets(extension: &std::path::Path) -> Result<(), &'static str> {
    for (filename, expected) in [
        ("manifest.json", include_bytes!("../../browser-extension/chatgpt-composer/manifest.json").as_slice()),
        ("content.js", include_bytes!("../../browser-extension/chatgpt-composer/content.js").as_slice()),
        ("popup.js", include_bytes!("../../browser-extension/chatgpt-composer/popup.js").as_slice()),
        ("popup.html", include_bytes!("../../browser-extension/chatgpt-composer/popup.html").as_slice()),
    ] {
        let actual = std::fs::read(extension.join(filename))
            .map_err(|_| "OPERATOR_COMPOSER_ASSET_MISSING")?;
        if actual.as_slice() != expected {
            return Err("OPERATOR_COMPOSER_INTEGRITY_MISMATCH");
        }
    }
    Ok(())
}

// Debug fixture extensions must never change the ordinary signed-in browser profile.
fn workspace_profile_leaf(fixture_mode: bool) -> &'static str {
    if fixture_mode {
        "fixture-debug"
    } else {
        "browser-01"
    }
}

pub(crate) fn create_workspace_view(
    window: &Window,
    label: &str,
    position: LogicalPosition<f64>,
    size: LogicalSize<f64>,
    target: Option<tauri::Url>,
) -> Result<tauri::Webview, String> {
    let fixture_mode = cfg!(all(windows, debug_assertions))
        && std::env::var("LAZY_FIXTURE_BRIDGE_ENABLE").ok().as_deref() == Some("1");
    let profile = window
        .app_handle()
        .path()
        .app_local_data_dir()
        .map_err(|_| "BROWSER_PROFILE_UNAVAILABLE")?
        .join("browser-profiles")
        // Ten normal workspaces still share browser-01; debug fixtures are
        // isolated from the user's signed-in WebView2 profile and cookies.
        .join(workspace_profile_leaf(fixture_mode));
    let popup_app = window.app_handle().clone();
    let popup_label = label.to_owned();
    // A new normal workspace opens ordinary ChatGPT Chat. The isolated
    // localhost debug fixture retains its original blank-page startup.
    // Existing mounted workspaces are never navigated by tab switching.
    let default_address = if fixture_mode { "about:blank" } else { ORDINARY_CHAT_HOME };
    let builder = WebviewBuilder::new(
        label.to_owned(),
        WebviewUrl::External(
            target.unwrap_or_else(|| default_address.parse().expect("valid default URL")),
        ),
    )
    .data_directory(profile)
    .on_download(|view,event|{
        use tauri::Manager;
        let app=view.app_handle().clone();
        app.state::<crate::browser_downloads::DownloadGate>()
          .request(&app,&view,event)
    })
    .focused(false)
    .devtools(false);
    // The normal profile can load the exact source-shipped operator composer
    // only after explicit opt-in. This never dispatches a prompt by itself.
    // All child WebViews share one WebView2 browser profile.
    #[cfg(windows)]
    let operator_composer_enabled = !fixture_mode
        && std::env::var("LAZY_OPERATOR_COMPOSER_ENABLE").ok().as_deref() == Some("1");
    // The localhost fixture remains isolated and never loads into the
    // signed-in normal browser profile.
    // The extension directory is provided by the developer and must contain
    // our loopback-only fixture manifest. Never install from a remote URL.
    #[cfg(windows)]
    let builder = if fixture_mode {
        let path = std::env::var_os("LAZY_FIXTURE_EXTENSION_DIR")
            .ok_or("FIXTURE_EXTENSION_PATH_REQUIRED")?;
        let extension =
            std::fs::canonicalize(path).map_err(|_| "FIXTURE_EXTENSION_PATH_INVALID")?;
        if !extension.is_dir() || !extension.join("manifest.json").is_file() {
            return Err("FIXTURE_EXTENSION_MANIFEST_MISSING".into());
        }
        // Never install arbitrary extensions into the shared signed-in browser
        // profile, even in debug builds. Only the strictly loopback fixture
        // manifest is eligible for this opt-in source experiment.
        let manifest = std::fs::read_to_string(extension.join("manifest.json"))
            .map_err(|_| "FIXTURE_EXTENSION_MANIFEST_UNREADABLE")?;
        let config: serde_json::Value =
            serde_json::from_str(&manifest).map_err(|_| "FIXTURE_EXTENSION_MANIFEST_INVALID")?;
        if config["manifest_version"] != 3
            || config["host_permissions"] != serde_json::json!(["http://127.0.0.1/*"])
            || config["permissions"] != serde_json::json!(["storage"])
            || config.get("externally_connectable").is_some()
            || config["content_scripts"].as_array().is_none_or(|scripts| {
                scripts.len() != 1
                    || scripts[0]["matches"] != serde_json::json!(["http://127.0.0.1/*"])
                    || scripts[0]["all_frames"] != false
            })
        {
            return Err("FIXTURE_EXTENSION_SCOPE_REJECTED".into());
        }
        // WebView2 does not copy the extension. Pin source files before
        // admitting the debug-only extension into its isolated test profile.
        verify_fixture_extension_assets(&extension).map_err(str::to_owned)?;
        builder
            .browser_extensions_enabled(true)
            .extensions_path(extension)
    } else if operator_composer_enabled {
        let path = std::env::var_os("LAZY_OPERATOR_COMPOSER_DIR")
            .ok_or("OPERATOR_COMPOSER_PATH_REQUIRED")?;
        let extension = std::fs::canonicalize(path)
            .map_err(|_| "OPERATOR_COMPOSER_PATH_INVALID")?;
        if !extension.is_dir() {
            return Err("OPERATOR_COMPOSER_DIRECTORY_REQUIRED".into());
        }
        // Reject substituted or partial bundles before granting extension
        // capabilities in the profile that also holds the user's login.
        verify_operator_composer_assets(&extension).map_err(str::to_owned)?;
        builder
            .browser_extensions_enabled(true)
            .extensions_path(extension)
    } else {
        builder
    };
    let builder = builder
        .on_new_window(move |url, _| {
            // New-window requests cannot overwrite the protected ChatGPT tab.
            // Offer the allowed URL to the main UI for a separate supporting tab.
            if matches!(url.scheme(), "http" | "https") && allowed_browser_navigation(&url) {
                use tauri::Emitter;
                let workspace = popup_label.get(0..10).unwrap_or("");
                let workspace = workspace.replacen("browser-","workspace-",1);
                if let Some(main)=popup_app.get_webview("main"){
                    let _=main.emit_to(tauri::EventTarget::webview("main"),
                      "browser-new-tab-request",
                      serde_json::json!({"workspaceId":workspace,"url":url.as_str()}));
                }
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .on_page_load(|view, page| {
            if let Some(main) = view.app_handle().get_webview("main") {
                use tauri::Emitter;
                let workspace = view.label().get(0..10).unwrap_or("")
                    .replacen("browser-", "workspace-", 1);
                let tab_id = view.label().strip_prefix(&format!("{}-tab-", &view.label()[..10]))
                    .map(|s|format!("tab-{s}")).unwrap_or_else(||"main".into());
                let _ = main.emit_to(
                    tauri::EventTarget::webview("main"),
                    "browser-address",
                    serde_json::json!({"workspaceId":workspace,"tabId":tab_id,"url":page.url().as_str()}),
                );
            }
        })
        .on_navigation(allowed_browser_navigation);
    window
        .add_child(builder, position, size)
        .map_err(|_| "NATIVE_WEBVIEW_MOUNT_FAILED".into())
}

fn open_workspace_from_mcp(
    app: &tauri::AppHandle,
    workspace: &str,
    label: &str,
    address: Option<&str>,
) -> Result<serde_json::Value, String> {
    use tauri::Emitter;
    let target = address.map(browser_address).transpose()?;
    let main = app.get_webview("main").ok_or("MAIN_WEBVIEW_MISSING")?;
    if let Some(view) = app.get_webview(label) {
        if let Some(url) = target {
            view.navigate(url)
                .map_err(|_| "BROWSER_NAVIGATION_FAILED")?;
        }
    } else {
        // Create offscreen so opening a background tab cannot obscure the selected tab.
        let view = create_workspace_view(
            &main.window(),
            label,
            LogicalPosition::new(-10000.0, -10000.0),
            LogicalSize::new(320.0, 240.0),
            target,
        )?;
        if view.hide().is_err() {
            let _ = view.close();
            return Err("NATIVE_VIEW_HIDE_FAILED".into());
        }
        set_memory_saving(&view, true);
    }
    main.emit_to(
        tauri::EventTarget::webview("main"),
        "browser-opened",
        serde_json::json!({"workspaceId":workspace}),
    )
    .map_err(|_| "BROWSER_OPEN_NOTIFICATION_FAILED")?;
    Ok(serde_json::json!({"workspaceId":workspace,"open":true}))
}
pub(crate) fn control_browser(
    app: &tauri::AppHandle,
    workspace: &str,
    action: &str,
    address: Option<&str>,
) -> Result<serde_json::Value, String> {
    let label = label_for(workspace)?;
    if action == "open" {
        return open_workspace_from_mcp(app, workspace, &label, address);
    }
    let view = app.get_webview(&label).ok_or("BROWSER_CLOSED")?;
    match (action, address) {
        ("navigate", Some(address)) => {
            let target = browser_address(address)?;
            view.navigate(target)
                .map_err(|_| "BROWSER_NAVIGATION_FAILED")?;
            return Ok(serde_json::json!({"workspaceId":workspace,"navigationRequested":true}));
        }
        ("location", None) => {
            let mut url = view.url().map_err(|_| "BROWSER_ADDRESS_UNAVAILABLE")?;
            url.set_query(None);
            url.set_fragment(None);
            return Ok(serde_json::json!({"workspaceId":workspace,"url":url.as_str()}));
        }
        ("back", None) => view.eval("history.back()"),
        ("forward", None) => view.eval("history.forward()"),
        ("reload", None) => view.reload(),
        _ => return Err("INVALID_BROWSER_ACTION".into()),
    }
    .map_err(|_| "BROWSER_NAVIGATION_FAILED")?;
    Ok(serde_json::json!({"workspaceId":workspace,"navigationRequested":true}))
}

#[tauri::command]
pub async fn browser_action(
    webview: tauri::Webview,
    workspace_id: String,
    action: String,
    address: Option<String>,
) -> Result<serde_json::Value, String> {
    ensure_main(&webview)?;
    control_browser(
        webview.app_handle(),
        &workspace_id,
        &action,
        address.as_deref(),
    )
}
fn ensure_main(webview: &tauri::Webview) -> Result<(), String> {
    if webview.label() != "main" {
        Err("INVALID_PARENT_WINDOW".into())
    } else {
        Ok(())
    }
}
#[tauri::command]
pub async fn embedded_view_snapshot(
    webview: tauri::Webview,
    window: Window,
    workspace_id: String,
) -> Result<EmbeddedViewSnapshot, String> {
    ensure_main(&webview)?;
    let label = label_for(&workspace_id)?;
    Ok(EmbeddedViewSnapshot {
        workspace_id,
        mounted: window.get_webview(&label).is_some(),
        view_label: label,
        source: "NATIVE_TAURI_WINDOW_REGISTRY",
    })
}
#[tauri::command]
pub async fn mount_embedded_view(
    webview: tauri::Webview,
    window: Window,
    workspace_id: String,
    bounds: ViewBounds,
    address: Option<String>,
) -> Result<EmbeddedViewSnapshot, String> {
    ensure_main(&webview)?;
    let label = label_for(&workspace_id)?;
    let (position, size) = validated_bounds(&bounds)?;
    let target = address.as_deref().map(browser_address).transpose()?;
    // Hide supporting tabs as well as protected main tabs of other workspaces.
    let tabs=window.state::<crate::browser_support_tabs::BrowserSupportTabs>();
    for n in 1..=10 {
        let id=format!("workspace-{n:02}");
        tabs.hide(&window,&id)?;
        let other = format!("browser-{n:02}");
        if other != label {
            if let Some(child) = window.get_webview(&other) {
                child
                    .hide()
                    .map_err(|_| "NATIVE_VIEW_HIDE_FAILED".to_string())?;
                set_memory_saving(&child, true);
            }
        }
    }
    if window.get_webview(&label).is_none() {
        create_workspace_view(&window, &label, position, size, target)?;
    } else if let Some(url) = target {
        window
            .get_webview(&label)
            .ok_or("NATIVE_WEBVIEW_MOUNT_FAILED")?
            .navigate(url)
            .map_err(|_| "BROWSER_NAVIGATION_FAILED")?;
    }
    let view = window
        .get_webview(&label)
        .ok_or("NATIVE_WEBVIEW_MOUNT_FAILED")?;
    view.set_position(position)
        .map_err(|_| "NATIVE_VIEW_POSITION_FAILED".to_string())?;
    view.set_size(size)
        .map_err(|_| "NATIVE_VIEW_SIZE_FAILED".to_string())?;
    view.show()
        .map_err(|_| "NATIVE_VIEW_SHOW_FAILED".to_string())?;
    set_memory_saving(&view, false);
    tabs.restore(&window,&workspace_id,position,size)?;
    Ok(EmbeddedViewSnapshot {
        workspace_id,
        view_label: label,
        mounted: true,
        source: "NATIVE_TAURI_WINDOW_REGISTRY",
    })
}

#[tauri::command]
pub async fn close_embedded_view(
    webview: tauri::Webview,
    window: Window,
    workspace_id: String,
) -> Result<(), String> {
    ensure_main(&webview)?;
    window.state::<crate::browser_support_tabs::BrowserSupportTabs>()
        .close_workspace(&window,&workspace_id)?;
    if let Some(view) = window.get_webview(&label_for(&workspace_id)?) {
        view.close()
            .map_err(|_| "NATIVE_VIEW_CLOSE_FAILED".to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub async fn hide_embedded_views(
    webview: tauri::Webview,
    window: Window,
    next_workspace: Option<String>,
) -> Result<(), String> {
    ensure_main(&webview)?;
    let next_label = next_workspace.as_deref().map(label_for).transpose()?;
    for n in 1..=10 {
        window.state::<crate::browser_support_tabs::BrowserSupportTabs>()
          .hide(&window,&format!("workspace-{n:02}"))?;
        let label = format!("browser-{n:02}");
        if let Some(view) = window.get_webview(&label) {
            view.hide()
                .map_err(|_| "NATIVE_VIEW_HIDE_FAILED".to_string())?;
            if next_label.as_deref() != Some(label.as_str()) {
                set_memory_saving(&view, true);
            }
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::{allowed_browser_navigation, browser_address, label_for, ORDINARY_CHAT_HOME};
    use tauri::Url;
    #[test]
    fn workspace_navigation_rejects_shell_and_unsafe_schemes() {
        for url in [
            "tauri://localhost/",
            "https://tauri.localhost/browser-preview.html",
            "https://ipc.localhost/",
            "file:///browser-preview.html",
            "javascript:alert(1)",
            "https://user:password@example.com/",
        ] {
            assert!(!allowed_browser_navigation(&Url::parse(url).unwrap()));
        }
        assert!(allowed_browser_navigation(
            &Url::parse("https://example.com/").unwrap()
        ));
    }
    #[test]
    fn ordinary_chat_default_and_temporary_navigation_are_separate() {
        assert_eq!(ORDINARY_CHAT_HOME, "https://chatgpt.com/");
        for ordinary in [
            "https://chatgpt.com/",
            "https://chatgpt.com/c/1234abcd-1234-abcd-1234-1234abcd1234",
            "https://chatgpt.com/?model=auto",
        ] {
            let url = Url::parse(ordinary).unwrap();
            assert!(allowed_browser_navigation(&url), "ordinary URL blocked: {ordinary}");
            assert!(browser_address(ordinary).is_ok());
        }
        for temporary in [
            "https://chatgpt.com/?temporary-chat=true",
            "https://chatgpt.com/?model=auto&Temporary-Chat=false",
            "https://www.chatgpt.com/?temporary_chat=1",
            "https://chat.openai.com/?temporaryChat=true",
            "https://chatgpt.com/?temporary%2Dchat=true",
        ] {
            let url = Url::parse(temporary).unwrap();
            assert!(!allowed_browser_navigation(&url), "Temporary Chat URL allowed: {temporary}");
            assert!(browser_address(temporary).is_err());
        }
        // This guard is ChatGPT-specific. It must not change ordinary browsing elsewhere.
        assert!(allowed_browser_navigation(
            &Url::parse("https://example.com/?temporary-chat=true").unwrap()
        ));
    }

    #[test]
    fn fixture_profile_is_separate_from_signed_in_workspace() {
        assert_eq!(super::workspace_profile_leaf(false), "browser-01");
        assert_eq!(super::workspace_profile_leaf(true), "fixture-debug");
        assert_ne!(
            super::workspace_profile_leaf(false),
            super::workspace_profile_leaf(true)
        );
    }
    #[test]
    fn only_ten_canonical_slots() {
        for n in 1..=10 {
            assert_eq!(
                label_for(&format!("workspace-{n:02}")).unwrap(),
                format!("browser-{n:02}")
            );
        }
        for bad in [
            "workspace-00",
            "workspace-11",
            "workspace-1",
            "workspace-01x",
            "other-01",
            "workspace-99",
        ] {
            assert!(label_for(bad).is_err());
        }
    }

    #[cfg(windows)]
    #[test]
    fn fixture_extension_assets_are_pinned() {
        let extension =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../browser-extension");
        assert_eq!(super::verify_fixture_extension_assets(&extension), Ok(()));
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "requires a Windows desktop session with WebView2"]
    fn webview2_shares_one_browser_profile_and_saves_background_memory() {
        use super::{hide_embedded_views, mount_embedded_view, ViewBounds};
        use crate::browser_mcp_pipe::{request_at, start_at};
        use std::{sync::mpsc, time::Duration};
        use tauri::Manager;
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows_core::Interface;

        fn level(view: &tauri::Webview) -> Result<COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL, String> {
            let (tx, rx) = mpsc::channel();
            view.with_webview(move |platform| unsafe {
                let result = platform.controller().CoreWebView2().and_then(|core| {
                    let core = core.cast::<ICoreWebView2_19>()?;
                    let mut level = COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL::default();
                    core.MemoryUsageTargetLevel(&mut level)?;
                    Ok(level)
                });
                let _ = tx.send(result.map_err(|e| e.to_string()));
            })
            .map_err(|e| e.to_string())?;
            rx.recv_timeout(Duration::from_secs(5))
                .map_err(|e| e.to_string())?
        }

        let mut context = tauri::generate_context!();
        context.config_mut().identifier =
            format!("com.openitstudios.browsertest-{}", std::process::id());
        context.config_mut().app.windows[0].visible = false;
        let (tx, rx) = mpsc::channel();
        let pipe = format!(r"\\.\pipe\lazyprompting-{:032x}", std::process::id());
        let app = tauri::Builder::default()
            .any_thread()
            .setup(move |app| {
                let handle = app.handle().clone();
                start_at(handle.clone(), pipe.clone())?;
                tauri::async_runtime::spawn(async move {
                    let result = async {
                        let main = handle.get_webview("main").ok_or("MAIN_WEBVIEW_MISSING")?;
                        let invalid_goal = request_at(&pipe, serde_json::json!({
                            "goalAction":"start","arguments":{"objective":"Incomplete scope"}
                        })).await;
                        if !matches!(invalid_goal, Err(code) if code == "INVALID_GOAL_SCOPE") {
                            return Err("MCP accepted a goal without a complete scope".into());
                        }
                        let window = main.window();
                        let workspace = "workspace-01".to_owned();
                        let bounds = || ViewBounds {
                            x: 0.0,
                            y: 0.0,
                            width: 320.0,
                            height: 240.0,
                        };
                        mount_embedded_view(
                            main.clone(),
                            window.clone(),
                            workspace.clone(),
                            bounds(),
                            None,
                        )
                        .await?;
                        let browser = handle.get_webview("browser-01").ok_or("BROWSER_MISSING")?;
                        let request = || serde_json::json!({"workspaceId":"workspace-01","action":"location"});
                        let location = request_at(&pipe, request()).await?;
                        if location["url"] != "about:blank" {
                            return Err("MCP did not reach the open browser".into());
                        }
                        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
                        let address = format!("http://{}/", listener.local_addr().map_err(|e| e.to_string())?);
                        let response = tokio::spawn(async move {
                            use tokio::io::{AsyncReadExt, AsyncWriteExt};
                            let (mut stream, _) = listener.accept().await?;
                            let mut request = [0u8; 4096];
                            let _ = stream.read(&mut request).await?;
                            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 24\r\nConnection: close\r\n\r\n<title>Workspace</title>").await
                        });
                        request_at(&pipe, serde_json::json!({"workspaceId":"workspace-01","action":"navigate","address":address})).await?;
                        tokio::time::timeout(Duration::from_secs(5), response).await
                            .map_err(|e| e.to_string())?.map_err(|e| e.to_string())?.map_err(|e| e.to_string())?;
                        let origin = Url::parse("https://profile-check.invalid/").unwrap();
                        let cookie =
                            tauri::webview::Cookie::build(("lp_profile_check", "synthetic"))
                                .domain("profile-check.invalid")
                                .path("/")
                                .secure(true)
                                .http_only(true)
                                .build();
                        browser.set_cookie(cookie).map_err(|e| e.to_string())?;
                        for n in 2..=10 {
                            let workspace = format!("workspace-{n:02}");
                            if n <= 5 {
                                let opened = request_at(&pipe, serde_json::json!({"workspaceId":workspace,"action":"open"})).await?;
                                if opened["open"] != true {
                                    return Err(format!("MCP failed to open {workspace}"));
                                }
                            } else {
                                mount_embedded_view(main.clone(), window.clone(), workspace, bounds(), None).await?;
                            }
                            let tab = handle
                                .get_webview(&format!("browser-{n:02}"))
                                .ok_or("BROWSER_MISSING")?;
                            if !tab
                                .cookies_for_url(origin.clone())
                                .map_err(|e| e.to_string())?
                                .iter()
                                .any(|cookie| {
                                    cookie.name_value() == ("lp_profile_check", "synthetic")
                                })
                            {
                                return Err(format!(
                                    "Browser {n:02} did not share the synthetic login cookie"
                                ));
                            }
                        }
                        if !main
                            .cookies_for_url(origin)
                            .map_err(|e| e.to_string())?
                            .is_empty()
                        {
                            return Err("Shell WebView shared browser data".into());
                        }
                        if crate::goal_runs::approval_owner(&handle)? == 0 {
                            return Err("Goal confirmation has no owner with browser tabs open".into());
                        }
                        hide_embedded_views(main.clone(), window.clone(), None).await?;
                        let background = level(&browser)?;
                        mount_embedded_view(main, window, workspace, bounds(), None).await?;
                        Ok::<_, String>((background, level(&browser)?))
                    }
                    .await;
                    let _ = tx.send(result);
                    handle.exit(0);
                });
                Ok(())
            })
            .build(context)
            .expect("build hidden Windows test window");
        app.run_return(|_, _| {});
        let (background, foreground) = rx.recv().unwrap().unwrap();
        assert_eq!(background, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW);
        assert_eq!(foreground, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL);
    }
}
