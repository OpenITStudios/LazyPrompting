// Host-owned approval for ordinary ChatGPT goal contracts. This is NOT
// Codex V1 goal_run or agent_run V2, and cannot send or read ChatGPT.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Manager;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Limits {
    max_iterations: u32,
    max_minutes: u32,
    max_model_tokens: u32,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProposedGoal {
    workspace_id: String,
    repository: String,
    branch: String,
    base_sha: String,
    objective: String,
    acceptance: Vec<String>,
    constraints: Vec<String>,
    non_goals: Vec<String>,
    preserve: Vec<String>,
    allowed_actions: Vec<String>,
    limits: Limits,
}

pub(crate) fn schema(action: &str) -> Value {
    if action == "status" {
        return json!({"type":"object","additionalProperties":false,
            "required":["workspaceId"],
            "properties":{"workspaceId":{"type":"string",
                "pattern":"^workspace-(0[1-9]|10)$"}}});
    }
    json!({"type":"object","additionalProperties":false,
        "required":["workspaceId","repository","branch","baseSha",
            "objective","acceptance","constraints","nonGoals","preserve",
            "allowedActions","limits"],
        "properties":{
            "workspaceId":{"type":"string","pattern":"^workspace-(0[1-9]|10)$"},
            "repository":{"type":"string","maxLength":201},
            "branch":{"type":"string","minLength":1,"maxLength":200},
            "baseSha":{"type":"string","pattern":"^[a-f0-9]{40}$"},
            "objective":{"type":"string","minLength":1,"maxLength":2000},
            "acceptance":{"type":"array","minItems":1,"maxItems":8,
                "items":{"type":"string","minLength":1,"maxLength":400}},
            "constraints":{"type":"array","maxItems":12,
                "items":{"type":"string","minLength":1,"maxLength":300}},
            "nonGoals":{"type":"array","maxItems":8,
                "items":{"type":"string","minLength":1,"maxLength":300}},
            "preserve":{"type":"array","maxItems":12,
                "items":{"type":"string","minLength":1,"maxLength":300}},
            "allowedActions":{"type":"array","minItems":1,"maxItems":12,
                "items":{"type":"string","minLength":1,"maxLength":200}},
            "limits":{"type":"object","additionalProperties":false,
                "required":["maxIterations","maxMinutes","maxModelTokens"],
                "properties":{
                    "maxIterations":{"type":"integer","minimum":1,"maximum":1000},
                    "maxMinutes":{"type":"integer","minimum":1,"maximum":10080},
                    "maxModelTokens":{"type":"integer","minimum":1,"maximum":100000000}
                }}
        }})
}

fn workspace(input: &Value) -> Result<&str, String> {
    let fields = input.as_object().ok_or("GOAL_INPUT_NOT_AN_OBJECT")?;
    let id = fields.get("workspaceId").and_then(Value::as_str)
        .ok_or("GOAL_WORKSPACE_REQUIRED")?;
    crate::embedded_webview::label_for(id)?;
    Ok(id)
}

fn verify_status(workspace_id: &str, result: Value) -> Result<Value, String> {
    if result["source"] != "NATIVE_WORKSPACE_GOAL"
        || result["schemaVersion"] != 1
        || result["workspaceId"] != workspace_id
        || result["nextPromptAllowed"] != false
        || result["qa"] != "NOT_EXECUTED"
        || result["chatTurnVerified"] != false
        || result["sourceVerified"] != false
        || !result["phase"].is_string()
    {
        return Err("GOAL_STATUS_REPLY_INVALID".into());
    }
    Ok(result)
}

