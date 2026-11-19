// Native read-only verification for eventual ChatGPT-hosted plugin goals.
// The scope preflight never calls the gateway. The separate pending-status
// command only reads the canonical PromptOutbox through the existing
// authenticated packaged gateway. Neither command can send or grant work.
use serde_json::{json, Value};
use tauri::Manager;

fn project_checked_scope(workspace_id: &str, run_id: &str) -> Value {
    json!({
        "source":"NATIVE_CHAT_PLUGIN_SOURCE_PREFLIGHT",
        "status":"OAUTH_AND_OPERATOR_BINDING_REQUIRED",
        "workspaceId":workspace_id,
        "runId":run_id,
        "codexSourceReviewed":true,
        "chatBookmarkMatched":true,
        "oauthVerified":false,
        "operatorChatApproved":false,
        "chatSessionVerified":false,
        "pluginAuthorized":false,
        "sent":false,
        "qa":"NOT_EXECUTED",
        "nextPromptAllowed":false
    })
}

#[tauri::command]
pub(crate) async fn chat_plugin_scope_preflight(
    webview: tauri::Webview,
    workspace_id: String,
    run_id: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("CHAT_PLUGIN_MAIN_WINDOW_REQUIRED".into());
    }
    crate::embedded_webview::label_for(&workspace_id)?;
    if run_id.len() != 69 {
        return Err("CHAT_PLUGIN_RUN_ID_INVALID".into());
    }
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let goal = crate::goal_runs::chat_plugin_source_preflight(&app, &run_id)?;
        let chat = crate::chat_bookmarks::plugin_chat_digest(&app, &workspace_id)?;
        // Repeat after both independent reads. A navigation or source change
        // during the check is a hold, not a positive scope result.
        if goal != crate::goal_runs::chat_plugin_source_preflight(&app, &run_id)?
            || chat != crate::chat_bookmarks::plugin_chat_digest(&app, &workspace_id)?
        {
            return Err("CHAT_PLUGIN_SOURCE_RECONCILE_REQUIRED".into());
        }
        Ok(project_checked_scope(&workspace_id, &run_id))
    })
    .await
    .map_err(|_| "CHAT_PLUGIN_PREFLIGHT_WORKER_UNAVAILABLE".to_owned())?
}

// Strictly project the private native gateway status. No hashes, codes,
// token values, prompt text, or backend request fields reach the renderer.
// A missing record does NOT grant a new send or allow automatic retry.
fn project_pending_status(workspace_id: &str, raw: &Value) -> Result<Value, String> {
    const KEYS: [&str; 11] = [
        "workspaceId", "active", "ambiguous", "state", "diagnostic",
        "operatorReviewRequired", "safeToRetry", "autoReleaseAllowed",
        "deliveryVerified", "resultVerified", "nextPromptAllowed",
    ];
    if !raw.as_object().is_some_and(|fields| {
        fields.len() == KEYS.len() && KEYS.iter().all(|key| fields.contains_key(*key))
    }) || raw["workspaceId"].as_str() != Some(workspace_id)
        || raw["ambiguous"] != false
        || raw["safeToRetry"] != false
        || raw["autoReleaseAllowed"] != false
        || raw["deliveryVerified"] != false
        || raw["resultVerified"] != false
        || raw["nextPromptAllowed"] != false
    {
        return Err("CHAT_PLUGIN_PENDING_STATUS_INVALID".into());
    }
    let diagnostic = raw["diagnostic"]
        .as_str()
        .ok_or("CHAT_PLUGIN_PENDING_STATUS_INVALID")?;
    let valid = match (
        raw["active"].as_u64(),
        raw["state"].as_str(),
        raw["operatorReviewRequired"].as_bool(),
        diagnostic,
    ) {
        (Some(0), None, Some(false), "NO_PENDING") => raw["state"].is_null(),
        (Some(1), Some("RESERVED_UNVERIFIED"), Some(true),
            "AWAITING_VERIFIED_BINDING" | "BIND_WINDOW_EXPIRED_HOLD"
            | "LEGACY_UNTIMED_HOLD" | "CLOCK_UNCERTAIN_HOLD") => true,
        (Some(1), Some("IDENTITY_BOUND_UNVERIFIED"), Some(true),
            "IDENTITY_LINKED_CHAT_UNVERIFIED") => true,
        (Some(1), Some("RECONCILE_REQUIRED"), Some(true),
            "RECONCILE_REQUIRED") => true,
        _ => false,
    };
    if !valid {
        return Err("CHAT_PLUGIN_PENDING_STATUS_INVALID".into());
    }
    Ok(json!({
        "source":"NATIVE_CHAT_PLUGIN_PENDING_STATUS",
        "workspaceId":workspace_id,
        "diagnostic":diagnostic,
        "hold":raw["active"] == 1,
        "operatorReviewRequired":raw["operatorReviewRequired"],
        "pluginAuthorized":false,
        "chatSessionVerified":false,
        "sent":false,
        "deliveryVerified":false,
        "resultVerified":false,
        "safeToRetry":false,
        "autoReleaseAllowed":false,
        "nextPromptAllowed":false,
        "qa":"NOT_VERIFIED"
    }))
}

