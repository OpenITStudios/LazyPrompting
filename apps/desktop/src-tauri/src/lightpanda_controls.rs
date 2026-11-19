use serde::Deserialize;
use serde_json::json;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Manager, WebviewWindow};

use crate::gateway_session::GatewaySession;
use crate::lightpanda_admission::workspace_allowed;
use crate::lightpanda_grants::{PreviewTargetOperation, PreviewTargetScope};
use crate::lightpanda_private::{OfflineControl, PrivateLightpanda, PREVIEW_URL};

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
    // Main-window explicit offline fixture only. No public-site navigation,
    // arbitrary page target, model tool, or implicit user permission.
    pub(crate) fn invoke_approved_effect(
        &self,
        gateway: &GatewaySession,
        data_dir: &Path,
        workspace: &str,
        action: PreviewFixtureAction,
        text: Option<&str>,
    ) -> Result<Value, String> {
        let mut browser = self.browser.try_lock().map_err(|_| "PREVIEW_BUSY")?;
        if self.stopping.load(Ordering::Acquire) {
            return Err("PREVIEW_STOPPED".into());
        }
        let engine = browser.as_mut().ok_or("WORKSPACE_NOT_OPEN")?;
        let (control, operation, text) = match action {
            PreviewFixtureAction::ToggleCheckbox if text.is_none() => (
                OfflineControl::Checkbox,
                PreviewTargetOperation::Click,
                None,
            ),
            PreviewFixtureAction::FillSearch
                if text.is_some_and(|t| {
                    !t.is_empty()
                        && t.len() <= 256
                        && t.chars().count() <= 64
                        && !t.chars().any(char::is_control)
                }) =>
            {
                (
                    OfflineControl::SearchField,
                    PreviewTargetOperation::TypeText,
                    text,
                )
            }
            _ => return Err("BROWSER_ACTION_INVALID_INPUT".into()),
        };
        let reviewed = engine.inspect_offline_control(workspace, control)?;
        let text_digest: Option<[u8; 32]> =
            text.map(|value| Sha256::digest(value.as_bytes()).into());
        let operation_name = match operation {
            PreviewTargetOperation::Click => "CLICK",
            PreviewTargetOperation::TypeText => "TYPE_TEXT",
        };
        let fingerprint = crate::native_ipc_pipe::hex(&reviewed.snapshot_fingerprint);
        let target_digest = crate::native_ipc_pipe::hex(&reviewed.target_digest);
        let text_hex = text_digest.map(|digest| crate::native_ipc_pipe::hex(&digest));
        let intent = json!({
            "workspaceId":workspace,
            "documentEpoch":reviewed.document_epoch,
            "snapshotFingerprint":fingerprint,
            "targetDigest":target_digest,
            "operation":operation_name,
            "textDigest":text_hex
        });
        let reserved = gateway.preview_action_outbox(data_dir, "reserve", intent.clone())?;
        if reserved["reserved"] != true {
            return Err("BROWSER_ACTION_WORKSPACE_BUSY_OR_HELD".into());
        }
        let action_id = reserved["actionId"]
            .as_str()
            .ok_or("BROWSER_ACTION_RESERVATION_INVALID")?
            .to_owned();
        let nonce = reserved["reservationNonce"]
            .as_str()
            .ok_or("BROWSER_ACTION_RESERVATION_INVALID")?
            .to_owned();
        let hold = json!({
            "workspaceId":workspace,"actionId":action_id,"reservationNonce":nonce
        });
        // All errors after reservation leave a hold. No automatic replay,
        // not even when the gateway dies before returning a result.
        let performed = (|| -> Result<Value, String> {
            let nonce_bytes = parse_nonce(&nonce)?;
            let scope = PreviewTargetScope::from_native_review(
                &reviewed,
                operation,
                text_digest,
                nonce_bytes,
            )?;
            let proof = json!({
                "workspaceId":workspace,
                "actionId":action_id,
                "reservationNonce":nonce,
                "documentEpoch":reviewed.document_epoch,
                "snapshotFingerprint":fingerprint,
                "targetDigest":target_digest,
                "operation":operation_name,
                "textDigest":text_hex
            });
            let sealed = gateway.preview_action_outbox(data_dir, "seal", proof.clone())?;
            if sealed["sealed"] != true || sealed["state"] != "DISPATCH_PENDING" {
                return Err("BROWSER_ACTION_DISPATCH_UNCONFIRMED".into());
            }
            let result = gateway.run_offline_preview_target(
                data_dir,
                &data_dir.join("outbox.json"),
                &action_id,
                scope.clone(),
                || {
                    if self.stopping.load(Ordering::Acquire) {
                        return Err("PREVIEW_STOPPED");
                    }
                    engine.execute_offline_effect(workspace, control, &reviewed, text)
                },
            )?;
            if self.stopping.load(Ordering::Acquire) {
                return Err("PREVIEW_STOPPED".into());
            }
            if result.public_receipt["source"] != "NATIVE_LIGHTPANDA_OFFLINE_READBACK"
                || result.public_receipt["resultVerified"] != true
                || result.public_receipt["status"] != "OFFLINE_EFFECT_VERIFIED"
            {
                return Err("BROWSER_ACTION_RESULT_UNVERIFIED".into());
            }
            // Bind completed record to the exact private native after-state,
            // action identity and OS-random reservation nonce. A constant
            // "verified" JSON reply can no longer produce this digest.
            let mut hash = Sha256::new();
            hash.update(b"lazyprompting-offline-result-v1\0");
            hash.update(action_id.as_bytes());
            hash.update(nonce_bytes);
            hash.update(reviewed.target_digest);
            hash.update(result.result_digest);
            let receipt: [u8; 32] = hash.finalize().into();
            let completed = gateway.preview_action_outbox(
                data_dir,
                "verify",
                json!({
                    "proof":proof,"resultDigest":crate::native_ipc_pipe::hex(&receipt)
                }),
            )?;
            if completed["verified"] != true
                || completed["state"] != "VERIFIED"
                || completed["actionId"] != action_id
            {
                return Err("BROWSER_ACTION_RESULT_PERSISTENCE_FAILED".into());
            }
            crate::lightpanda_grants::verify_preview_completed_action_at(
                data_dir,
                &data_dir.join("outbox.json"),
                &scope,
                &action_id,
                &receipt,
            )?;
            Ok(result.public_receipt)
        })();
        if performed.is_err() {
            let _ = gateway.preview_action_outbox(data_dir, "hold", hold);
        }
        performed
    }
}

