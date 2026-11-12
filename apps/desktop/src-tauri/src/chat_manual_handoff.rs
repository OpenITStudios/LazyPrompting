// Host-formatted manual prompt for ordinary ChatGPT Chat.
// This does NOT communicate with ChatGPT, create chats, persist or verify
// conversation state, authorize repository work or assert QA completion.
// The installed MCP client is authenticated and workspace-leased by
// browser_mcp_pipe.rs before this pure formatter is invoked.
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HandoffRequest {
    workspace_id: String,
    goal: String,
    acceptance: Vec<String>,
    repository: Option<String>,
    branch: Option<String>,
    base_sha: Option<String>,
    next_step: Option<String>,
}

pub(crate) fn schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["workspaceId", "goal", "acceptance"],
        "properties": {
            "workspaceId": {"type":"string","pattern":"^workspace-(0[1-9]|10)$"},
            "goal": {"type":"string","minLength":1,"maxLength":2000},
            "acceptance": {"type":"array","minItems":1,"maxItems":8,
                "items":{"type":"string","minLength":1,"maxLength":400}},
            "repository": {"type":"string","minLength":3,"maxLength":201,
                "description":"Optional unverified owner/repository name"},
            "branch": {"type":"string","minLength":1,"maxLength":128},
            "baseSha": {"type":"string","pattern":"^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$"},
            "nextStep": {"type":"string","minLength":1,"maxLength":600}
        }
    })
}

fn bounded(value: &str, limit: usize) -> bool {
    !value.trim().is_empty()
        && value.len() <= limit
        && value.chars().all(|ch| {
            !ch.is_control() || matches!(ch, '\n' | '\r' | '\t')
        })
}

fn repo_component(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && !matches!(value, "." | "..")
        && value.bytes().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, b'.' | b'_' | b'-')
        })
}

fn valid_repository(value: &str) -> bool {
    let segments: Vec<_> = value.split('/').collect();
    segments.len() == 2 && segments.iter().all(|component| repo_component(component))
}

fn valid_branch(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && !value.contains("..")
        && !value.starts_with('/')
        && !value.ends_with('/')
        && value.bytes().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, b'.' | b'_' | b'-' | b'/')
        })
}

fn quoted(value: &str) -> Result<String, String> {
    serde_json::to_string(value).map_err(|_| "MANUAL_CHAT_DRAFT_ENCODE_FAILED".into())
}

pub(crate) fn prepare(input: Value) -> Result<Value, String> {
    let request: HandoffRequest =
        serde_json::from_value(input).map_err(|_| "INVALID_MANUAL_CHAT_INPUT")?;
    crate::embedded_webview::label_for(&request.workspace_id)?;
    if !bounded(&request.goal, 2000)
        || !(1..=8).contains(&request.acceptance.len())
        || request.acceptance.iter().any(|item| !bounded(item, 400))
        || request.next_step.as_deref().is_some_and(|step| !bounded(step, 600))
    {
        return Err("INVALID_MANUAL_CHAT_GOAL".into());
    }
    match (request.repository.as_deref(), request.branch.as_deref()) {
        (None, None) => {
            if request.base_sha.is_some() {
                return Err("INVALID_MANUAL_CHAT_PROJECT_REFERENCE".into());
            }
        }
        (Some(repository), Some(branch)) => {
            if !valid_repository(repository) || !valid_branch(branch) {
                return Err("INVALID_MANUAL_CHAT_PROJECT_REFERENCE".into());
            }
        }
        _ => return Err("INVALID_MANUAL_CHAT_PROJECT_REFERENCE".into()),
    }
    if request.base_sha.as_deref().is_some_and(|sha| {
        !matches!(sha.len(), 40 | 64) || !sha.bytes().all(|ch| ch.is_ascii_hexdigit())
    }) {
        return Err("INVALID_MANUAL_CHAT_SOURCE_SHA".into());
    }

    let mut draft = String::from(
        "Continue this goal in the current ordinary, persistent ChatGPT Chat (not Temporary Chat or Work).\n\
         This is a manually reviewed continuation draft, not a verified host dispatch. \
         All goal/project details below are supplied by an MCP client; verify them independently.\n",
    );
    draft.push_str(&format!("Goal: {}\n", quoted(&request.goal)?));
    draft.push_str("Acceptance criteria:\n");
    for (index, criterion) in request.acceptance.iter().enumerate() {
        draft.push_str(&format!("{}. {}\n", index + 1, quoted(criterion)?));
    }
    if let (Some(repository), Some(branch)) =
        (request.repository.as_deref(), request.branch.as_deref())
    {
        draft.push_str(&format!(
            "Project reference (NOT host-verified): {} at branch {}\n",
            quoted(repository)?,
            quoted(branch)?
        ));
    }
    if let Some(sha) = request.base_sha.as_deref() {
        draft.push_str(&format!(
            "Reported source SHA (NOT host-verified): {}\n",
            quoted(sha)?
        ));
    }
    if let Some(step) = request.next_step.as_deref() {
        draft.push_str(&format!("Proposed next step (NOT authorization): {}\n", quoted(step)?));
    }
    draft.push_str(
        "Before acting, reconcile the current project source/branch and previous chat context. \
         Ask about missing context rather than inventing prior responses. \
         Do not claim QA passed without independent evidence. \
         Do not expand permissions, modify another repository, push, merge or release without authorization.\n\
         Explain the next concrete step, evidence required and any blockers.",
    );
    if draft.len() > 12_000 {
        return Err("MANUAL_CHAT_DRAFT_TOO_LARGE".into());
    }
    Ok(json!({
        "status": "DRAFT_ONLY",
        "source": "HOST_FORMATTED_UNVERIFIED_CLIENT_INPUT",
        "workspaceId": request.workspace_id,
        "chatMode": "ORDINARY_PERSISTENT",
        "delivery": "MANUAL_COPY_PASTE",
        "draftPrompt": draft,
        "sent": false,
        "sessionVerified": false,
        "resultVerified": false,
        "operatorReviewRequired": true,
        "nextPromptAllowed": false,
        "qa": "NOT_EXECUTED"
    }))
}