// On-demand main-window read of already-persisted plugin intent.
// Unlike scope preflight, no bookmarked WebView or open tab is needed:
// operators must be able to diagnose crash/restart holds with tabs closed.
#[tauri::command]
pub(crate) async fn chat_plugin_pending_status(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("CHAT_PLUGIN_MAIN_WINDOW_REQUIRED".into());
    }
    crate::embedded_webview::label_for(&workspace_id)?;
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let root = app
            .path()
            .resource_dir()
            .map_err(|_| "CHAT_PLUGIN_GATEWAY_RESOURCE_UNAVAILABLE")?
            .join("gateway");
        let gateway = app.state::<crate::gateway_session::GatewaySession>();
        gateway.probe_packaged(&root)?;
        let raw = gateway.chat_plugin_intent_outbox(
            &app, "pending", json!({"workspaceId":workspace_id}),
        )?;
        project_pending_status(&workspace_id, &raw)
    })
    .await
    .map_err(|_| "CHAT_PLUGIN_PENDING_WORKER_UNAVAILABLE".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_pending(workspace: &str, state: Value, diagnostic: &str, active: u64) -> Value {
        json!({
            "workspaceId":workspace,
            "active":active,
            "ambiguous":false,
            "state":state,
            "diagnostic":diagnostic,
            "operatorReviewRequired":active > 0,
            "safeToRetry":false,
            "autoReleaseAllowed":false,
            "deliveryVerified":false,
            "resultVerified":false,
            "nextPromptAllowed":false
        })
    }

    #[test]
    fn native_pending_projection_is_bounded_read_only_and_exact() {
        for (state, diagnostic, active) in [
            (Value::Null, "NO_PENDING", 0),
            (json!("RESERVED_UNVERIFIED"), "AWAITING_VERIFIED_BINDING", 1),
            (json!("RESERVED_UNVERIFIED"), "LEGACY_UNTIMED_HOLD", 1),
            (json!("RESERVED_UNVERIFIED"), "CLOCK_UNCERTAIN_HOLD", 1),
            (json!("RESERVED_UNVERIFIED"), "BIND_WINDOW_EXPIRED_HOLD", 1),
            (json!("IDENTITY_BOUND_UNVERIFIED"), "IDENTITY_LINKED_CHAT_UNVERIFIED", 1),
            (json!("RECONCILE_REQUIRED"), "RECONCILE_REQUIRED", 1)
        ] {
            let raw = fixture_pending("workspace-01", state, diagnostic, active);
            let view = project_pending_status("workspace-01", &raw).unwrap();
            assert_eq!(view["source"], "NATIVE_CHAT_PLUGIN_PENDING_STATUS");
            assert_eq!(view["diagnostic"], diagnostic);
            assert_eq!(view["hold"], active > 0);
            assert_eq!(view["pluginAuthorized"], false);
            assert_eq!(view["safeToRetry"], false);
            assert_eq!(view["autoReleaseAllowed"], false);
            assert_eq!(view["chatSessionVerified"], false);
            assert_eq!(view["nextPromptAllowed"], false);
            assert!(view.get("goalDigest").is_none());
            assert!(view.get("principalTag").is_none());
            assert!(view.get("turnId").is_none());
        }
    }

    #[test]
    fn invalid_native_pending_is_never_silently_downgraded_to_no_pending() {
        let good = fixture_pending("workspace-01",
            json!("RESERVED_UNVERIFIED"), "BIND_WINDOW_EXPIRED_HOLD", 1);
        let mut variants = Vec::new();
        for (field, replacement) in [
            ("workspaceId", json!("workspace-02")),
            ("active", json!(0)),
            ("ambiguous", json!(true)),
            ("operatorReviewRequired", json!(false)),
            ("safeToRetry", json!(true)),
            ("autoReleaseAllowed", json!(true)),
            ("deliveryVerified", json!(true)),
            ("resultVerified", json!(true)),
            ("nextPromptAllowed", json!(true)),
            ("state", json!("RESPONSE_VERIFIED")),
            ("diagnostic", json!("NO_PENDING")),
        ] {
            let mut value = good.clone();
            value[field] = replacement;
            variants.push(value);
        }
        let mut additional = good.clone();
        additional["claim"] = json!("secret");
        variants.push(additional);
        for value in variants {
            assert!(project_pending_status("workspace-01", &value).is_err());
        }
    }

    #[test]
    fn preflight_projection_is_never_an_execution_grant() {
        let value = project_checked_scope(
            "workspace-01",
            "12345678-1234-1234-1234-123456789abc.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        );
        assert_eq!(value["codexSourceReviewed"], true);
        assert_eq!(value["chatBookmarkMatched"], true);
        assert_eq!(value["pluginAuthorized"], false);
        assert_eq!(value["oauthVerified"], false);
        assert_eq!(value["operatorChatApproved"], false);
        assert_eq!(value["chatSessionVerified"], false);
        assert_eq!(value["nextPromptAllowed"], false);
        assert_eq!(value["sent"], false);
    }
}