fn do_request(app: &tauri::AppHandle, action: &str, input: Value) -> Result<Value, String> {
    let workspace_id = workspace(&input)?.to_owned();
    let root = app.path().resource_dir()
        .map_err(|_| "GOAL_GATEWAY_RESOURCES_UNAVAILABLE")?.join("gateway");
    let gateway = app.state::<crate::gateway_session::GatewaySession>();
    gateway.probe_packaged(&root)?;
    if action == "status" {
        if input.as_object().is_none_or(|x| x.len() != 1) {
            return Err("GOAL_STATUS_INPUT_INVALID".into());
        }
        let status = gateway.workspace_goal(app, "status",
            json!({"workspaceId":workspace_id.as_str()}))?;
        return verify_status(&workspace_id, status);
    }
    let scope: ProposedGoal = serde_json::from_value(input)
        .map_err(|_| "GOAL_INPUT_INVALID")?;
    // The native host, not Codex or model text, chooses the goal identity.
    let mut entropy = [0u8; 16];
    getrandom::getrandom(&mut entropy).map_err(|_| "GOAL_ENTROPY_UNAVAILABLE")?;
    let goal_id = format!("goal-{}", crate::native_ipc_pipe::hex(&entropy));
    let preview = gateway.workspace_goal(app, "preview",
        json!({"goalId":goal_id.as_str(),"request":scope}))?;
    if preview["source"] == "NATIVE_WORKSPACE_GOAL" &&
        preview["status"] == "BLOCKED" &&
        preview["nextPromptAllowed"] == false &&
        matches!(preview["reason"].as_str(),
            Some("GOAL_ALREADY_EXISTS" | "GOAL_OUTBOX_NOT_QUIESCENT")) {
        return Ok(preview);
    }
    if preview["source"] != "NATIVE_WORKSPACE_GOAL_PREVIEW" ||
        preview["nextPromptAllowed"] != false ||
        preview["qa"] != "NOT_EXECUTED" {
        return Err("GOAL_PREVIEW_DENIED_OR_UNVERIFIED".into());
    }
    let contract = preview.get("contract").ok_or("GOAL_PREVIEW_MISSING")?;
    if contract["goalId"].as_str() != Some(goal_id.as_str()) ||
        contract["workspaceId"].as_str() != Some(workspace_id.as_str()) ||
        contract["revision"].as_u64() != Some(1) ||
        contract["schemaVersion"].as_u64() != Some(1) ||
        !contract["goalHash"].as_str().is_some_and(|s|
            s.len()==64 && s.bytes().all(|c| c.is_ascii_hexdigit())) {
        return Err("GOAL_PREVIEW_SCOPE_MISMATCH".into());
    }
    let rendered = serde_json::to_string_pretty(contract)
        .map_err(|_| "GOAL_PREVIEW_INVALID")?;
    if rendered.chars().count() > 7000 {
        return Err("GOAL_OPERATOR_REVIEW_TOO_LARGE".into());
    }
    let owner = crate::goal_runs::approval_owner(app)?;
    let message = format!(
        "Approve this exact ChatGPT goal contract for {workspace_id}?\n\
         No ChatGPT prompt, worker, browser automation, write or release \
         is authorized.\n\
         The source SHA is USER/CLIENT SUPPLIED and NOT verified.\n\
         The goal will remain PAUSED / UNBOUND.\n\n{rendered}"
    );
    if !crate::operator_confirmation::confirm(
        owner, "LazyPrompting | Approve goal (no dispatch)", &message
    )? {
        return Ok(json!({"source":"NATIVE_WORKSPACE_GOAL",
            "workspaceId":workspace_id,"status":"DECLINED",
            "nextPromptAllowed":false,"qa":"NOT_EXECUTED"}));
    }
    let approval = json!({
        "source":"NATIVE_HOST","trusted":true,"operatorApproved":true,
        "operation":"APPROVE_GOAL","goalId":goal_id.as_str(),
        "workspaceId":workspace_id.as_str(),"goalHash":contract["goalHash"],
        "revision":1,"repository":contract["repository"],
        "branch":contract["branch"],"baseSha":contract["baseSha"]
    });
    let saved = gateway.workspace_goal(app,"commit",
        json!({"contract":contract,"approval":approval}))
        .map_err(|_| "GOAL_COMMIT_RECONCILE_REQUIRED")?;
    let result = verify_status(&workspace_id,saved)?;
    if result["phase"] != "PAUSED" || result["chatState"] != "UNBOUND" ||
        result["goalId"].as_str() != Some(goal_id.as_str()) ||
        result["goalRevision"].as_u64() != Some(1) ||
        result["operatorApproved"] != true {
        return Err("GOAL_COMMIT_RECONCILE_REQUIRED".into());
    }
    // Verify durable readback without replaying a failed or unknown write.
    let actual = gateway.workspace_goal(app,"status",json!({"workspaceId":workspace_id}))
        .map_err(|_| "GOAL_COMMIT_RECONCILE_REQUIRED")?;
    let actual = verify_status(&workspace_id,actual)?;
    if actual != result {
        return Err("GOAL_COMMIT_RECONCILE_REQUIRED".into());
    }
    Ok(result)
}

pub(crate) async fn request(
    app: &tauri::AppHandle, action: &str, input: Value
) -> Result<Value, String> {
    if !matches!(action,"prepare"|"status") {
        return Err("GOAL_ACTION_NOT_SUPPORTED".into());
    }
    // Native gateway calls and OS operator approval never block the UI thread.
    let app=app.clone();
    let action=action.to_owned();
    tauri::async_runtime::spawn_blocking(move || do_request(&app,&action,input))
        .await.map_err(|_| "GOAL_NATIVE_WORKER_UNAVAILABLE".to_owned())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn schema_denies_model_supplied_approval_and_unbounded_actions() {
        let prepare=schema("prepare");
        assert_eq!(prepare["additionalProperties"],false);
        assert!(prepare["properties"].get("approved").is_none());
        assert!(prepare["properties"].get("send").is_none());
        assert_eq!(prepare["properties"]["limits"]["additionalProperties"],false);
        let status=schema("status");
        assert_eq!(status["required"],json!(["workspaceId"]));
        assert!(status["properties"].get("goalId").is_none());
    }
    #[test]
    fn status_rejects_forged_delivery_or_wrong_workspace() {
        let valid=json!({"source":"NATIVE_WORKSPACE_GOAL","schemaVersion":1,
            "workspaceId":"workspace-01","goalId":null,"goalRevision":null,
            "phase":"UNINITIALIZED","chatState":null,"pendingTask":false,
            "requiresReconciliation":false,"operatorApproved":false,
            "sourceVerified":false,"chatTurnVerified":false,
            "nextPromptAllowed":false,"qa":"NOT_EXECUTED"});
        assert!(verify_status("workspace-01", valid.clone()).is_ok());
        assert!(verify_status("workspace-02",valid.clone()).is_err());
        assert!(verify_status("workspace-01",
            json!({"source":"NATIVE_WORKSPACE_GOAL","schemaVersion":1,
                "workspaceId":"workspace-01","phase":"READY",
                "sourceVerified":false,"chatTurnVerified":false,
                "nextPromptAllowed":true,"qa":"NOT_EXECUTED"})).is_err());
    }
}
