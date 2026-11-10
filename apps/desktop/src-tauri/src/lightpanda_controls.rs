use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};

use crate::gateway_session::GatewaySession;
use crate::lightpanda_admission::workspace_allowed;
use crate::lightpanda_private::{PrivateLightpanda, PREVIEW_URL};

const BINARY_ENV: &str = "LAZYPROMPTING_LIGHTPANDA_BINARY";

#[derive(Default)]
pub(crate) struct PreviewControls {
    browser: Mutex<Option<PrivateLightpanda>>,
    stopping: AtomicBool,
}

impl PreviewControls {
    pub(crate) fn stop(&self) {
        self.stopping.store(true, Ordering::Release);
        if let Ok(mut browser) = self.browser.try_lock() {
            browser.take();
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PreviewAction {
    Open,
    Snapshot,
    Close,
}

impl PreviewAction {
    fn scope(self) -> (&'static str, &'static str, Option<&'static str>) {
        match self {
            Self::Open => (
                "lightpanda.open",
                "Open the fixed local preview",
                Some(PREVIEW_URL),
            ),
            Self::Snapshot => (
                "lightpanda.snapshot",
                "Read the local preview title and URL",
                None,
            ),
            Self::Close => ("lightpanda.close", "Close the local preview", None),
        }
    }
}

#[tauri::command]
pub(crate) async fn lightpanda_preview(
    webview: WebviewWindow,
    workspace_id: String,
    action: PreviewAction,
) -> Result<Value, String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONQUESTION, MB_YESNO,
    };

    if webview.label() != "main" || !workspace_allowed(&workspace_id) {
        return Err("INVALID_PREVIEW_SCOPE".into());
    }
    let owner = webview.hwnd().map_err(|_| "PREVIEW_WINDOW_UNAVAILABLE")?.0 as usize;
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<PreviewControls>();
        let mut browser = state.browser.try_lock().map_err(|_| "PREVIEW_BUSY")?;
        if state.stopping.load(Ordering::Acquire) {
            return Err("PREVIEW_STOPPED".into());
        }
        let binary = if browser.is_none() && matches!(action, PreviewAction::Open) {
            Some(std::env::var(BINARY_ENV).map_err(|_| "LIGHTPANDA_BINARY_NOT_CONFIGURED")?)
        } else {
            None
        };
        if browser.is_none() && binary.is_none() {
            return Err("WORKSPACE_NOT_OPEN".into());
        }

        let (capability, operation, url) = action.scope();
        let message: Vec<u16> = format!(
            "{operation} for {workspace_id}? This permission applies to this operation only."
        )
        .encode_utf16()
        .chain([0])
        .collect();
        let caption: Vec<u16> = "LazyPrompting · Lightpanda permission"
            .encode_utf16()
            .chain([0])
            .collect();
        let answer = unsafe {
            MessageBoxW(
                owner as _,
                message.as_ptr(),
                caption.as_ptr(),
                MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2,
            )
        };
        if answer != IDYES {
            return Err("PREVIEW_NOT_APPROVED".into());
        }
        if state.stopping.load(Ordering::Acquire) || app.get_webview_window("main").is_none() {
            return Err("PREVIEW_STOPPED".into());
        }

        let root = app
            .path()
            .resource_dir()
            .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
            .join("gateway");
        let gateway = app.state::<GatewaySession>();
        gateway.probe_packaged(&root)?;
        if let Some(binary) = binary {
            *browser = Some(PrivateLightpanda::start(&binary)?);
        }
        if state.stopping.load(Ordering::Acquire) {
            browser.take();
            return Err("PREVIEW_STOPPED".into());
        }
        let reply = gateway.invoke_lightpanda(
            browser.as_mut().ok_or("LIGHTPANDA_BACKEND_UNAVAILABLE")?,
            capability,
            &workspace_id,
            url,
            true,
        )?;
        let result = &reply["result"];
        if result["isError"] == true {
            return Err(result["content"][0]["text"]
                .as_str()
                .unwrap_or("PREVIEW_FAILED")
                .to_owned());
        }
        result
            .get("structuredContent")
            .filter(|value| value.is_object())
            .cloned()
            .ok_or_else(|| "PREVIEW_RESULT_UNAVAILABLE".into())
    })
    .await
    .map_err(|_| "PREVIEW_WORKER_FAILED")?
}
