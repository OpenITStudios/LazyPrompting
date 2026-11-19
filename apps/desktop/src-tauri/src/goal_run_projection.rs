use serde_json::{json, Value};

// Pure, bounded projections for the existing native Codex V1 goal source.
// These functions never read state, authorize execution, or assert QA.

pub(crate) fn listed_goal_state(raw: &str) -> &'static str {
    match raw {
        "AWAITING_SCOPE_REVIEW" => "AWAITING_SCOPE_REVIEW",
        "REVIEW_INTERRUPTED" => "REVIEW_INTERRUPTED",
        "SCOPE_REVIEWED" => "SCOPE_REVIEWED",
        "STARTING" => "STARTING",
        "RUNNING" => "RUNNING",
        "PAUSE_REQUESTED" => "PAUSE_REQUESTED",
        "PAUSED" => "PAUSED",
        "NEEDS_ATTENTION" => "NEEDS_ATTENTION",
        "REVIEW_COMPLETE" => "REVIEW_COMPLETE",
        "CODING_COMPLETE" => "CODING_COMPLETE",
        "STOPPED" => "STOPPED",
        "DECLINED" => "DECLINED",
        "RECONCILE_REQUIRED" => "RECONCILE_REQUIRED",
        _ => "RECONCILE_REQUIRED",
    }
}
// Sanitize the EXISTING native goal_run.report task projection. It remains a
// runner checkpoint, not independent QA or an authenticated ChatGPT turn.
pub(crate) fn listed_goal_tasks(status: &Value) -> Result<Vec<Value>, String> {
    let tasks = status["tasks"]
        .as_array()
        .ok_or("GOAL_LIST_TASKS_INVALID")?;
    if tasks.len() > 8 {
        return Err("GOAL_LIST_TASKS_INVALID".into());
    }
    let mut projected = Vec::with_capacity(tasks.len());
    for (index, task) in tasks.iter().enumerate() {
        let task_id = format!("task-{}", index + 1);
        if task["id"].as_str() != Some(task_id.as_str()) {
            return Err("GOAL_LIST_TASK_ID_MISMATCH".into());
        }
        let state = match task["state"].as_str() {
            Some("QUEUED") => "QUEUED",
            Some("RUNNING") => "RUNNING",
            Some("REVIEWED") => "REVIEWED",
            Some("VERIFIED") => "VERIFIED",
            Some("BLOCKED") => "BLOCKED",
            Some("STOPPED") => "STOPPED",
            Some("PAUSED") => "PAUSED",
            Some("RECONCILE_REQUIRED") => "RECONCILE_REQUIRED",
            _ => "UNKNOWN",
        };
        let checks = task["checkExitCodes"]
            .as_array()
            .ok_or("GOAL_LIST_CHECKS_INVALID")?;
        if checks.len() > 2 || checks.iter().any(|value| value.as_i64().is_none()) {
            return Err("GOAL_LIST_CHECKS_INVALID".into());
        }
        let verification = &task["verification"];
        let recorded_check = if verification.is_null() {
            "NOT_RECORDED"
        } else {
            match (
                verification["pass"].as_bool(),
                verification["exitCode"].as_i64(),
            ) {
                (Some(true), Some(0)) => "RECORDED_PASS",
                (Some(false), Some(_)) => "RECORDED_FAIL",
                _ => return Err("GOAL_LIST_VERIFICATION_INVALID".into()),
            }
        };
        projected.push(json!({"id":task_id,
            "state":state,"recordedCheck":recorded_check,
            "recordedChecks":checks.len(),
            "lastExitCode":checks.last().and_then(Value::as_i64)}));
    }
    Ok(projected)
}
// An approved scope is not an executable capability when the run has
// stopped, completed or requires reconciliation. Report the effective state.
pub(crate) fn goal_execution_available(approved: bool, effective_state: &str) -> bool {
    approved && matches!(effective_state, "STARTING" | "RUNNING")
}

