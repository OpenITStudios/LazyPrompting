use crate::gateway_session::GatewaySession;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::OnceLock,
};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Scope {
    request_id: String,
    objective: String,
    repository_path: PathBuf,
    base_ref: String,
    acceptance: Vec<String>,
    #[serde(default)]
    coding_tasks: Vec<CodingTask>,
    #[serde(default)]
    limits: Limits,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
struct CodingTask {
    files: Vec<String>,
    verify: Vec<String>,
}

impl Scope {
    fn approval(&self) -> &'static [u8] {
        if self.coding_tasks.is_empty() {
            b"read-only-v1"
        } else {
            b"worktree-write-v1"
        }
    }
    fn mode(&self) -> &'static str {
        if self.coding_tasks.is_empty() {
            "READ_ONLY"
        } else {
            "WORKTREE_WRITE"
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
struct Limits {
    max_active_tasks: u8,
    max_turns_per_task: u8,
    wall_minutes: u8,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_active_tasks: 5,
            max_turns_per_task: 6,
            wall_minutes: 30,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Run {
    run_id: String,
    host_epoch: String,
    scope: Scope,
    repository: PathBuf,
    base_sha: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Lookup {
    run_id: String,
    action: Option<String>,
    task_id: Option<String>,
    turn_id: Option<String>,
}

pub(crate) fn schema(action: &str) -> Value {
    let mut schema = if action == "start" {
        json!({"type":"object","additionalProperties":false,"required":["requestId","objective","repositoryPath","baseRef","acceptance"],
        "properties":{
            "requestId":{"type":"string","format":"uuid"},"objective":{"type":"string","maxLength":2000},
            "repositoryPath":{"type":"string","maxLength":1024},"baseRef":{"type":"string","maxLength":128},
            "acceptance":{"type":"array","minItems":1,"maxItems":8,"items":{"type":"string","maxLength":400}},
            "codingTasks":{"type":"array","minItems":1,"maxItems":5,"description":"One entry per acceptance criterion, in order",
                "items":{"type":"object","additionalProperties":false,"required":["files","verify"],"properties":{
                    "files":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","maxLength":180}},
                    "verify":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","maxLength":512},
                        "description":"Approved argv. The first element is an absolute executable path."}}}},
            "limits":{"type":"object","additionalProperties":false,"properties":{
                "maxActiveTasks":{"type":"integer","minimum":1,"maximum":5},
                "maxTurnsPerTask":{"type":"integer","minimum":1,"maximum":6},
                "wallMinutes":{"type":"integer","minimum":1,"maximum":30}}}}})
    } else {
        json!({"type":"object","additionalProperties":false,"required":["runId"],
            "properties":{"runId":{"type":"string","maxLength":69}}})
    };
    if action == "control" {
        schema["required"] = json!(["runId", "action"]);
        schema["properties"]["action"] = json!({"type":"string","enum":["pause","resume","stop"]});
    }
    if action == "turn_receipt" {
        schema["required"] = json!(["runId", "taskId", "turnId"]);
        schema["properties"]["taskId"] = json!({"type":"string","pattern":"^task-[1-8]$"});
        schema["properties"]["turnId"] = json!({"type":"string","minLength":1,"maxLength":128});
    }
    schema
}

pub(crate) async fn request(
    app: &tauri::AppHandle,
    action: &str,
    args: Value,
) -> Result<Value, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?
        .join("goal-runs");
    let app = app.clone();
    let action = action.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        if action == "start" {
            let scope: Scope = serde_json::from_value(args).map_err(|_| "INVALID_GOAL_SCOPE")?;
            return start(&app, &root, scope);
        }
        let lookup: Lookup = serde_json::from_value(args).map_err(|_| "INVALID_GOAL_LOOKUP")?;
        let (request_id, suffix) = lookup.run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
        if !uuid(request_id) || suffix.len() != 32 || !suffix.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("INVALID_RUN_ID".into());
        }
        let file = root.join(format!("{request_id}.json"));
        let run = read_run(&file)?
            .filter(|run| run.run_id == lookup.run_id)
            .ok_or("RUN_NOT_FOUND")?;
        if action != "turn_receipt" && (lookup.task_id.is_some() || lookup.turn_id.is_some()) {
            return Err("INVALID_GOAL_LOOKUP".into());
        }
        match (action.as_str(), lookup.action.as_deref()) {
            ("status" | "report", None) => snapshot(&file, &run),
            ("turn_receipt", None) => turn_receipt(
                &file,
                &run,
                lookup
                    .task_id
                    .as_deref()
                    .ok_or("INVALID_GOAL_TURN_LOOKUP")?,
                lookup
                    .turn_id
                    .as_deref()
                    .ok_or("INVALID_GOAL_TURN_LOOKUP")?,
            ),
            ("control", Some("stop")) => {
                if !file.with_extension("stopped").is_file() {
                    write_atomic(&file.with_extension("stopped"), b"stopped")?;
                }
                snapshot(&file, &run)
            }
            ("control", Some("pause")) => {
                if fs::read(file.with_extension("decision")).ok().as_deref()
                    != Some(run.scope.approval())
                    || file.with_extension("stopped").exists()
                {
                    return Err("GOAL_PAUSE_NOT_AUTHORIZED".into());
                }
                let report = load_report(&file)?.ok_or("GOAL_CHECKPOINT_REQUIRED")?;
                if !has_run_scope_binding(&report) {
                    return Err("GOAL_SCOPE_RECONCILE_REQUIRED".into());
                }
                if !matches!(report["state"].as_str(), Some("RUNNING" | "PAUSED")) {
                    return Err("GOAL_PAUSE_NOT_AVAILABLE".into());
                }
                if report["state"] == "RUNNING" && report["hostEpoch"].as_str() != Some(epoch()?) {
                    return Err("GOAL_PAUSE_HOST_RECONCILE_REQUIRED".into());
                }
                let marker = goal_pause_path(&file);
                if report["state"] == "PAUSED" && !marker.exists() {
                    return Err("GOAL_PAUSE_MARKER_MISSING".into());
                }
                if !marker.exists() {
                    write_atomic(&marker, b"paused")?;
                }
                snapshot(&file, &run)
            }
            ("control", Some("resume")) => {
                if fs::read(file.with_extension("decision")).ok().as_deref()
                    != Some(run.scope.approval())
                    || file.with_extension("stopped").exists()
                {
                    return Err("GOAL_RESUME_NOT_AUTHORIZED".into());
                }
                let report = load_report(&file)?.ok_or("GOAL_CHECKPOINT_REQUIRED")?;
                if !has_run_scope_binding(&report) {
                    return Err("GOAL_SCOPE_RECONCILE_REQUIRED".into());
                }
                if report_requires_close_reconciliation(&report) {
                    return Err("GOAL_CLOSE_RECONCILE_REQUIRED".into());
                }
                if !matches!(
                    report["state"].as_str(),
                    Some("RUNNING" | "NEEDS_ATTENTION" | "PAUSED")
                ) || !report["deadline"].is_u64()
                {
                    return Err("GOAL_RESUME_NOT_AVAILABLE".into());
                }
                let marker = goal_pause_path(&file);
                let paused = marker.exists();
                if paused && report["state"] != "PAUSED" {
                    return Err("GOAL_PAUSE_PENDING".into());
                }
                if !paused && report["state"] == "PAUSED" {
                    return Err("GOAL_PAUSE_MARKER_MISSING".into());
                }
                if paused {
                    fs::remove_file(&marker).map_err(|_| "GOAL_PAUSE_CLEAR_FAILED")?;
                }
                if let Err(error) = launch(&app, &file, &run, true) {
                    if paused {
                        write_atomic(&marker, b"paused")
                            .map_err(|_| "GOAL_PAUSE_RESTORE_FAILED")?;
                    }
                    return Err(error);
                }
                Ok(json!({"runId":run.run_id,"state":"STARTING","mode":run.scope.mode()}))
            }
            _ => Err("INVALID_GOAL_ACTION".into()),
        }
    })
    .await
    .map_err(|_| "GOAL_WORKER_FAILED")?
}

// Native-only Code Mode status projection. Reuse the canonical v1 snapshot
// and the existing sanitized task projection; no raw runner payload escapes.
fn code_mode_project_status(status: &Value, run: &Run) -> Result<Value, String> {
    let raw_state = status["state"]
        .as_str()
        .ok_or("GOAL_CODE_MODE_STATUS_INVALID")?;
    let state = listed_goal_state(raw_state);
    let revision = status["checkpointRevision"]
        .as_u64()
        .ok_or("GOAL_CODE_MODE_STATUS_INVALID")?;
    let tasks = listed_goal_tasks(status)?;
    if tasks.len() > run.scope.acceptance.len() || run.scope.acceptance.len() > 8 {
        return Err("GOAL_CODE_MODE_TASK_SCOPE_INVALID".into());
    }
    if !matches!(run.base_sha.len(), 40 | 64)
        || !run.base_sha.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("GOAL_CODE_MODE_SOURCE_INVALID".into());
    }
    Ok(
        json!({"source":"NATIVE_CODEX_V1_RUN_STATUS","schemaVersion":1,
        "runId":run.run_id,"state":state,"mode":run.scope.mode(),
        "baseSha":run.base_sha,"checkpointRevision":revision,
        "taskCount":run.scope.acceptance.len(),"tasks":tasks,
        "qa":"NOT_VERIFIED","chatTurnVerified":false,
        "nextPromptAllowed":false}),
    )
}

// Native status access is separate from the public goal_run.status output.
// The already-owner-bound native MCP route calls this only after lease checking.
fn code_mode_status_at(root: &Path, run_id: &str) -> Result<Value, String> {
    let (request_id, suffix) = run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
    if !uuid(request_id)
        || suffix.len() != 32
        || !suffix.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err("INVALID_RUN_ID".into());
    }
    let root_meta = fs::symlink_metadata(root).map_err(|_| "GOAL_CODE_MODE_STORAGE_UNAVAILABLE")?;
    if !root_meta.is_dir() || root_meta.file_type().is_symlink() {
        return Err("GOAL_CODE_MODE_STORAGE_UNSAFE".into());
    }
    let file = root.join(format!("{request_id}.json"));
    let metadata = fs::symlink_metadata(&file).map_err(|_| "GOAL_CODE_MODE_RECORD_UNAVAILABLE")?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 64 * 1024 {
        return Err("GOAL_CODE_MODE_RECORD_UNSAFE".into());
    }
    let run = read_run(&file)?.ok_or("GOAL_CODE_MODE_RECORD_UNAVAILABLE")?;
    if run.run_id != run_id || run.scope.request_id != request_id {
        return Err("GOAL_CODE_MODE_RECORD_SCOPE_MISMATCH".into());
    }
    let decision_path = file.with_extension("decision");
    let approval_meta =
        fs::symlink_metadata(&decision_path).map_err(|_| "GOAL_CODE_MODE_APPROVAL_REQUIRED")?;
    if !approval_meta.is_file()
        || approval_meta.file_type().is_symlink()
        || approval_meta.len() > 64
    {
        return Err("GOAL_CODE_MODE_APPROVAL_REQUIRED".into());
    }
    let approval = fs::read(decision_path).map_err(|_| "GOAL_CODE_MODE_APPROVAL_REQUIRED")?;
    if approval != run.scope.approval() {
        return Err("GOAL_CODE_MODE_APPROVAL_REQUIRED".into());
    }
    code_mode_project_status(&snapshot(&file, &run)?, &run)
}