#[cfg(test)]
mod tests {
    use super::{prepare, schema};
    use serde_json::json;

    #[test]
    fn schema_requires_exact_workspace_and_manual_goal_fields() {
        let s = schema();
        assert_eq!(s["additionalProperties"], false);
        assert_eq!(s["required"], json!(["workspaceId", "goal", "acceptance"]));
        assert!(s["properties"].get("clientId").is_none());
        assert!(s["properties"].get("approved").is_none());
        assert!(s["properties"].get("send").is_none());
    }

    #[test]
    fn codex_or_opencode_client_data_only_creates_a_reviewable_draft() {
        let receipt = prepare(json!({
            "workspaceId": "workspace-02",
            "goal": "Review the sci-fi CTF map",
            "acceptance": ["Identify missing assets", "Confirm map layout"],
            "repository": "OpenITStudios/LazyPrompting",
            "branch": "Local",
            "baseSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "nextStep": "Inspect the map specification"
        }))
        .unwrap();
        assert_eq!(receipt["status"], "DRAFT_ONLY");
        assert_eq!(receipt["delivery"], "MANUAL_COPY_PASTE");
        assert_eq!(receipt["chatMode"], "ORDINARY_PERSISTENT");
        assert_eq!(receipt["sent"], false);
        assert_eq!(receipt["sessionVerified"], false);
        assert_eq!(receipt["resultVerified"], false);
        assert_eq!(receipt["nextPromptAllowed"], false);
        assert_eq!(receipt["qa"], "NOT_EXECUTED");
        let text = receipt["draftPrompt"].as_str().unwrap();
        assert!(text.contains("ordinary, persistent ChatGPT Chat"));
        assert!(text.contains("NOT host-verified"));
        assert!(text.contains("Review the sci-fi CTF map"));
        assert!(!text.contains("?temporary-chat=true"));
    }

    #[test]
    fn invalid_or_authority_claiming_inputs_fail_closed() {
        let base = json!({
            "workspaceId": "workspace-01",
            "goal": "Inspect the repository",
            "acceptance": ["Report actual source evidence"]
        });
        let mut cases = Vec::new();
        cases.push(json!({"workspaceId":"workspace-11","goal":"Work",
            "acceptance":["Check"]}));
        cases.push(json!({"workspaceId":"workspace-01","goal":" ",
            "acceptance":["Check"]}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work",
            "acceptance":[]}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work",
            "acceptance":["Check"],"repository":"OpenITStudios/LazyPrompting"}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work",
            "acceptance":["Check"],"repository":"OpenITStudios/LazyPrompting",
            "branch":"../main"}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work",
            "acceptance":["Check"],"baseSha":"abcd"}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work",
            "acceptance":["Check"],"approved":true}));
        cases.push(json!({"workspaceId":"workspace-01","goal":"Work\u{0000}",
            "acceptance":["Check"]}));
        for input in cases {
            assert!(prepare(input).is_err());
        }
        assert!(prepare(base).is_ok());
    }
}
