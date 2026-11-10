use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};

use crate::gateway_session::GatewaySession;
use crate::lightpanda_admission::workspace_allowed;
use crate::lightpanda_private::{PrivateLightpanda, PREVIEW_URL};

pub(crate) const BINARY_ENV: &str = "LAZYPROMPTING_LIGHTPANDA_BINARY";

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

    pub(crate) fn invoke_approved(
        &self,
        gateway: &GatewaySession,
        workspace: &str,
        action: PreviewAction,
        binary: Option<&str>,
    ) -> Result<Value, String> {
        let mut browser = self.browser.try_lock().map_err(|_| "PREVIEW_BUSY")?;
        if self.stopping.load(Ordering::Acquire) {
            return Err("PREVIEW_STOPPED".into());
        }
        if browser.is_none() && matches!(action, PreviewAction::Open) {
            *browser = Some(PrivateLightpanda::start(
                binary.ok_or("LIGHTPANDA_BINARY_NOT_CONFIGURED")?,
            )?);
        }
        if self.stopping.load(Ordering::Acquire) {
            browser.take();
            return Err("PREVIEW_STOPPED".into());
        }
        let (capability, _, url) = action.scope();
        let reply = gateway.invoke_lightpanda(
            browser.as_mut().ok_or("WORKSPACE_NOT_OPEN")?,
            capability,
            workspace,
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
    pub(crate) fn description(self) -> &'static str {
        self.scope().1
    }

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
    if webview.label() != "main" || !workspace_allowed(&workspace_id) {
        return Err("INVALID_PREVIEW_SCOPE".into());
    }
    let owner = webview.hwnd().map_err(|_| "PREVIEW_WINDOW_UNAVAILABLE")?.0 as usize;
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<PreviewControls>();
        if state.stopping.load(Ordering::Acquire) {
            return Err("PREVIEW_STOPPED".into());
        }
        let binary = std::env::var(BINARY_ENV).ok();
        if matches!(action, PreviewAction::Open) && binary.is_none() {
            return Err("LIGHTPANDA_BINARY_NOT_CONFIGURED".into());
        }

        let operation = action.description();
        let message = format!(
            "{operation} for {workspace_id}? This permission applies to this operation only."
        );
        if !crate::operator_confirmation::confirm(
            owner,
            "LazyPrompting · Lightpanda permission",
            &message,
        ) {
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
        state.invoke_approved(&gateway, &workspace_id, action, binary.as_deref())
    })
    .await
    .map_err(|_| "PREVIEW_WORKER_FAILED")?
}