// Source-only native wrapper; no new database, scheduler, grant or state owner.
pub(crate) async fn code_mode_status(
    app: &tauri::AppHandle,
    run_id: &str,
) -> Result<Value, String> {
    let run_id = run_id.to_owned();
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?
        .join("goal-runs");
    tauri::async_runtime::spawn_blocking(move || code_mode_status_at(&root, &run_id))
        .await
        .map_err(|_| "GOAL_CODE_MODE_STATUS_UNAVAILABLE".to_owned())?
}

// Code Mode's receipt stays behind the original turn/outbox correlation.
// This projection deliberately excludes threadId, promptId, branch, paths,
// worker text, and all claims of native final-turn/QA attestation.
fn code_mode_project_receipt(
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
fn code_mode_receipt_at(
    root: &Path,
    run_id: &str,
    task_id: &str,
    turn_id: &str,
) -> Result<Value, String> {
    // The canonical status reader already validates record provenance,
    // persisted native approval, file type, bounded size, and the V1 scope.
    let status = code_mode_status_at(root, run_id)?;
    if matches!(
        status["state"].as_str(),
        Some("STOPPED" | "RECONCILE_REQUIRED")
    ) {
        return Err("GOAL_CODE_MODE_RECEIPT_UNAVAILABLE".into());
    }
    let (request_id, _) = run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
    let file = root.join(format!("{request_id}.json"));
    let run = read_run(&file)?.ok_or("GOAL_CODE_MODE_RECORD_UNAVAILABLE")?;
    if run.run_id != run_id || run.scope.request_id != request_id {
        return Err("GOAL_CODE_MODE_RECORD_SCOPE_MISMATCH".into());
    }
    let receipt = turn_receipt(&file, &run, task_id, turn_id)?;
    code_mode_project_receipt(&receipt, run_id, task_id, turn_id)
}
// No new persistence or grant: native MCP verifies the pre-existing goal
// lease before calling this read, and rechecks ownership before returning.
pub(crate) async fn code_mode_receipt(
    app: &tauri::AppHandle,
    run_id: &str,
    task_id: &str,
    turn_id: &str,
) -> Result<Value, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?
        .join("goal-runs");
    let run_id = run_id.to_owned();
    let task_id = task_id.to_owned();
    let turn_id = turn_id.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        code_mode_receipt_at(&root, &run_id, &task_id, &turn_id)
    })
    .await
    .map_err(|_| "GOAL_CODE_MODE_RECEIPT_UNAVAILABLE".to_owned())?
}

// Read-only operator projection of existing Codex v1 files. This does not
// create goals, resume workers, verify QA or bind a ChatGPT workspace.
const MAX_LISTED_GOALS: usize = 10;
const MAX_DISCOVERED_GOALS: usize = 256;
fn listed_goal_state(raw: &str) -> &'static str {
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
fn listed_goal_tasks(status: &Value) -> Result<Vec<Value>, String> {
    let tasks = status["tasks"]
        .as_array()
        .ok_or("GOAL_LIST_TASKS_INVALID")?;
    if tasks.len() > 8 {
        return Err("GOAL_LIST_TASKS_INVALID".into());
    }
    let mut projected = Vec::new();
    for (index, task) in tasks.iter().enumerate() {
        if task["id"].as_str() != Some(format!("task-{}", index + 1).as_str()) {
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
        projected.push(json!({"id":format!("task-{}", index + 1),
            "state":state,"recordedCheck":recorded_check,
            "recordedChecks":checks.len(),
            "lastExitCode":checks.last().and_then(Value::as_i64)}));
    }
    Ok(projected)
}
fn list_goal_run_statuses_at(root: &Path) -> Result<Value, String> {
    let empty = || {
        json!({"source":"NATIVE_CODEX_V1_STATUS","runs":[],
        "truncated":false,"qa":"NOT_VERIFIED","nextPromptAllowed":false})
    };
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(empty()),
        Err(_) => return Err("GOAL_LIST_UNAVAILABLE".into()),
    };
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("GOAL_LIST_UNSAFE_DIRECTORY".into());
    }
    let mut candidates = Vec::new();
    for entry in fs::read_dir(root).map_err(|_| "GOAL_LIST_UNAVAILABLE")? {
        let entry = entry.map_err(|_| "GOAL_LIST_UNAVAILABLE")?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        let Some(request_id) = name.strip_suffix(".json") else {
            continue;
        };
        // Ignores v2 records, work directories and temporary files.
        if !uuid(request_id) {
            continue;
        }
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path).map_err(|_| "GOAL_LIST_RECORD_UNAVAILABLE")?;
        if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 64 * 1024 {
            return Err("GOAL_LIST_RECORD_UNSAFE".into());
        }
        if candidates.len() >= MAX_DISCOVERED_GOALS {
            return Err("GOAL_LIST_CAPACITY_EXCEEDED".into());
        }
        candidates.push((
            metadata.modified().unwrap_or(std::time::UNIX_EPOCH),
            path,
            request_id.to_owned(),
        ));
    }
    candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.2.cmp(&b.2)));
    let truncated = candidates.len() > MAX_LISTED_GOALS;
    let mut runs = Vec::new();
    for (_, path, request_id) in candidates.into_iter().take(MAX_LISTED_GOALS) {
        let run = read_run(&path)?.ok_or("GOAL_LIST_RECORD_UNAVAILABLE")?;
        let (id, suffix) = run
            .run_id
            .split_once('.')
            .ok_or("GOAL_LIST_RECORD_SCOPE_MISMATCH")?;
        if id != request_id
            || run.scope.request_id != request_id
            || suffix.len() != 32
            || !suffix.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("GOAL_LIST_RECORD_SCOPE_MISMATCH".into());
        }
        let status = snapshot(&path, &run)?;
        let state = status["state"]
            .as_str()
            .map(listed_goal_state)
            .unwrap_or("RECONCILE_REQUIRED");
        let revision = status["checkpointRevision"].as_u64().unwrap_or(0);
        let tasks = listed_goal_tasks(&status)?;
        if tasks.len() > run.scope.acceptance.len() {
            return Err("GOAL_LIST_TASK_COUNT_MISMATCH".into());
        }
        runs.push(json!({"runId":run.run_id,"mode":run.scope.mode(),
            "state":state,"checkpointRevision":revision,
            "taskCount":run.scope.acceptance.len(),"tasks":tasks,
            "source":"NATIVE_CODEX_V1_RUN_STATUS","qa":"NOT_VERIFIED",
            "chatTurnVerified":false,"nextPromptAllowed":false}));
    }
    Ok(json!({"source":"NATIVE_CODEX_V1_STATUS","runs":runs,
        "truncated":truncated,"qa":"NOT_VERIFIED","nextPromptAllowed":false}))
}
#[tauri::command]
pub(crate) async fn list_goal_run_statuses(webview: tauri::Webview) -> Result<Value, String> {
    if webview.label() != "main" {
        return Err("GOAL_LIST_MAIN_WINDOW_REQUIRED".into());
    }
    let root = webview
        .app_handle()
        .path()
        .app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?
        .join("goal-runs");
    tauri::async_runtime::spawn_blocking(move || list_goal_run_statuses_at(&root))
        .await
        .map_err(|_| "GOAL_LIST_WORKER_UNAVAILABLE")?
}

fn start(app: &tauri::AppHandle, root: &Path, mut scope: Scope) -> Result<Value, String> {
    scope.request_id.make_ascii_lowercase();
    validate(&scope)?;
    // The same caller-generated request UUID cannot bind two unrelated
    // approval formats. Preserve the legacy v1 file without migration.
    if root.join(format!("{}.v2.json", scope.request_id)).exists() {
        return Err("REQUEST_CONFLICT".into());
    }
    let file = root.join(format!("{}.json", scope.request_id));
    if let Some(run) = read_run(&file)? {
        if run.scope != scope {
            return Err("REQUEST_CONFLICT".into());
        }
        return snapshot(&file, &run);
    }
    let repository =
        dunce::canonicalize(&scope.repository_path).map_err(|_| "INVALID_GOAL_REPOSITORY")?;
    let top = git(&repository, &["rev-parse", "--show-toplevel"])?;
    if dunce::canonicalize(top).ok().as_ref() != Some(&repository) {
        return Err("GOAL_REPOSITORY_ROOT_REQUIRED".into());
    }
    let branch = format!("refs/heads/{}", scope.base_ref);
    git(&repository, &["check-ref-format", &branch])?;
    let base_sha = git(
        &repository,
        &[
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{branch}^{{commit}}"),
        ],
    )?;
    if !matches!(base_sha.len(), 40 | 64) || !base_sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("INVALID_GOAL_BASE_SHA".into());
    }
    let owner = approval_owner(app)?;
    fs::create_dir_all(root).map_err(|_| "GOAL_STORAGE_FAILED")?;
    let run = Run {
        run_id: format!("{}.{}", scope.request_id, random_id()?),
        host_epoch: epoch()?.to_owned(),
        scope,
        repository,
        base_sha,
    };
    let bytes = serde_json::to_vec(&run).map_err(|_| "GOAL_STORAGE_FAILED")?;
    write_atomic(&file, &bytes)?;
    let result = snapshot(&file, &run)?;
    let mut message = format!(
        "Start Codex goal? Mode: {}. Publishing is outside this approval.\n\nRepository: {}\nBranch: {}\nBase commit: {}\n\nGoal:\n{}\n\nAcceptance:\n{}\n\nLimits: {} active tasks, up to {} turns per task, {} minutes.",
        run.scope.mode(),
        run.repository.display(), run.scope.base_ref, run.base_sha, run.scope.objective,
        run.scope.acceptance.join("\n"), run.scope.limits.max_active_tasks,
        run.scope.limits.max_turns_per_task.min(2), run.scope.limits.wall_minutes,
    );
    for (index, task) in run.scope.coding_tasks.iter().enumerate() {
        message.push_str(&format!(
            "\n\nTask {} files: {}\nVerification argv: {}",
            index + 1,
            task.files.join(", "),
            json!(task.verify)
        ));
    }
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let confirmation =
            crate::operator_confirmation::confirm(owner, "LazyPrompting · Goal scope", &message);
        // A busy or failed dialog is a durable hold, not a user decline.
        let decision: &[u8] = match confirmation {
            Ok(true) => run.scope.approval(),
            Ok(false) => b"declined",
            Err("OPERATOR_DIALOG_BUSY") => b"OPERATOR_DIALOG_BUSY",
            Err(_) => b"OPERATOR_DIALOG_UNAVAILABLE",
        };
        if let Err(error) = write_atomic(&file.with_extension("decision"), decision) {
            eprintln!("Goal approval storage: {error}");
            return;
        }
        if confirmation == Ok(true) && !file.with_extension("stopped").exists() {
            if let Err(error) = launch(&app, &file, &run, false) {
                let _ = write_atomic(&file.with_extension("launch-error"), error.as_bytes());
            }
        }
    });
    Ok(result)
}