// Code Mode's receipt stays behind the original turn/outbox correlation.
// This projection deliberately excludes threadId, promptId, branch, paths,
// worker text, and all claims of native final-turn/QA attestation.
pub(crate) fn code_mode_project_receipt(
    receipt: &Value,
    run_id: &str,
    task_id: &str,
    turn_id: &str,
) -> Result<Value, String> {
    if receipt["source"] != "NATIVE_APPROVED_GOAL_RECORD"
        || receipt["kind"] != "CODEX_TURN_RECORD"
        || receipt["runId"] != run_id
        || receipt["taskId"] != task_id
        || receipt["turnId"] != turn_id
        || receipt["recordedCompleted"] != true
        || !receipt["processNotificationObserved"].is_boolean()
        || !matches!(
            receipt["turnObservationKind"].as_str(),
            Some("LEGACY_RECORD_ONLY" | "TURN_STATUS_QUERY_ONLY" | "EVENT_AND_QUERY_CORRELATED")
        )
        || receipt["finalTurnHostAttested"] != false
        || receipt["qa"] != "NOT_EXECUTED"
        || receipt["acceptancePassed"] != false
        || receipt["nextPromptAllowed"] != false
    {
        return Err("GOAL_CODE_MODE_RECEIPT_INVALID".into());
    }
    Ok(json!({
        "source":"NATIVE_CODEX_V1_TURN_RECEIPT","schemaVersion":1,
        "runId":run_id,"taskId":task_id,"turnId":turn_id,
        "recordedCompleted":true,
        "processNotificationObserved":receipt["processNotificationObserved"],
        "turnObservationKind":receipt["turnObservationKind"],
        "finalTurnHostAttested":false,"qa":"NOT_EXECUTED",
        "acceptancePassed":false,"nextPromptAllowed":false
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_projection_is_bounded_and_does_not_expose_worker_data() {
        let source = json!({"tasks":[{
            "id":"task-1","state":"RUNNING","checkExitCodes":[0],
            "verification":{"pass":true,"exitCode":0},
            "summary":"private worker output","threadId":"private-thread",
            "worktree":"C:/private/path"
        }]});
        let tasks = listed_goal_tasks(&source).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0]["recordedCheck"], "RECORDED_PASS");
        assert_eq!(tasks[0]["lastExitCode"], 0);
        assert!(tasks[0].get("summary").is_none());
        assert!(tasks[0].get("threadId").is_none());
        assert!(tasks[0].get("worktree").is_none());
        assert_eq!(listed_goal_state("UNKNOWN_NATIVE_STATE"), "RECONCILE_REQUIRED");
        assert_eq!(listed_goal_tasks(&json!({"tasks":[{"id":"task-2"}]}))
            .unwrap_err(), "GOAL_LIST_TASK_ID_MISMATCH");
        assert_eq!(listed_goal_tasks(&json!({"tasks":[{"id":"task-1",
            "checkExitCodes":[0,0,0],"verification":null}]}))
            .unwrap_err(), "GOAL_LIST_CHECKS_INVALID");
        assert_eq!(listed_goal_tasks(&json!({"tasks":[{"id":"task-1",
            "checkExitCodes":[],"verification":{"pass":true,"exitCode":2}}]}))
            .unwrap_err(), "GOAL_LIST_VERIFICATION_INVALID");
    }

    #[test]
    fn code_mode_receipt_keeps_only_correlated_observations() {
        let receipt = json!({
            "source":"NATIVE_APPROVED_GOAL_RECORD","kind":"CODEX_TURN_RECORD",
            "runId":"run.abc","taskId":"task-1","turnId":"turn-1",
            "recordedCompleted":true,"processNotificationObserved":true,
            "turnObservationKind":"EVENT_AND_QUERY_CORRELATED",
            "finalTurnHostAttested":false,"qa":"NOT_EXECUTED",
            "acceptancePassed":false,"nextPromptAllowed":false,
            "threadId":"private-thread","prompt":"private prompt"
        });
        let projected = code_mode_project_receipt(
            &receipt, "run.abc", "task-1", "turn-1").unwrap();
        assert_eq!(projected["source"], "NATIVE_CODEX_V1_TURN_RECEIPT");
        assert_eq!(projected["processNotificationObserved"], true);
        assert!(projected.get("prompt").is_none());
        assert!(projected.get("threadId").is_none());
        assert_eq!(projected["finalTurnHostAttested"], false);
        assert_eq!(projected["nextPromptAllowed"], false);
        assert_eq!(code_mode_project_receipt(
            &receipt, "different.run", "task-1", "turn-1").unwrap_err(),
            "GOAL_CODE_MODE_RECEIPT_INVALID");
        let mut false_qa = receipt;
        false_qa["qa"] = json!("PASS");
        assert_eq!(code_mode_project_receipt(
            &false_qa, "run.abc", "task-1", "turn-1").unwrap_err(),
            "GOAL_CODE_MODE_RECEIPT_INVALID");
    }

    #[test]
    fn execution_hint_never_promotes_pause_stop_or_unknown_state() {
        for state in ["PAUSED","STOPPED","RECONCILE_REQUIRED",
            "NEEDS_ATTENTION","CODING_COMPLETE","DECLINED"] {
            assert!(!goal_execution_available(true, state));
        }
        assert!(!goal_execution_available(false, "RUNNING"));
        assert!(goal_execution_available(true, "STARTING"));
        assert!(goal_execution_available(true, "RUNNING"));
    }
}