fn parse_nonce(value: &str) -> Result<[u8; 16], &'static str> {
    if value.len() != 32 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("BROWSER_ACTION_NONCE_INVALID");
    }
    let mut decoded = [0u8; 16];
    for (index, item) in decoded.iter_mut().enumerate() {
        *item = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|_| "BROWSER_ACTION_NONCE_INVALID")?;
    }
    if decoded == [0; 16] {
        return Err("BROWSER_ACTION_NONCE_INVALID");
    }
    Ok(decoded)
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum PreviewAction {
    Open,
    Snapshot,
    // Explicit per-request operator approval. Not a public CDP action.
    Index,
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
            Self::Index => (
                "lightpanda.snapshot.index",
                "Read indexed controls from the local preview",
                None,
            ),
            Self::Close => ("lightpanda.close", "Close the local preview", None),
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum PreviewFixtureAction {
    ToggleCheckbox,
    FillSearch,
}

#[tauri::command]
pub(crate) async fn lightpanda_preview_action(
    webview: WebviewWindow,
    workspace_id: String,
    action: PreviewFixtureAction,
    text: Option<String>,
) -> Result<Value, String> {
    if webview.label() != "main" || !workspace_allowed(&workspace_id) {
        return Err("INVALID_PREVIEW_SCOPE".into());
    }
    match action {
        PreviewFixtureAction::ToggleCheckbox if text.is_none() => {}
        PreviewFixtureAction::FillSearch
            if text.as_deref().is_some_and(|value| {
                !value.is_empty()
                    && value.len() <= 256
                    && value.chars().count() <= 64
                    && !value.chars().any(char::is_control)
            }) => {}
        _ => return Err("BROWSER_ACTION_INVALID_INPUT".into()),
    }
    let owner = webview.hwnd().map_err(|_| "PREVIEW_WINDOW_UNAVAILABLE")?.0 as usize;
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<PreviewControls>();
        if state.stopping.load(Ordering::Acquire) {
            return Err("PREVIEW_STOPPED".into());
        }
        let operation = match action {
            PreviewFixtureAction::ToggleCheckbox => {
                "Click the checkbox on the fixed offline Lightpanda fixture"
            }
            PreviewFixtureAction::FillSearch => {
                "Fill the search input on the fixed offline Lightpanda fixture"
            }
        };
        if !crate::operator_confirmation::confirm(
            owner,
            "LazyPrompting · Browser AI offline permission",
            &format!("{operation} for {workspace_id}? One action only; no public website."),
        )
        .map_err(str::to_owned)?
        {
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
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|_| "BROWSER_ACTION_DATA_DIR_UNAVAILABLE")?;
        let gateway = app.state::<GatewaySession>();
        gateway.probe_packaged(&root)?;
        state.invoke_approved_effect(&gateway, &data_dir, &workspace_id, action, text.as_deref())
    })
    .await
    .map_err(|_| "PREVIEW_WORKER_FAILED")?
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
        )
        .map_err(str::to_owned)?
        {
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

#[cfg(test)]
mod indexed_preview_scope_tests {
    use super::PreviewAction;
    #[test]
    fn index_has_distinct_private_grant_scope_and_never_an_action() {
        for untrusted in [
            r#""click""#,
            r#""fill""#,
            r#""type_text""#,
            r#""target""#,
            r#""review""#,
        ] {
            assert!(serde_json::from_str::<PreviewAction>(untrusted).is_err());
        }
        let (capability, description, url) = PreviewAction::Index.scope();
        assert_eq!(capability, "lightpanda.snapshot.index");
        assert!(description.contains("indexed controls"));
        assert_eq!(url, None);
        assert_eq!(PreviewAction::Snapshot.scope().0, "lightpanda.snapshot");
    }
    #[test]
    fn offline_nonce_is_bounded_and_not_a_grant_by_itself() {
        assert!(super::parse_nonce(&"a".repeat(32)).is_ok());
        let zeros = "0".repeat(32);
        let invalid_chars = "x".repeat(32);
        for invalid in ["", "0", zeros.as_str(), invalid_chars.as_str()] {
            assert!(super::parse_nonce(invalid).is_err());
        }
    }
}