pub(crate) fn approval_owner(app: &tauri::AppHandle) -> Result<usize, String> {
    // The main window also hosts browser child webviews.
    let window = app.get_window("main").ok_or("GOAL_WINDOW_UNAVAILABLE")?;
    let hwnd = window.hwnd().map_err(|_| "GOAL_WINDOW_UNAVAILABLE")?;
    Ok(hwnd.0 as usize)
}

fn launch(app: &tauri::AppHandle, file: &Path, run: &Run, resume: bool) -> Result<(), String> {
    if git(&run.repository, &["rev-parse", "HEAD"])? != run.base_sha
        || !git(
            &run.repository,
            &["status", "--porcelain", "--untracked-files=all"],
        )?
        .is_empty()
    {
        return Err("GOAL_CLEAN_APPROVED_CHECKOUT_REQUIRED".into());
    }
    let executable = std::env::var_os("LAZYPROMPTING_CODEX_EXE")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute() && path.is_file())
        .ok_or("CODEX_EXECUTABLE_NOT_CONFIGURED")?;
    let root = app
        .path()
        .resource_dir()
        .map_err(|_| "GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
        .join("gateway");
    let gateway = app.state::<GatewaySession>();
    gateway.probe_packaged(&root)?;
    let mut params = json!({
        "action":"goalRun","executable":executable,"cwd":dunce::simplified(&run.repository),
        "dataDir":file.with_extension("run"),"stopFile":file.with_extension("stopped"),
        "objective":run.scope.objective,"acceptance":run.scope.acceptance,
        "baseSha":run.base_sha,"limits":run.scope.limits,"resume":resume,"hostEpoch":epoch()?
    });
    if !run.scope.coding_tasks.is_empty() {
        let repository = dunce::simplified(&run.repository);
        let parent = repository.parent().ok_or("GOAL_WORKTREE_PARENT_REQUIRED")?;
        let root = parent.join(format!(
            ".lazyprompting-worktrees-{}",
            run.run_id.replace('.', "-")
        ));
        params["coding"] =
            json!({"git":find_git(&run.repository)?,"root":root,"tasks":run.scope.coding_tasks});
    }
    gateway.request_codex(params)?;
    Ok(())
}

// Pause is a native-owned, durable request. The runner derives the same
// marker from its approved stopFile (<uuid>.stopped + ".pause") without
// introducing another repository/workspace state owner.
fn goal_pause_path(file: &Path) -> PathBuf {
    let mut path = file.with_extension("stopped").into_os_string();
    path.push(".pause");
    PathBuf::from(path)
}

fn load_report(file: &Path) -> Result<Option<Value>, String> {
    match fs::read(file.with_extension("run").join("report.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| "GOAL_STORAGE_FAILED".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("GOAL_STORAGE_FAILED".into()),
    }
}

// Presence/format check only. The Node runner independently compares the
// fingerprint to its approved invocation. A hash is NOT native authority.
fn has_run_scope_binding(report: &Value) -> bool {
    report["scopeFingerprintVersion"].as_u64() == Some(1)
        && report["scopeFingerprint"].as_str().is_some_and(|hash| {
            hash.len() == 64 && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
        })
}

// A failed Codex child close does not attest a quiescent worker.
// The hold survives an app restart until separately reconciled.
fn report_requires_close_reconciliation(report: &Value) -> bool {
    report["reason"].as_str() == Some("GOAL_SERVER_CLOSE_UNCONFIRMED")
}

pub(crate) fn resume_interrupted(app: tauri::AppHandle) {
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(root) = app.path().app_local_data_dir() else {
            return;
        };
        let Ok(entries) = fs::read_dir(root.join("goal-runs")) else {
            return;
        };
        let Ok(now) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) else {
            return;
        };
        let Ok(current_epoch) = epoch() else { return };
        let mut eligible = entries.filter_map(Result::ok).filter_map(|entry| {
            let path = entry.path();
            if path.extension()?.to_str()? != "json"
                || !uuid(path.file_stem()?.to_str()?)
                || path.with_extension("stopped").exists()
                || goal_pause_path(&path).exists()
            {
                return None;
            }
            let run = read_run(&path).ok()??;
            if fs::read(path.with_extension("decision")).ok().as_deref()
                != Some(run.scope.approval())
            {
                return None;
            }
            let report = load_report(&path).ok()??;
            if report["state"] != "RUNNING"
                || !has_run_scope_binding(&report)
                || report_requires_close_reconciliation(&report)
                || report["hostEpoch"] == current_epoch
                || u128::from(report["deadline"].as_u64()?) <= now.as_millis()
            {
                return None;
            }
            Some((path, run))
        });
        if let Some((file, run)) = eligible.next() {
            // Multiple interrupted runs need explicit scheduling rather than a filesystem ordering.
            if eligible.next().is_none() {
                if let Err(error) = launch(&app, &file, &run, true) {
                    eprintln!("Goal recovery deferred: {error}");
                }
            }
        }
    });
}

// Validate a runner checkpoint against the immutable native-approved scope
// before showing even a terminal result. This is consistency checking, not
// a signed execution receipt or independent QA.
fn report_matches_run_scope(report: &Value, run: &Run) -> bool {
    let Some(phase) = report["state"].as_str() else {
        return false;
    };
    if !matches!(
        phase,
        "RUNNING"
            | "NEEDS_ATTENTION"
            | "PAUSED"
            | "STOPPED"
            | "REVIEW_COMPLETE"
            | "CODING_COMPLETE"
    ) || report["baseSha"].as_str() != Some(run.base_sha.as_str())
        || report["mode"].as_str() != Some(run.scope.mode())
        || report["revision"].as_u64().is_none()
        || report["deadline"].as_u64().is_none()
    {
        return false;
    }
    let Some(tasks) = report["tasks"].as_array() else {
        return false;
    };
    if tasks.len() != run.scope.acceptance.len()
        || tasks.iter().enumerate().any(|(index, task)| {
            task["id"].as_str() != Some(format!("task-{}", index + 1).as_str())
                || task["criterion"].as_str() != Some(run.scope.acceptance[index].as_str())
                || !task["turns"]
                    .as_array()
                    .is_some_and(|turns| turns.len() <= 2)
        })
    {
        return false;
    }
    match phase {
        "REVIEW_COMPLETE" => {
            run.scope.mode() == "READ_ONLY" && tasks.iter().all(|task| task["state"] == "REVIEWED")
        }
        "CODING_COMPLETE" => {
            run.scope.mode() == "WORKTREE_WRITE"
                && tasks.iter().all(|task| {
                    task["state"] == "VERIFIED"
                        && task["verification"]["pass"] == true
                        && task["verification"]["exitCode"] == 0
                        && task["verification"]["changes"]
                            .as_array()
                            .is_some_and(|changes| !changes.is_empty())
                })
        }
        _ => true,
    }
}
// An approved scope is not an executable capability when the run has
// stopped, completed or requires reconciliation. Report the effective state.
fn goal_execution_available(approved: bool, effective_state: &str) -> bool {
    approved && matches!(effective_state, "STARTING" | "RUNNING")
}

fn snapshot(file: &Path, run: &Run) -> Result<Value, String> {
    let decision = match fs::read(file.with_extension("decision")) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(_) => return Err("GOAL_STORAGE_FAILED".into()),
    };
    let state = if file.with_extension("stopped").is_file() {
        "STOPPED"
    } else {
        match decision.as_slice() {
            b"approved" => "SCOPE_REVIEWED",
            approval if approval == run.scope.approval() && run.host_epoch == epoch()? => {
                "STARTING"
            }
            approval if approval == run.scope.approval() => "RECONCILE_REQUIRED",
            b"declined" => "DECLINED",
            b"OPERATOR_DIALOG_BUSY" | b"OPERATOR_DIALOG_UNAVAILABLE" => "RECONCILE_REQUIRED",
            b"" if run.host_epoch == epoch()? => "AWAITING_SCOPE_REVIEW",
            b"" => "REVIEW_INTERRUPTED",
            _ => return Err("GOAL_STORAGE_FAILED".into()),
        }
    };
    let mut result = json!({"runId":run.run_id,"baseSha":run.base_sha,"limits":{
        "maxActiveTasks":run.scope.limits.max_active_tasks,
        "maxTurnsPerTask":run.scope.limits.max_turns_per_task.min(2),
        "wallMinutes":run.scope.limits.wall_minutes},
        "state":state,"checkpointRevision":if state == "STOPPED" {2} else {u8::from(!decision.is_empty())},
        "executionAvailable":false,"mode":run.scope.mode(),"tasks":[]});
    if decision == run.scope.approval() {
        if let Some(report) = load_report(file)? {
            if !report_matches_run_scope(&report, run) {
                // STOP remains authoritative even if a stored report is
                // malformed; no result or completion is accepted.
                if state != "STOPPED" {
                    result["state"] = json!("RECONCILE_REQUIRED");
                }
                result["executionAvailable"] = json!(false);
                result["reason"] = json!("GOAL_RUN_REPORT_SCOPE_MISMATCH");
                return Ok(result);
            }
            // A previous worker has not been confirmed closed. Keep the
            // operator-visible hold even if its task report looks complete.
            // A native STOP marker remains authoritative above this check.
            if state != "STOPPED" && report_requires_close_reconciliation(&report) {
                result["state"] = json!("RECONCILE_REQUIRED");
                result["executionAvailable"] = json!(false);
                result["reason"] = json!("GOAL_SERVER_CLOSE_UNCONFIRMED");
                return Ok(result);
            }
            // Do not display an unsigned legacy running checkpoint as safe
            // for restart; preserve it for operator review instead.
            if matches!(
                report["state"].as_str(),
                Some("RUNNING" | "NEEDS_ATTENTION")
            ) && !has_run_scope_binding(&report)
            {
                if state != "STOPPED" {
                    result["state"] = json!("RECONCILE_REQUIRED");
                }
                result["reason"] = json!("GOAL_SCOPE_RECONCILE_REQUIRED");
                return Ok(result);
            }
            if report["state"] == "PAUSED" && !goal_pause_path(file).exists() {
                if state != "STOPPED" {
                    result["state"] = json!("RECONCILE_REQUIRED");
                }
                result["reason"] = json!("GOAL_PAUSE_MARKER_MISSING");
                return Ok(result);
            }
            if state != "STOPPED" {
                result["state"] = if report["state"] == "RUNNING" && report["hostEpoch"] != epoch()?
                {
                    json!("RECONCILE_REQUIRED")
                } else {
                    report["state"].clone()
                };
            }
            if let Some(revision) = report["revision"].as_u64() {
                result["checkpointRevision"] = json!(revision.saturating_add(1));
            }
            result["reason"] = report["reason"].clone();
            if let Some(tasks) = report["tasks"].as_array() {
                result["tasks"] = json!(tasks
                    .iter()
                    .map(|task| {
                        let latest = task["turns"].as_array().and_then(|turns| turns.last());
                        let checks: Vec<_> = task["turns"].as_array().into_iter().flatten()
                            .filter_map(|turn| turn["verification"]["exitCode"].as_i64())
                            .collect();
                        let text: String = latest
                            .and_then(|turn| turn["text"].as_str())
                            .unwrap_or("")
                            .chars()
                            .take(250)
                            .collect();
                        json!({"id":task["id"],"state":task["state"],"threadId":task["threadId"],
                        "pendingTurnId":task["pendingTurnId"],"reason":task["reason"],
                        "worktree":task["worktree"],"verification":task["verification"],"checkExitCodes":checks,
                        "latestTurnId":latest.map(|turn| &turn["turnId"]),"summary":text})
                    })
                    .collect::<Vec<_>>());
            }
        } else if let Ok(error) = fs::read_to_string(file.with_extension("launch-error")) {
            if state != "STOPPED" {
                result["state"] = json!("NEEDS_ATTENTION");
            }
            result["reason"] = json!(error);
        }
    } else {
        result["reason"] = json!(match decision.as_slice() {
            b"OPERATOR_DIALOG_BUSY" => "OPERATOR_DIALOG_BUSY",
            b"OPERATOR_DIALOG_UNAVAILABLE" => "OPERATOR_DIALOG_UNAVAILABLE",
            _ => "GOAL_EXECUTOR_UNAVAILABLE",
        });
    }
    if state != "STOPPED" && decision == run.scope.approval() && goal_pause_path(file).exists() {
        let quiescent = result["state"] == "PAUSED";
        result["executionAvailable"] = json!(false);
        result["state"] = if quiescent {
            json!("PAUSED")
        } else {
            json!("PAUSE_REQUESTED")
        };
        result["reason"] = if quiescent {
            json!("GOAL_PAUSED")
        } else {
            json!("GOAL_PAUSE_PENDING")
        };
    }
    // Set the execution hint only after all STOP/pause/recovery projections.
    // Earlier validation failures return the conservative false default.
    let effective_state = result["state"].as_str().unwrap_or_default().to_owned();
    result["executionAvailable"] = json!(goal_execution_available(
        decision == run.scope.approval(),
        &effective_state,
    ));
    Ok(result)
}

// A host-owned correlation of existing Codex App Server records, not a new
// final-turn attestation or a QA PASS. A stopped/unapproved run is not readable
// as an actionable receipt. No contents of an agentMessage are returned.
fn turn_receipt(file: &Path, run: &Run, task_id: &str, turn_id: &str) -> Result<Value, String> {
    // Validate the task leaf BEFORE using it to form a filesystem path.
    let slot: usize = task_id
        .strip_prefix("task-")
        .and_then(|n| n.parse().ok())
        .filter(|n: &usize| *n > 0 && *n <= run.scope.acceptance.len())
        .ok_or("INVALID_GOAL_TASK_ID")?;
    if task_id != format!("task-{slot}") {
        return Err("INVALID_GOAL_TASK_ID".into());
    }
    if file.with_extension("stopped").exists()
        || fs::read(file.with_extension("decision")).ok().as_deref() != Some(run.scope.approval())
    {
        return Err("GOAL_TURN_RECEIPT_NOT_AUTHORIZED".into());
    }
    let report = load_report(file)?.ok_or("GOAL_TURN_REPORT_UNAVAILABLE")?;
    let data = fs::read(file.with_extension("run").join(format!("{task_id}.json")))
        .map_err(|_| "GOAL_TURN_OUTBOX_UNAVAILABLE")?;
    let outbox: Value = serde_json::from_slice(&data).map_err(|_| "GOAL_TURN_OUTBOX_CORRUPT")?;
    correlate_turn_receipt(run, task_id, turn_id, &report, &outbox)
}

fn correlate_turn_receipt(
    run: &Run,
    task_id: &str,
    turn_id: &str,
    report: &Value,
    outbox: &Value,
) -> Result<Value, String> {
    let valid_id = |id: &str| {
        !id.is_empty()
            && id.len() <= 128
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_:-".contains(&b))
    };
    let task_number: usize = task_id
        .strip_prefix("task-")
        .and_then(|n| n.parse().ok())
        .filter(|n: &usize| *n > 0 && *n <= run.scope.acceptance.len())
        .ok_or("INVALID_GOAL_TASK_ID")?;
    if task_id != format!("task-{task_number}") || !valid_id(turn_id) {
        return Err("INVALID_GOAL_TURN_ID".into());
    }
    if report["baseSha"].as_str() != Some(run.base_sha.as_str())
        || report["mode"].as_str() != Some(run.scope.mode())
        || !report["revision"].is_u64()
        || outbox["schemaVersion"].as_u64() != Some(1)
    {
        return Err("GOAL_TURN_SOURCE_MISMATCH".into());
    }
    let tasks = report["tasks"]
        .as_array()
        .ok_or("GOAL_TURN_REPORT_INVALID")?;
    if tasks.len() != run.scope.acceptance.len() {
        return Err("GOAL_TURN_REPORT_INVALID".into());
    }
    let task = &tasks[task_number - 1];
    if task["id"].as_str() != Some(task_id)
        || task["criterion"].as_str() != Some(run.scope.acceptance[task_number - 1].as_str())
    {
        return Err("GOAL_TURN_TASK_SCOPE_MISMATCH".into());
    }
    let thread_id = task["threadId"]
        .as_str()
        .filter(|id| valid_id(id))
        .ok_or("GOAL_TURN_THREAD_UNAVAILABLE")?;
    let turns = task["turns"].as_array().ok_or("GOAL_TURN_REPORT_INVALID")?;
    if turns.is_empty() || turns.len() > 2 {
        return Err("GOAL_TURN_REPORT_INVALID".into());
    }
    let mut turn_index = None;
    for (i, turn) in turns.iter().enumerate() {
        if !turn["turnId"].as_str().is_some_and(valid_id) || !turn["text"].is_string() {
            return Err("GOAL_TURN_REPORT_INVALID".into());
        }
        if turn["turnId"].as_str() == Some(turn_id) {
            if turn_index.replace(i).is_some() {
                return Err("GOAL_TURN_AMBIGUOUS".into());
            }
        }
    }
    let turn_index = turn_index.ok_or("GOAL_TURN_NOT_RECORDED")?;
    let items = outbox["items"]
        .as_array()
        .ok_or("GOAL_TURN_OUTBOX_CORRUPT")?;
    let expected_task_id = format!("{task_id}-turn-{}", turn_index + 1);
    let matches: Vec<&Value> = items
        .iter()
        .filter(|item| {
            item["workspaceId"].as_str() == Some(task_id)
                && item["taskId"].as_str() == Some(expected_task_id.as_str())
        })
        .collect();
    if matches.len() != 1 {
        return Err("GOAL_TURN_OUTBOX_AMBIGUOUS".into());
    }
    let item = matches[0];
    if item["sessionId"].as_str() != Some(thread_id)
        || item["state"] != "RESPONSE_VERIFIED"
        || item["responseHandle"].as_str() != Some(turn_id)
        || item["responseId"].as_str() != Some(turn_id)
        || item["contextRevision"].as_u64() != Some(turn_index as u64)
    {
        return Err("GOAL_TURN_OUTBOX_MISMATCH".into());
    }
    let prompt_id = item["promptId"]
        .as_str()
        .filter(|id| valid_id(id))
        .ok_or("GOAL_TURN_OUTBOX_MISMATCH")?;
    // The Node runner may persist a matching Codex notification alongside
    // the queried turn. This is informational process provenance, NEVER
    // a native host-attested final turn or an independent QA receipt.
    let observation = &turns[turn_index]["terminalObservation"];
    let observation_kind = if observation.is_null() {
        "LEGACY_RECORD_ONLY"
    } else {
        if observation["threadId"].as_str() != Some(thread_id)
            || observation["turnId"].as_str() != Some(turn_id)
            || observation["hostAttested"] != false
        {
            return Err("GOAL_TURN_OBSERVATION_SCOPE_MISMATCH".into());
        }
        match observation["kind"].as_str() {
            Some("EVENT_AND_QUERY_CORRELATED")
                if observation["source"] == "CODEX_APP_SERVER_NOTIFICATION" =>
            {
                "EVENT_AND_QUERY_CORRELATED"
            }
            Some("TURN_STATUS_QUERY_ONLY") if observation.get("source").is_none() => {
                "TURN_STATUS_QUERY_ONLY"
            }
            _ => return Err("GOAL_TURN_OBSERVATION_INVALID".into()),
        }
    };
    Ok(json!({
        "kind":"CODEX_TURN_RECORD",
        "source":"NATIVE_APPROVED_GOAL_RECORD",
        "runId":run.run_id.as_str(),
        "taskId":task_id,
        "threadId":thread_id,
        "turnId":turn_id,
        "promptId":prompt_id,
        "branch":run.scope.base_ref.as_str(),
        "baseSha":run.base_sha.as_str(),
        "recordedCompleted":true,
        "processNotificationObserved":observation_kind == "EVENT_AND_QUERY_CORRELATED",
        "turnObservationKind":observation_kind,
        "finalTurnHostAttested":false,
        "qa":"NOT_EXECUTED",
        "acceptancePassed":false,
        "nextPromptAllowed":false
    }))
}

fn validate(scope: &Scope) -> Result<(), String> {
    let bounded = |text: &str, max: usize| {
        !text.trim().is_empty()
            && text.encode_utf16().count() <= max
            && !text
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    };
    if !uuid(&scope.request_id)
        || !bounded(&scope.objective, 2000)
        || !scope.repository_path.is_absolute()
        || !bounded(&scope.repository_path.to_string_lossy(), 1024)
        || scope.base_ref.is_empty()
        || scope.base_ref.len() > 128
        || !scope
            .base_ref
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_./".contains(&b))
        || scope.acceptance.is_empty()
        || scope.acceptance.len() > 8
        || scope.acceptance.iter().any(|item| !bounded(item, 400))
        || !(1..=5).contains(&scope.limits.max_active_tasks)
        || !(1..=6).contains(&scope.limits.max_turns_per_task)
        || !(1..=30).contains(&scope.limits.wall_minutes)
    {
        return Err("INVALID_GOAL_SCOPE".into());
    }
    if !scope.coding_tasks.is_empty() {
        if scope.coding_tasks.len() != scope.acceptance.len()
            || scope.coding_tasks.len() > 5
            || !bounded(&scope.repository_path.to_string_lossy(), 180)
            || scope
                .coding_tasks
                .iter()
                .flat_map(|task| &task.files)
                .map(String::len)
                .sum::<usize>()
                > 2000
            || scope
                .coding_tasks
                .iter()
                .flat_map(|task| &task.verify)
                .map(String::len)
                .sum::<usize>()
                > 3000
        {
            return Err("INVALID_GOAL_CODING_TASKS".into());
        }
        let mut seen = std::collections::HashSet::new();
        for task in &scope.coding_tasks {
            if task.files.is_empty()
                || task.files.len() > 12
                || task.verify.is_empty()
                || task.verify.len() > 12
                || task
                    .verify
                    .iter()
                    .any(|arg| !bounded(arg, 512) || arg.chars().any(char::is_control))
                || !Path::new(&task.verify[0]).is_absolute()
                || !Path::new(&task.verify[0]).is_file()
                || !Path::new(&task.verify[0])
                    .extension()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case("exe"))
                || task.files.iter().any(|file| {
                    file.len() > 180
                        || !file.split('/').all(|part| {
                            !part.is_empty()
                                && !part.ends_with('.')
                                && !part.eq_ignore_ascii_case(".git")
                                && part
                                    .bytes()
                                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
                        })
                        || !seen.insert(file.to_ascii_lowercase())
                })
            {
                return Err("INVALID_GOAL_CODING_TASKS".into());
            }
        }
    }
    Ok(())
}

fn uuid(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, b)| {
            if matches!(i, 8 | 13 | 18 | 23) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

fn find_git(repository: &Path) -> Result<PathBuf, String> {
    let path = std::env::var_os("PATH").ok_or("GOAL_GIT_UNAVAILABLE")?;
    std::env::split_paths(&path)
        .filter(|directory| directory.is_absolute())
        .map(|directory| directory.join("git.exe"))
        .find(|candidate| candidate.is_file() && !candidate.starts_with(repository))
        .ok_or_else(|| "GOAL_GIT_UNAVAILABLE".into())
}

pub(crate) fn git(repository: &Path, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new(find_git(repository)?);
    for (key, _) in std::env::vars_os() {
        if key
            .to_string_lossy()
            .to_ascii_uppercase()
            .starts_with("GIT_")
        {
            command.env_remove(key);
        }
    }
    let output = command
        .current_dir(repository)
        .args(args)
        .stdin(Stdio::null())
        .creation_flags(0x08000000)
        .output()
        .map_err(|_| "GOAL_GIT_UNAVAILABLE")?;
    if !output.status.success() || output.stdout.len() > 8192 {
        return Err("GOAL_GIT_SCOPE_UNRESOLVED".into());
    }
    let value = String::from_utf8(output.stdout).map_err(|_| "GOAL_GIT_SCOPE_UNRESOLVED")?;
    Ok(value.trim_end().to_owned())
}

fn read_run(file: &Path) -> Result<Option<Run>, String> {
    match fs::read(file) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| "GOAL_STORAGE_FAILED".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("GOAL_STORAGE_FAILED".into()),
    }
}

fn random_id() -> Result<String, String> {
    let mut bytes = [0; 16];
    getrandom::getrandom(&mut bytes).map_err(|_| "GOAL_ENTROPY_UNAVAILABLE")?;
    Ok(crate::native_ipc_pipe::hex(&bytes))
}

fn epoch() -> Result<&'static str, String> {
    static EPOCH: OnceLock<String> = OnceLock::new();
    if let Some(value) = EPOCH.get() {
        return Ok(value);
    }
    Ok(EPOCH
        .get_or_init(|| random_id().unwrap_or_default())
        .as_str())
    .and_then(|value| {
        if value.is_empty() {
            Err("GOAL_ENTROPY_UNAVAILABLE".into())
        } else {
            Ok(value)
        }
    })
}

fn write_atomic(file: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = file.with_extension(format!("{}.tmp", random_id()?));
    let result = (|| {
        let mut handle = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        handle.write_all(bytes)?;
        handle.sync_all()?;
        drop(handle);
        // Publish without overwriting an existing request or approval.
        fs::hard_link(&temp, file)
    })();
    let _ = fs::remove_file(&temp);
    result.map_err(|_| "GOAL_STORAGE_FAILED".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_mode_receipt_reuses_native_correlation_and_strips_private_fields() {
        let run_id = "12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef";
        let full = json!({
            "source":"NATIVE_APPROVED_GOAL_RECORD","kind":"CODEX_TURN_RECORD",
            "runId":run_id,"taskId":"task-1","turnId":"turn_01",
            "recordedCompleted":true,"processNotificationObserved":true,
            "turnObservationKind":"EVENT_AND_QUERY_CORRELATED",
            "finalTurnHostAttested":false,"qa":"NOT_EXECUTED",
            "acceptancePassed":false,"nextPromptAllowed":false,
            "threadId":"PRIVATE_THREAD","promptId":"PRIVATE_PROMPT",
            "branch":"SECRET_BRANCH","worktree":"C:\\secret"
        });
        let value = code_mode_project_receipt(&full, run_id, "task-1", "turn_01").unwrap();
        assert_eq!(value["qa"], "NOT_EXECUTED");
        assert_eq!(value["finalTurnHostAttested"], false);
        assert_eq!(value["nextPromptAllowed"], false);
        for forbidden in [
            "PRIVATE_THREAD",
            "PRIVATE_PROMPT",
            "SECRET_BRANCH",
            "secret",
        ] {
            assert!(!value.to_string().contains(forbidden));
        }
        let mut corrupted = full.clone();
        corrupted["finalTurnHostAttested"] = json!(true);
        assert!(code_mode_project_receipt(&corrupted, run_id, "task-1", "turn_01").is_err());
        corrupted = full.clone();
        corrupted["qa"] = json!("PASS");
        assert!(code_mode_project_receipt(&corrupted, run_id, "task-1", "turn_01").is_err());
        corrupted = full.clone();
        corrupted["nextPromptAllowed"] = json!(true);
        assert!(code_mode_project_receipt(&corrupted, run_id, "task-1", "turn_01").is_err());
        corrupted = full.clone();
        corrupted["runId"] = json!("other-run");
        assert!(code_mode_project_receipt(&corrupted, run_id, "task-1", "turn_01").is_err());
    }

    #[test]
    fn code_mode_status_requires_approved_native_v1_record() {
        let root =
            std::env::temp_dir().join(format!("lazyprompting-code-mode-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let request_id = "12345678-1234-1234-1234-123456789abc";
        let scope = Scope {
            request_id: request_id.into(),
            objective: "PRIVATE_GOAL".into(),
            repository_path: PathBuf::from(r"C:\secret\checkout"),
            base_ref: "Local".into(),
            acceptance: vec!["PRIVATE_CRITERION".into()],
            coding_tasks: Vec::new(),
            limits: Limits::default(),
        };
        let run = Run {
            run_id: format!("{request_id}.0123456789abcdef0123456789abcdef"),
            host_epoch: epoch().unwrap().to_owned(),
            scope,
            repository: PathBuf::from(r"C:\secret\checkout"),
            base_sha: "a".repeat(40),
        };
        let file = root.join(format!("{request_id}.json"));
        fs::write(&file, serde_json::to_vec(&run).unwrap()).unwrap();
        assert_eq!(
            code_mode_status_at(&root, &run.run_id).unwrap_err(),
            "GOAL_CODE_MODE_APPROVAL_REQUIRED"
        );
        fs::write(file.with_extension("decision"), b"declined").unwrap();
        assert_eq!(
            code_mode_status_at(&root, &run.run_id).unwrap_err(),
            "GOAL_CODE_MODE_APPROVAL_REQUIRED"
        );
        fs::write(file.with_extension("decision"), run.scope.approval()).unwrap();
        let projected = code_mode_status_at(&root, &run.run_id).unwrap();
        assert_eq!(projected["source"], "NATIVE_CODEX_V1_RUN_STATUS");
        assert_eq!(projected["state"], "STARTING");
        assert_eq!(projected["nextPromptAllowed"], false);
        assert!(!projected.to_string().contains("PRIVATE_GOAL"));
        assert!(!projected.to_string().contains("PRIVATE_CRITERION"));
        fs::write(file.with_extension("stopped"), b"stopped").unwrap();
        assert_eq!(
            code_mode_status_at(&root, &run.run_id).unwrap()["state"],
            "STOPPED"
        );
        assert_eq!(
            code_mode_status_at(&root, "traversal").unwrap_err(),
            "INVALID_RUN_ID"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn code_mode_status_projection_drops_agent_text_paths_and_qa_claims() {
        let scope = Scope {
            request_id: "12345678-1234-1234-1234-123456789abc".into(),
            objective: "PRIVATE_OBJECTIVE".into(),
            repository_path: PathBuf::from(r"C:\secret\repo"),
            base_ref: "Local".into(),
            acceptance: vec!["PRIVATE_ACCEPTANCE".into()],
            coding_tasks: Vec::new(),
            limits: Limits::default(),
        };
        let run = Run {
            run_id: "12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef".into(),
            host_epoch: "epoch".into(),
            scope,
            repository: PathBuf::from(r"C:\secret\repo"),
            base_sha: "a".repeat(40),
        };
        let raw = json!({"state":"RUNNING","checkpointRevision":3,
            "reason":"PRIVATE_REASON","tasks":[{"id":"task-1","state":"VERIFIED",
            "checkExitCodes":[0],"verification":{"pass":true,"exitCode":0,
            "changes":["PRIVATE_FILE"]},"worktree":r"C:\secret\worktree",
            "summary":"PRIVATE_AGENT_MESSAGE","threadId":"PRIVATE_THREAD"}]});
        let view = code_mode_project_status(&raw, &run).unwrap();
        assert_eq!(view["state"], "RUNNING");
        assert_eq!(view["tasks"][0]["recordedCheck"], "RECORDED_PASS");
        assert_eq!(view["qa"], "NOT_VERIFIED");
        assert_eq!(view["nextPromptAllowed"], false);
        let encoded = view.to_string();
        for secret in [
            "PRIVATE_OBJECTIVE",
            "PRIVATE_ACCEPTANCE",
            "PRIVATE_REASON",
            "PRIVATE_FILE",
            "PRIVATE_AGENT_MESSAGE",
            "PRIVATE_THREAD",
            "secret",
        ] {
            assert!(!encoded.contains(secret), "{secret}");
        }
        let mut stopped = raw.clone();
        stopped["state"] = json!("STOPPED");
        assert_eq!(
            code_mode_project_status(&stopped, &run).unwrap()["state"],
            "STOPPED"
        );
        let mut malformed = raw.clone();
        malformed["tasks"][0]["id"] = json!("task-2");
        assert!(code_mode_project_status(&malformed, &run).is_err());
    }

    #[test]
    fn native_goal_task_report_is_bounded_and_not_a_qa_receipt() {
        let raw = json!({"tasks":[
            {"id":"task-1","state":"VERIFIED","verification":{
                "pass":true,"exitCode":0,"changes":["PRIVATE_FILE_NAME"]},
                "checkExitCodes":[0],"summary":"PRIVATE_MODEL_TEXT",
                "worktree":"C:\\private\\worktree"},
            {"id":"task-2","state":"BLOCKED","verification":{
                "pass":false,"exitCode":2},"checkExitCodes":[2],
                "summary":"PRIVATE_UNVERIFIED_OUTPUT"}
        ]});
        let projected = listed_goal_tasks(&raw).unwrap();
        assert_eq!(projected.len(), 2);
        assert_eq!(projected[0]["state"], "VERIFIED");
        assert_eq!(projected[0]["recordedCheck"], "RECORDED_PASS");
        assert_eq!(projected[0]["lastExitCode"], 0);
        assert_eq!(projected[1]["recordedCheck"], "RECORDED_FAIL");
        assert_eq!(projected[1]["lastExitCode"], 2);
        let encoded = json!(projected).to_string();
        for forbidden in [
            "PRIVATE_FILE_NAME",
            "PRIVATE_MODEL_TEXT",
            "PRIVATE_UNVERIFIED_OUTPUT",
            "private\\worktree",
            "changes",
            "summary",
        ] {
            assert!(!encoded.contains(forbidden), "{forbidden}");
        }
        let mut invalid = raw.clone();
        invalid["tasks"][0]["id"] = json!("task-2");
        assert_eq!(
            listed_goal_tasks(&invalid).unwrap_err(),
            "GOAL_LIST_TASK_ID_MISMATCH"
        );
        invalid = raw.clone();
        invalid["tasks"][0]["verification"]["pass"] = json!(true);
        invalid["tasks"][0]["verification"]["exitCode"] = json!(1);
        assert_eq!(
            listed_goal_tasks(&invalid).unwrap_err(),
            "GOAL_LIST_VERIFICATION_INVALID"
        );
        invalid = raw.clone();
        invalid["tasks"][0]["checkExitCodes"] = json!([0, 0, 0]);
        assert_eq!(
            listed_goal_tasks(&invalid).unwrap_err(),
            "GOAL_LIST_CHECKS_INVALID"
        );
        let missing = json!({"tasks":[{"id":"task-1","state":"REVIEWED",
            "verification":null,"checkExitCodes":[]}]});
        let reviewed = listed_goal_tasks(&missing).unwrap();
        assert_eq!(reviewed[0]["recordedCheck"], "NOT_RECORDED");
        assert_eq!(reviewed[0]["lastExitCode"], Value::Null);
        let forged = json!({"tasks":[{"id":"task-1","state":"DONE",
            "verification":null,"checkExitCodes":[]}]});
        assert_eq!(listed_goal_tasks(&forged).unwrap()[0]["state"], "UNKNOWN");
    }

    #[test]
    fn native_goal_list_uses_existing_v1_scope_without_exposing_goal_content() {
        let root =
            std::env::temp_dir().join(format!("lazyprompting-v1-status-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let request_id = "12345678-1234-1234-1234-123456789abc";
        let scope = Scope {
            request_id: request_id.into(),
            objective: "PRIVATE_GOAL_TEXT".into(),
            repository_path: PathBuf::from(r"C:\private-checkout"),
            base_ref: "Local".into(),
            acceptance: vec!["PRIVATE_ACCEPTANCE_TEXT".into()],
            coding_tasks: Vec::new(),
            limits: Limits::default(),
        };
        let run = Run {
            run_id: format!("{request_id}.0123456789abcdef0123456789abcdef"),
            host_epoch: epoch().unwrap().to_owned(),
            scope,
            repository: PathBuf::from(r"C:\private-checkout"),
            base_sha: "a".repeat(40),
        };
        let file = root.join(format!("{request_id}.json"));
        fs::write(&file, serde_json::to_vec(&run).unwrap()).unwrap();
        fs::write(root.join(format!("{request_id}.v2.json")), b"v2").unwrap();
        let observed = list_goal_run_statuses_at(&root).unwrap();
        assert_eq!(observed["runs"].as_array().unwrap().len(), 1);
        assert_eq!(observed["runs"][0]["runId"], run.run_id);
        assert_eq!(observed["runs"][0]["state"], "AWAITING_SCOPE_REVIEW");
        assert_eq!(observed["runs"][0]["qa"], "NOT_VERIFIED");
        assert_eq!(observed["runs"][0]["taskCount"], 1);
        assert_eq!(observed["runs"][0]["tasks"], json!([]));
        assert_eq!(observed["runs"][0]["chatTurnVerified"], false);
        assert_eq!(observed["nextPromptAllowed"], false);
        let output = observed.to_string();
        assert!(!output.contains("PRIVATE_GOAL_TEXT"));
        assert!(!output.contains("PRIVATE_ACCEPTANCE_TEXT"));
        assert!(!output.contains("private-checkout"));

        let invalid = serde_json::json!({"runId":"mismatched","hostEpoch":run.host_epoch,
            "scope":run.scope,"repository":run.repository,"baseSha":run.base_sha});
        fs::write(&file, serde_json::to_vec(&invalid).unwrap()).unwrap();
        assert_eq!(
            list_goal_run_statuses_at(&root).unwrap_err(),
            "GOAL_LIST_RECORD_SCOPE_MISMATCH"
        );
        fs::remove_dir_all(root).unwrap();
        assert_eq!(listed_goal_state("MODEL_CLAIMS_DONE"), "RECONCILE_REQUIRED");
        assert_eq!(listed_goal_state("REVIEW_COMPLETE"), "REVIEW_COMPLETE");
    }
    #[test]
    fn goal_pause_marker_is_derived_from_the_native_stop_file() {
        let file = PathBuf::from(r"C:\approved\goal-runs\request.json");
        assert_eq!(
            goal_pause_path(&file),
            PathBuf::from(r"C:\approved\goal-runs\request.stopped.pause")
        );
    }

    #[test]
    fn native_goal_report_matches_immutable_scope_before_terminal_status() {
        let scope = Scope {
            request_id: "12345678-1234-1234-1234-123456789abc".into(),
            objective: "Review selected source".into(),
            repository_path: PathBuf::from(r"C:\approved"),
            base_ref: "Local".into(),
            acceptance: vec!["Inspect UV".into()],
            coding_tasks: Vec::new(),
            limits: Limits::default(),
        };
        let mut run = Run {
            run_id: "12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef".into(),
            host_epoch: "host".into(),
            scope,
            repository: PathBuf::from(r"C:\approved"),
            base_sha: "a".repeat(40),
        };
        let valid = json!({
            "baseSha": run.base_sha, "mode": "READ_ONLY",
            "state": "REVIEW_COMPLETE", "revision": 3,
            "deadline": 1_800_000_000_000u64,
            "tasks": [{"id":"task-1","criterion":"Inspect UV",
                "state":"REVIEWED","turns":[]}]
        });
        assert!(report_matches_run_scope(&valid, &run));
        let mut altered = valid.clone();
        altered["baseSha"] = json!("b".repeat(40));
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["mode"] = json!("WORKTREE_WRITE");
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["state"] = json!("DONE");
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["tasks"][0]["criterion"] = json!("Other criterion");
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["tasks"][0]["state"] = json!("BLOCKED");
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["tasks"] = json!([]);
        assert!(!report_matches_run_scope(&altered, &run));
        altered = valid.clone();
        altered["revision"] = Value::Null;
        assert!(!report_matches_run_scope(&altered, &run));

        run.scope.coding_tasks = vec![CodingTask {
            files: vec!["src/uv.rs".into()],
            verify: vec![r"C:\tools\check.exe".into()],
        }];
        let mut coding = valid.clone();
        coding["mode"] = json!("WORKTREE_WRITE");
        coding["state"] = json!("CODING_COMPLETE");
        coding["tasks"][0]["state"] = json!("VERIFIED");
        coding["tasks"][0]["verification"] = json!({"pass":true,
            "exitCode":0,"changes":["src/uv.rs"]});
        assert!(report_matches_run_scope(&coding, &run));
        coding["tasks"][0]["verification"]["pass"] = json!(false);
        assert!(!report_matches_run_scope(&coding, &run));
        coding["tasks"][0]["verification"]["pass"] = json!(true);
        coding["tasks"][0]["verification"]["changes"] = json!([]);
        assert!(!report_matches_run_scope(&coding, &run));
    }
    #[test]
    fn goal_scope_binding_blocks_legacy_resume_admission() {
        let valid = json!({
            "scopeFingerprintVersion": 1,
            "scopeFingerprint": "a".repeat(64)
        });
        assert!(has_run_scope_binding(&valid));
        let mut missing = valid.clone();
        missing.as_object_mut().unwrap().remove("scopeFingerprint");
        assert!(!has_run_scope_binding(&missing));
        let mut wrong_version = valid.clone();
        wrong_version["scopeFingerprintVersion"] = json!(2);
        assert!(!has_run_scope_binding(&wrong_version));
        let mut malformed = valid.clone();
        malformed["scopeFingerprint"] = json!("not-a-digest");
        assert!(!has_run_scope_binding(&malformed));
    }

    // Pure native correlation test: no Codex login, network, browser or gateway.
    // These Rust tests still require Cargo/Windows execution on exact SHA.
    #[test]
    fn goal_turn_receipt_requires_matching_approved_source_records() {
        let scope = Scope {
            request_id: "12345678-1234-1234-1234-123456789abc".into(),
            objective: "Review source".into(),
            repository_path: PathBuf::from("C:\\scope"),
            base_ref: "Local".into(),
            acceptance: vec!["Inspect UV".into()],
            coding_tasks: Vec::new(),
            limits: Limits::default(),
        };
        let run = Run {
            run_id: "12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef".into(),
            host_epoch: "epoch".into(),
            scope,
            repository: PathBuf::from("C:\\scope"),
            base_sha: "a".repeat(40),
        };
        let report = json!({
            "baseSha":run.base_sha.clone(),
            "mode":"READ_ONLY",
            "revision":4,
            "tasks":[{"id":"task-1","criterion":"Inspect UV","threadId":"thread-01",
                "turns":[{"turnId":"turn-01","text":"Recorded answer"}]}]
        });
        let outbox = json!({"schemaVersion":1,"items":[{
            "workspaceId":"task-1","sessionId":"thread-01",
            "taskId":"task-1-turn-1","promptId":"prompt-01",
            "state":"RESPONSE_VERIFIED","contextRevision":0,
            "responseHandle":"turn-01","responseId":"turn-01"
        }]});
        let receipt = correlate_turn_receipt(&run, "task-1", "turn-01", &report, &outbox)
            .expect("matching durable receipt");
        assert_eq!(receipt["recordedCompleted"], true);
        assert_eq!(receipt["finalTurnHostAttested"], false);
        assert_eq!(receipt["qa"], "NOT_EXECUTED");
        assert_eq!(receipt["nextPromptAllowed"], false);
        assert_eq!(receipt["promptId"], "prompt-01");
        assert_eq!(receipt["processNotificationObserved"], false);
        assert_eq!(receipt["turnObservationKind"], "LEGACY_RECORD_ONLY");

        let mut with_event = report.clone();
        with_event["tasks"][0]["turns"][0]["terminalObservation"] = json!({
            "kind":"EVENT_AND_QUERY_CORRELATED",
            "threadId":"thread-01","turnId":"turn-01",
            "source":"CODEX_APP_SERVER_NOTIFICATION","hostAttested":false
        });
        let observed = correlate_turn_receipt(&run, "task-1", "turn-01", &with_event, &outbox)
            .expect("matching process notification");
        assert_eq!(observed["processNotificationObserved"], true);
        assert_eq!(observed["finalTurnHostAttested"], false);

        with_event["tasks"][0]["turns"][0]["terminalObservation"]["threadId"] = json!("other");
        assert!(correlate_turn_receipt(&run, "task-1", "turn-01", &with_event, &outbox).is_err());

        let mut wrong = outbox.clone();
        wrong["items"][0]["sessionId"] = json!("other-thread");
        assert!(correlate_turn_receipt(&run, "task-1", "turn-01", &report, &wrong).is_err());

        wrong = outbox.clone();
        wrong["items"][0]["state"] = json!("ACKNOWLEDGED");
        assert!(correlate_turn_receipt(&run, "task-1", "turn-01", &report, &wrong).is_err());

        wrong = outbox.clone();
        wrong["items"][0]["responseId"] = json!("other-turn");
        assert!(correlate_turn_receipt(&run, "task-1", "turn-01", &report, &wrong).is_err());

        let mut stale = report.clone();
        stale["baseSha"] = json!("b".repeat(40));
        assert!(correlate_turn_receipt(&run, "task-1", "turn-01", &stale, &outbox).is_err());

        assert!(correlate_turn_receipt(&run, "task-2", "turn-01", &report, &outbox).is_err());
        assert!(correlate_turn_receipt(&run, "../task-1", "turn-01", &report, &outbox).is_err());
        assert!(correlate_turn_receipt(&run, "task-1", "turn-other", &report, &outbox).is_err());
    }

    #[test]
    #[ignore = "requires staged Windows gateway and a signed-in Codex CLI"]
    fn packaged_gateway_verifies_five_coding_worktrees() {
        let cwd = PathBuf::from(std::env::var_os("LAZY_GOAL_QA_REPO").expect("fixture repository"));
        let executable = std::env::var("LAZY_GOAL_QA_CODEX").expect("absolute Codex CLI");
        let data =
            std::env::temp_dir().join(format!("lazy-goal-write-live-{}", random_id().unwrap()));
        let worktrees = cwd
            .parent()
            .unwrap()
            .join(format!(".lazyprompting-worktrees-{}", random_id().unwrap()));
        let powershell = PathBuf::from(std::env::var_os("SystemRoot").unwrap())
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let sha = git(&cwd, &["rev-parse", "HEAD"]).unwrap();
        let gateway = GatewaySession::default();
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway");
        gateway.probe_packaged(&root).unwrap();
        let mut acceptance = Vec::new();
        let mut tasks = Vec::new();
        for index in 1..=5 {
            let file = format!("task-{index}.txt");
            let expected = format!("VERIFIED_{index}_{}", index * 17);
            let criterion = if index == 1 {
                format!("On the first turn, write DRAFT to {file}. After the host reports the test failure, replace DRAFT with exactly {expected} and a newline.")
            } else {
                format!("Replace the content of {file} with exactly {expected} and a newline.")
            };
            acceptance.push(criterion);
            let check = format!("if ((Get-Content -Raw -LiteralPath '{file}').Trim() -ne '{expected}') {{ exit 3 }}; exit 0");
            tasks.push(json!({"files":[file],"verify":[powershell,"-NoProfile","-NonInteractive","-Command",check]}));
        }
        let mut params = json!({
            "action":"goalRun","executable":executable,"cwd":cwd,"dataDir":data,
            "stopFile":data.join("stop"),"baseSha":sha,
            "objective":"Complete each coding fixture task in its assigned worktree.",
            "acceptance":acceptance,
            "limits":{"maxActiveTasks":5,"maxTurnsPerTask":2,"wallMinutes":5},
            "coding":{"git":find_git(&cwd).unwrap(),"root":worktrees,"tasks":tasks}
        });
        let result = gateway.request_codex(params.clone()).unwrap();
        assert_eq!(result["status"], "STARTING");
        let report_file = data.join("report.json");
        let wait_for_report = || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(240);
            loop {
                if let Ok(bytes) = fs::read(&report_file) {
                    let report: Value = serde_json::from_slice(&bytes).unwrap();
                    if report["state"] != "RUNNING" {
                        break report;
                    }
                }
                assert!(
                    std::time::Instant::now() < deadline,
                    "coding report timed out"
                );
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
        };
        let report = wait_for_report();
        gateway.stop().unwrap();
        assert_eq!(report["state"], "CODING_COMPLETE", "{report}");
        assert_eq!(git(&cwd, &["status", "--porcelain"]).unwrap(), "");
        let results = report["tasks"].as_array().unwrap();
        let threads = results
            .iter()
            .filter_map(|task| task["threadId"].as_str())
            .collect::<std::collections::HashSet<_>>();
        assert_eq!(threads.len(), 5);
        for (index, task) in results.iter().enumerate() {
            assert_eq!(
                task["verification"]["changes"],
                json!([format!("task-{}.txt", index + 1)])
            );
            assert_eq!(task["verification"]["exitCode"], 0);
            assert!(task["verification"]["changeDigest"]
                .as_str()
                .is_some_and(|digest| digest.len() == 64));
        }
        assert_eq!(results[0]["turns"][0]["verification"]["exitCode"], 3);
        assert_eq!(results[0]["turns"][1]["verification"]["exitCode"], 0);

        let outbox_file = data.join("task-1.json");
        let mut outbox: Value = serde_json::from_slice(&fs::read(&outbox_file).unwrap()).unwrap();
        let original_prompt = outbox["items"][1]["promptId"].clone();
        let original_turn = outbox["items"][1]["responseHandle"].clone();
        outbox["items"][1]["state"] = json!("ACKNOWLEDGED");
        outbox["items"][1]
            .as_object_mut()
            .unwrap()
            .remove("responseId");
        fs::write(&outbox_file, serde_json::to_vec(&outbox).unwrap()).unwrap();
        let mut interrupted = report.clone();
        interrupted["state"] = json!("RUNNING");
        interrupted["tasks"][0]["state"] = json!("RUNNING");
        interrupted["tasks"][0]["turns"] = json!([results[0]["turns"][0]]);
        interrupted["tasks"][0]["verification"] = results[0]["turns"][0]["verification"].clone();
        interrupted["tasks"][0]["pendingTurnId"] = original_turn.clone();
        fs::write(&report_file, serde_json::to_vec(&interrupted).unwrap()).unwrap();
        gateway.probe_packaged(&root).unwrap();
        params["resume"] = json!(true);
        params["hostEpoch"] = json!("qa-write-replacement-host");
        assert_eq!(gateway.request_codex(params).unwrap()["status"], "STARTING");
        let recovered = wait_for_report();
        gateway.stop().unwrap();
        assert_eq!(recovered["state"], "CODING_COMPLETE", "{recovered}");
        assert_eq!(recovered["tasks"][0]["turns"][1]["turnId"], original_turn);
        assert_eq!(
            recovered["tasks"][0]["verification"],
            results[0]["verification"]
        );
        assert_eq!(recovered["tasks"].as_array().unwrap()[1..], results[1..]);
        let durable: Value = serde_json::from_slice(&fs::read(&outbox_file).unwrap()).unwrap();
        assert_eq!(durable["items"].as_array().unwrap().len(), 2);
        assert_eq!(durable["items"][1]["promptId"], original_prompt);
        assert_eq!(durable["items"][1]["state"], "RESPONSE_VERIFIED");
    }

    #[test]
    #[ignore = "requires staged Windows gateway and a signed-in Codex CLI"]
    fn packaged_gateway_runs_an_approved_read_only_goal() {
        let cwd = std::env::var("LAZY_GOAL_QA_REPO").expect("fixture repository");
        let executable = std::env::var("LAZY_GOAL_QA_CODEX").expect("absolute Codex CLI");
        let data = std::env::temp_dir().join(format!("lazy-goal-live-{}", random_id().unwrap()));
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway");
        let gateway = GatewaySession::default();
        gateway.probe_packaged(&root).unwrap();
        let sha = git(Path::new(&cwd), &["rev-parse", "HEAD"]).unwrap();
        let mut params = json!({
            "action":"goalRun","executable":executable,"cwd":cwd,"dataDir":data,
            "stopFile":data.join("stop"),"baseSha":sha,
            "objective":"Read task-1.txt and report its exact QA marker",
            "acceptance":["Return the QA marker found in task-1.txt"],
            "limits":{"maxActiveTasks":1,"maxTurnsPerTask":1,"wallMinutes":3}
        });
        let result = gateway.request_codex(params.clone()).unwrap();
        assert_eq!(result["status"], "STARTING");
        let report_file = data.join("report.json");
        let wait_for_report = || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(70);
            loop {
                if let Ok(bytes) = fs::read(&report_file) {
                    let report: Value = serde_json::from_slice(&bytes).unwrap();
                    if report["state"] != "RUNNING" {
                        break report;
                    }
                }
                assert!(
                    std::time::Instant::now() < deadline,
                    "goal report timed out"
                );
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
        };
        let report = wait_for_report();
        gateway.stop().unwrap();
        assert_eq!(report["state"], "REVIEW_COMPLETE", "{report}");
        assert!(report["tasks"][0]["turns"][0]["text"]
            .as_str()
            .unwrap()
            .contains("QA_TOKEN_1_11"));

        // Recreate the checkpoint immediately before the host recorded the result.
        // The actual completed turn remains in Codex history across gateway restart.
        let turn = &report["tasks"][0]["turns"][0]["turnId"];
        let outbox_file = data.join("task-1.json");
        let mut outbox: Value = serde_json::from_slice(&fs::read(&outbox_file).unwrap()).unwrap();
        let original_prompt = outbox["items"][0]["promptId"].clone();
        outbox["items"][0]["state"] = json!("ACKNOWLEDGED");
        outbox["items"][0]
            .as_object_mut()
            .unwrap()
            .remove("responseId");
        fs::write(&outbox_file, serde_json::to_vec(&outbox).unwrap()).unwrap();
        let mut interrupted = report.clone();
        interrupted["state"] = json!("RUNNING");
        interrupted["tasks"][0]["state"] = json!("RUNNING");
        interrupted["tasks"][0]["pendingTurnId"] = turn.clone();
        interrupted["tasks"][0]["turns"] = json!([]);
        fs::write(&report_file, serde_json::to_vec(&interrupted).unwrap()).unwrap();
        gateway.probe_packaged(&root).unwrap();
        params["resume"] = json!(true);
        params["hostEpoch"] = json!("qa-replacement-host");
        assert_eq!(gateway.request_codex(params).unwrap()["status"], "STARTING");
        let recovered = wait_for_report();
        gateway.stop().unwrap();
        assert_eq!(recovered["state"], "REVIEW_COMPLETE", "{recovered}");
        assert_eq!(recovered["deadline"], report["deadline"]);
        assert_eq!(
            recovered["tasks"][0]["threadId"],
            report["tasks"][0]["threadId"]
        );
        assert_eq!(recovered["tasks"][0]["turns"][0]["turnId"], *turn);
        let recovered_outbox: Value =
            serde_json::from_slice(&fs::read(&outbox_file).unwrap()).unwrap();
        assert_eq!(recovered_outbox["items"].as_array().unwrap().len(), 1);
        assert_eq!(recovered_outbox["items"][0]["promptId"], original_prompt);
        assert_eq!(recovered_outbox["items"][0]["state"], "RESPONSE_VERIFIED");
    }

    #[test]
    fn goal_scope_survives_restart_and_review_cannot_dispatch() {
        let root = std::env::temp_dir().join(format!("lazy-goal-test-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let scope: Scope = serde_json::from_value(json!({
            "requestId":"63ec48ad-a7be-4b26-8654-2847aa4f7845",
            "objective":"Validate one regression",
            "repositoryPath":root,
            "baseRef":"Local",
            "acceptance":["Targeted check passes"]
        }))
        .unwrap();
        validate(&scope).unwrap();
        let file = root.join("test.json");
        let run = Run {
            run_id: format!("{}.{}", scope.request_id, random_id().unwrap()),
            host_epoch: "previous process".into(),
            scope,
            repository: root,
            base_sha: "a".repeat(40),
        };
        write_atomic(&file, &serde_json::to_vec(&run).unwrap()).unwrap();
        assert!(write_atomic(&file, b"duplicate").is_err());
        let recovered = read_run(&file).unwrap().unwrap();
        assert_eq!(recovered.run_id, run.run_id);
        assert_eq!(
            snapshot(&file, &recovered).unwrap()["state"],
            "REVIEW_INTERRUPTED"
        );
        write_atomic(&file.with_extension("decision"), b"approved").unwrap();
        let approved = snapshot(&file, &recovered).unwrap();
        assert_eq!(approved["state"], "SCOPE_REVIEWED");
        assert_eq!(approved["executionAvailable"], false);
        write_atomic(&file.with_extension("stopped"), b"stopped").unwrap();
        assert_eq!(snapshot(&file, &recovered).unwrap()["state"], "STOPPED");
    }

    #[test]
    fn unshown_dialog_does_not_become_v1_declined_or_approved() {
        let root = std::env::temp_dir().join(format!("lazy-v1-modal-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let scope: Scope = serde_json::from_value(json!({
            "requestId":"63ec48ad-a7be-4b26-8654-2847aa4f7845",
            "objective":"One read-only task",
            "repositoryPath":root.clone(),
            "baseRef":"Local",
            "acceptance":["No operation without approval"]
        })).unwrap();
        let run = Run {
            run_id: format!("{}.{}", scope.request_id, random_id().unwrap()),
            host_epoch: epoch().unwrap().to_owned(),
            scope,
            repository: root.clone(),
            base_sha: "a".repeat(40),
        };
        let file = root.join("test.json");
        for marker in [b"OPERATOR_DIALOG_BUSY".as_slice(), b"OPERATOR_DIALOG_UNAVAILABLE".as_slice()] {
            fs::write(file.with_extension("decision"), marker).unwrap();
            let view = snapshot(&file, &run).unwrap();
            assert_eq!(view["state"], "RECONCILE_REQUIRED");
            assert_eq!(view["reason"], std::str::from_utf8(marker).unwrap());
            assert_eq!(view["executionAvailable"], false);
        }
        fs::write(file.with_extension("decision"), b"declined").unwrap();
        assert_eq!(snapshot(&file, &run).unwrap()["state"], "DECLINED");
        fs::write(file.with_extension("stopped"), b"stopped").unwrap();
        assert_eq!(snapshot(&file, &run).unwrap()["state"], "STOPPED");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn unconfirmed_child_close_blocks_native_resume_and_status_promotion() {
        let root = std::env::temp_dir().join(format!("lazy-close-hold-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let scope: Scope = serde_json::from_value(json!({
            "requestId":"63ec48ad-a7be-4b26-8654-2847aa4f7845",
            "objective":"Read-only worker close hold",
            "repositoryPath":root.clone(),
            "baseRef":"Local",
            "acceptance":["No replay after uncertain close"]
        })).unwrap();
        let run = Run {
            run_id: format!("{}.{}", scope.request_id, random_id().unwrap()),
            host_epoch: epoch().unwrap().to_owned(),
            scope,
            repository: root.clone(),
            base_sha: "a".repeat(40),
        };
        let file = root.join("test.json");
        let data_dir = file.with_extension("run");
        fs::create_dir_all(&data_dir).unwrap();
        let report = json!({
            "state":"NEEDS_ATTENTION",
            "reason":"GOAL_SERVER_CLOSE_UNCONFIRMED",
            "mode":"READ_ONLY",
            "baseSha":run.base_sha,
            "scopeFingerprintVersion":1,
            "scopeFingerprint":"b".repeat(64),
            "revision":2,
            "deadline":1_800_000_000_000u64,
            "tasks":[{"id":"task-1","criterion":"No replay after uncertain close",
                "state":"REVIEWED","turns":[]}]
        });
        fs::write(data_dir.join("report.json"), serde_json::to_vec(&report).unwrap()).unwrap();
        fs::write(file.with_extension("decision"), run.scope.approval()).unwrap();
        assert!(report_requires_close_reconciliation(&report));
        let status = snapshot(&file, &run).unwrap();
        assert_eq!(status["state"], "RECONCILE_REQUIRED");
        assert_eq!(status["executionAvailable"], false);
        assert_eq!(status["reason"], "GOAL_SERVER_CLOSE_UNCONFIRMED");
        let ordinary = json!({"state":"NEEDS_ATTENTION","reason":"GOAL_VERIFICATION_FAILED"});
        assert!(!report_requires_close_reconciliation(&ordinary));
        fs::write(file.with_extension("stopped"), b"stopped").unwrap();
        assert_eq!(snapshot(&file, &run).unwrap()["state"], "STOPPED");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn native_goal_execution_hint_follows_effective_state_and_stop() {
        for state in [
            "STOPPED", "RECONCILE_REQUIRED", "PAUSED", "PAUSE_REQUESTED",
            "NEEDS_ATTENTION", "REVIEW_COMPLETE", "CODING_COMPLETE",
            "DECLINED", "AWAITING_SCOPE_REVIEW", "REVIEW_INTERRUPTED",
            "SCOPE_REVIEWED", "BLOCKED", "UNKNOWN",
        ] {
            assert!(!goal_execution_available(true, state), "{state}");
        }
        assert!(goal_execution_available(true, "STARTING"));
        assert!(goal_execution_available(true, "RUNNING"));
        assert!(!goal_execution_available(false, "RUNNING"));

        let root = std::env::temp_dir().join(format!("lazy-state-{}", random_id().unwrap()));
        fs::create_dir(&root).unwrap();
        let scope: Scope = serde_json::from_value(json!({
            "requestId":"63ec48ad-a7be-4b26-8654-2847aa4f7845",
            "objective":"Read-only status",
            "repositoryPath":root.clone(),
            "baseRef":"Local",
            "acceptance":["No misleading execution hint"]
        })).unwrap();
        let run = Run {
            run_id: format!("{}.{}", scope.request_id, random_id().unwrap()),
            host_epoch: epoch().unwrap().to_owned(),
            scope,
            repository: root.clone(),
            base_sha: "a".repeat(40),
        };
        let file = root.join("test.json");
        fs::write(file.with_extension("decision"), run.scope.approval()).unwrap();
        let starting = snapshot(&file, &run).unwrap();
        assert_eq!(starting["state"], "STARTING");
        assert_eq!(starting["executionAvailable"], true);
        fs::write(file.with_extension("stopped"), b"stopped").unwrap();
        let stopped = snapshot(&file, &run).unwrap();
        assert_eq!(stopped["state"], "STOPPED");
        assert_eq!(stopped["executionAvailable"], false);
        fs::remove_dir_all(root).unwrap();
    }
}
