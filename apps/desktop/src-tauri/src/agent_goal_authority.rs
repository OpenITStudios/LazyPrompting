// Native-owned Agent v2 READ-ONLY scope admission. This file deliberately
// does NOT dispatch a worker. The legacy Codex v1 scope, marker and checkpoint
// retain their previous ownership and bytes. The v2 suffix prevents v1 replay.
use crate::agent_worker_profiles::{
    revalidate_approved_worker, resolve_approved_worker, ApprovedWorkerIdentity,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
use tauri::Manager;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
struct AgentLimits {
    max_active_tasks: u8,
    max_turns_per_task: u8,
    wall_minutes: u8,
}

impl Default for AgentLimits {
    fn default() -> Self {
        Self { max_active_tasks: 1, max_turns_per_task: 2, wall_minutes: 30 }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ScopeV2 {
    schema_version: u8,
    request_id: String,
    workspace_id: String,
    worker_profile_id: String,
    repository_path: PathBuf,
    base_ref: String,
    objective: String,
    acceptance: Vec<String>,
    // Explicit file inputs are operator-reviewed. Empty old scopes serialize
    // identically and are not silently granted repository access.
    #[serde(default,skip_serializing_if="Vec::is_empty")]
    read_only_inputs: Vec<String>,
    #[serde(default)]
    limits: AgentLimits,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PreparedAgentRun {
    run_id: String,
    scope: ScopeV2,
    repository: PathBuf,
    base_sha: String,
    worker: ApprovedWorkerIdentity,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Lookup {
    run_id: String,
}

fn valid_uuid(id: &str) -> bool {
    id.len() == 36 && id.bytes().enumerate().all(|(index, byte)| {
        if matches!(index, 8 | 13 | 18 | 23) { byte == b'-' }
        else { byte.is_ascii_hexdigit() }
    })
}

fn valid_workspace(id: &str) -> bool {
    matches!(id,
        "workspace-01" | "workspace-02" | "workspace-03" |
        "workspace-04" | "workspace-05" | "workspace-06" |
        "workspace-07" | "workspace-08" | "workspace-09" |
        "workspace-10")
}

fn bounded(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.encode_utf16().count() <= max &&
        !value.chars().any(|ch| ch.is_control() && !matches!(ch, '\n' | '\r' | '\t'))
}

fn validate(scope: &ScopeV2) -> Result<(), String> {
    if scope.schema_version != 2 || !valid_uuid(&scope.request_id) ||
        !valid_workspace(&scope.workspace_id) ||
        !matches!(scope.worker_profile_id.as_str(), "codex-local" | "opencode-local") ||
        !scope.repository_path.is_absolute() ||
        !bounded(&scope.repository_path.to_string_lossy(), 1024) ||
        !bounded(&scope.objective, 2000) ||
        !bounded(&scope.base_ref, 128) ||
        !scope.base_ref.bytes().all(|b|
            b.is_ascii_alphanumeric() || b"-_./".contains(&b)) ||
        scope.acceptance.len() != 1 ||
        scope.acceptance.iter().any(|item| !bounded(item, 400)) ||
        scope.limits.max_active_tasks != 1 ||
        !(1..=2).contains(&scope.limits.max_turns_per_task) ||
        !(1..=30).contains(&scope.limits.wall_minutes)
    {
        return Err("INVALID_AGENT_V2_SCOPE".into());
    }
    crate::agent_worker_snapshot::validate_input_paths(&scope.read_only_inputs)
        .map_err(str::to_owned)?;
    Ok(())
}

fn random_id() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).map_err(|_| "AGENT_ENTROPY_UNAVAILABLE")?;
    Ok(crate::native_ipc_pipe::hex(&bytes))
}

// Explicitly create a file once; never overwrite a previous approval, STOP
// marker or request. This is the same immutable publication pattern as v1.
fn write_once(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let temporary = path.with_extension(format!("{}.tmp", random_id()?));
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::hard_link(&temporary, path)
    })();
    let _ = fs::remove_file(&temporary);
    result.map_err(|_| "AGENT_V2_STORAGE_FAILED".into())
}

fn read_run(file: &Path) -> Result<Option<PreparedAgentRun>, String> {
    match fs::read(file) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some).map_err(|_| "AGENT_V2_RECORD_INVALID".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("AGENT_V2_STORAGE_FAILED".into()),
    }
}

fn approval_digest(run: &PreparedAgentRun) -> Result<Vec<u8>, String> {
    let bytes = serde_json::to_vec(run).map_err(|_| "AGENT_V2_RECORD_INVALID")?;
    let digest = Sha256::digest(bytes);
    Ok(format!("agent-read-only-v2:{digest:x}").into_bytes())
}


// Separate operator intent for a FUTURE read-only worker execution.
// A reviewed marker is not an executable permission, OS-sandbox receipt,
// process credential, or grant to run commands.
fn execution_review_digest(run: &PreparedAgentRun) -> Result<Vec<u8>, String> {
    let source = approval_digest(run)?;
    let sha = Sha256::digest(source);
    Ok(format!("agent-v2-execution-intent-no-runtime-grant:{sha:x}").into_bytes())
}

fn execution_review_state(
    file: &Path, run: &PreparedAgentRun, source_state: &str
) -> Result<&'static str, String> {
    if source_state == "STOPPED" { return Ok("STOPPED"); }
    let record = match fs::read(file.with_extension("execution-review")) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(_) => return Err("AGENT_V2_REVIEW_STORAGE_FAILED".into()),
    };
    match record {
        Some(bytes) if bytes == execution_review_digest(run)? => {
            if source_state == "APPROVED_SOURCE_ONLY" {
                Ok("REVIEWED_NO_EXECUTION")
            } else { Ok("RECONCILE_REQUIRED") }
        }
        Some(bytes) if bytes.as_slice() == b"declined" => Ok("DECLINED"),
        Some(_) => Ok("RECONCILE_REQUIRED"),
        None if file.with_extension("execution-pending").exists() => Ok("PENDING"),
        None => Ok("NOT_REQUESTED"),
    }
}

fn request_execution_review(
    app: &tauri::AppHandle, file: &Path, run: &PreparedAgentRun
) -> Result<Value, String> {
    if snapshot(file, run)?["state"] != "APPROVED_SOURCE_ONLY" {
        return Err("AGENT_V2_SOURCE_NOT_APPROVED".into());
    }
    if file.with_extension("execution-review").exists() ||
       file.with_extension("execution-pending").exists() {
        return snapshot(file, run);
    }
    // Exactly one modal per durable run. Crash/pending remains a safe
    // reconciliation hold, rather than making a second approval dialog.
    let owner = crate::goal_runs::approval_owner(app)?;
    write_once(&file.with_extension("execution-pending"), b"pending")?;
    let result = snapshot(file, run)?;
    let message = format!(
        "Review FUTURE Agent v2 READ-ONLY execution? No worker will start.\
        \n\nWorker: {} ({})\
        \nExecutable SHA-256: {}\
        \nWorkspace: {}\
        \nRepository: {}\
        \nBranch: {}\
        \nPinned SHA: {}\
        \n\nObjective: {}\
        \n\nOS sandbox, independent QA and a separate native dispatch grant \
        are REQUIRED before any worker may run. No shell, write, network, \
        credentials, release or publish permission is granted.",
        run.worker.profile_id, run.worker.adapter_id,
        run.worker.executable_sha256, run.scope.workspace_id,
        run.repository.display(), run.scope.base_ref,
        run.base_sha, run.scope.objective,
    );
    let pending_run = run.clone();
    let pending_path = file.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let approved = crate::operator_confirmation::confirm(
            owner, "LazyPrompting · Agent execution intent (no launch)", &message
        );
        let marker = if approved && !pending_path.with_extension("stopped").exists()
            && snapshot(&pending_path, &pending_run)
                .is_ok_and(|s| s["state"] == "APPROVED_SOURCE_ONLY")
        {
            execution_review_digest(&pending_run)
                .unwrap_or_else(|_| b"review-invalid".to_vec())
        } else if approved {
            b"source-changed-or-stopped".to_vec()
        } else {
            b"declined".to_vec()
        };
        if let Err(error) = write_once(
            &pending_path.with_extension("execution-review"), &marker
        ) {
            eprintln!("Agent v2 execution review storage: {error}");
        }
    });
    Ok(result)
}

fn snapshot(file: &Path, run: &PreparedAgentRun) -> Result<Value, String> {
    validate(&run.scope)?;
    let (request_id, suffix) = run.run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
    if request_id != run.scope.request_id || suffix.len() != 32 ||
        !suffix.bytes().all(|b| b.is_ascii_hexdigit()) ||
        run.repository != dunce::canonicalize(&run.scope.repository_path)
            .map_err(|_| "INVALID_GOAL_REPOSITORY")? ||
        !matches!(run.base_sha.len(), 40 | 64) ||
        !run.base_sha.bytes().all(|b| b.is_ascii_hexdigit()) ||
        run.worker.profile_id != run.scope.worker_profile_id ||
        run.worker.executable_sha256.len() != 64 ||
        !run.worker.executable_sha256.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("AGENT_V2_RECORD_SCOPE_MISMATCH".into());
    }
    let decision = match fs::read(file.with_extension("decision")) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(_) => return Err("AGENT_V2_STORAGE_FAILED".into()),
    };
    let approved_marker = approval_digest(run)?;
    // A previous operator decision is insufficient once the executable,
    // checked-out commit or worktree changes. These are independent source
    // guards; neither their success nor a SHA-256 string grants execution.
    let approved_source_valid = if decision == approved_marker {
        let branch = format!("refs/heads/{}", run.scope.base_ref);
        let pinned_branch = format!("{branch}^{{commit}}");
        revalidate_approved_worker(&run.worker).is_ok()
            && crate::goal_runs::git(&run.repository,
                &["rev-parse", "--verify", "--end-of-options", &pinned_branch])
                .is_ok_and(|sha| sha == run.base_sha)
            && crate::goal_runs::git(&run.repository, &["rev-parse", "HEAD"])
                .is_ok_and(|sha| sha == run.base_sha)
            && crate::goal_runs::git(&run.repository,
                &["status", "--porcelain", "--untracked-files=all"])
                .is_ok_and(|changes| changes.is_empty())
    } else {
        false
    };
    let state = if file.with_extension("stopped").exists() {
        "STOPPED"
    } else if decision == approved_marker {
        if approved_source_valid { "APPROVED_SOURCE_ONLY" }
        else { "RECONCILE_REQUIRED" }
    } else if decision.as_slice() == b"declined" {
        "DECLINED"
    } else if decision.is_empty() {
        "AWAITING_OPERATOR"
    } else {
        "RECONCILE_REQUIRED"
    };
    let review_state = execution_review_state(file, run, state)?;
    Ok(json!({
        "runId": run.run_id,
        "schemaVersion": 2,
        "executionReview": review_state,
        "executionAuthorized": false,
        "executionGrant": "NONE",
        "state": state,
        "mode": "READ_ONLY",
        "workerProfileId": run.scope.worker_profile_id,
        "adapterId": run.worker.adapter_id,
        "approvedInputCount": run.scope.read_only_inputs.len(),
        "workspaceId": run.scope.workspace_id,
        "baseRef": run.scope.base_ref,
        "baseSha": run.base_sha,
        "executableSha256": run.worker.executable_sha256,
        "executionReady": false,
        "scopeAndBinaryCurrent": approved_source_valid,
        "nextPromptAllowed": false,
        "qa": "NOT_EXECUTED",
    }))
}

fn prepare(app: &tauri::AppHandle, root: &Path, mut scope: ScopeV2) -> Result<Value, String> {
    scope.request_id.make_ascii_lowercase();
    validate(&scope)?;
    let existing_v1 = root.join(format!("{}.json", scope.request_id));
    if existing_v1.exists() {
        return Err("REQUEST_CONFLICT".into());
    }
    let file = root.join(format!("{}.v2.json", scope.request_id));
    let worker = resolve_approved_worker(&scope.worker_profile_id)?;
    if let Some(run) = read_run(&file)? {
        if run.scope != scope || run.worker != worker {
            return Err("REQUEST_CONFLICT".into());
        }
        return snapshot(&file, &run);
    }
    let repository = dunce::canonicalize(&scope.repository_path)
        .map_err(|_| "INVALID_GOAL_REPOSITORY")?;
    let top = crate::goal_runs::git(&repository, &["rev-parse", "--show-toplevel"])?;
    if dunce::canonicalize(top).ok().as_ref() != Some(&repository) {
        return Err("GOAL_REPOSITORY_ROOT_REQUIRED".into());
    }
    let branch = format!("refs/heads/{}", scope.base_ref);
    crate::goal_runs::git(&repository, &["check-ref-format", &branch])?;
    let base_sha = crate::goal_runs::git(&repository, &[
        "rev-parse", "--verify", "--end-of-options", &format!("{branch}^{{commit}}"),
    ])?;
    if !matches!(base_sha.len(), 40 | 64) ||
        !base_sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("INVALID_GOAL_BASE_SHA".into());
    }
    if crate::goal_runs::git(&repository, &["rev-parse", "HEAD"])? != base_sha ||
        !crate::goal_runs::git(&repository,
            &["status", "--porcelain", "--untracked-files=all"])?.is_empty()
    {
        return Err("GOAL_CLEAN_APPROVED_CHECKOUT_REQUIRED".into());
    }
    let owner = crate::goal_runs::approval_owner(app)?;
    fs::create_dir_all(root).map_err(|_| "AGENT_V2_STORAGE_FAILED")?;
    let run = PreparedAgentRun {
        run_id: format!("{}.{}", scope.request_id, random_id()?),
        scope, repository, base_sha, worker,
    };
    let bytes = serde_json::to_vec(&run).map_err(|_| "AGENT_V2_RECORD_INVALID")?;
    write_once(&file, &bytes)?;
    let result = snapshot(&file, &run)?;
    let message = format!(
        "Approve Agent v2 READ-ONLY scope? No worker will be launched.\n\n\
         Worker: {} ({})\nExecutable SHA-256: {}\n\
         Workspace: {}\nRepository: {}\nBranch: {}\nBase SHA: {}\n\n\
         Objective:\n{}\n\nAcceptance:\n{}\n\n\
         Max turns: {}, deadline budget: {} minutes.\n\n\
         Approved read-only input files: {}\n\n\
         This approval grants no network, shell, write, publish or future dispatch.",
        run.worker.profile_id, run.worker.adapter_id, run.worker.executable_sha256,
        run.scope.workspace_id, run.repository.display(), run.scope.base_ref,
        run.base_sha, run.scope.objective, run.scope.acceptance.join("\n"),
        run.scope.limits.max_turns_per_task, run.scope.limits.wall_minutes,
        if run.scope.read_only_inputs.is_empty() {
            "(none — worker snapshot disabled)".to_owned()
        } else {
            run.scope.read_only_inputs.join(", ")
        }
    );
    tauri::async_runtime::spawn_blocking(move || {
        let approved = crate::operator_confirmation::confirm(
            owner, "LazyPrompting · Agent v2 read-only scope", &message
        );
        let decision = if approved {
            if revalidate_approved_worker(&run.worker).is_err() {
                b"worker-changed".to_vec()
            } else {
                approval_digest(&run).unwrap_or_else(|_| b"record-invalid".to_vec())
            }
        } else {
            b"declined".to_vec()
        };
        if let Err(error) = write_once(&file.with_extension("decision"), &decision) {
            eprintln!("Agent v2 scope approval storage: {error}");
        }
    });
    Ok(result)
}

pub(crate) fn schema(action: &str) -> Value {
    match action {
        "prepare" => json!({
            "type":"object","additionalProperties":false,
            "required":["schemaVersion","requestId","workspaceId","workerProfileId",
                "repositoryPath","baseRef","objective","acceptance"],
            "properties":{
                "schemaVersion":{"type":"integer","const":2},
                "requestId":{"type":"string","format":"uuid"},
                "workspaceId":{"type":"string","pattern":"^workspace-(0[1-9]|10)$"},
                "workerProfileId":{"type":"string","enum":["codex-local","opencode-local"]},
                "repositoryPath":{"type":"string","maxLength":1024},
                "baseRef":{"type":"string","maxLength":128},
                "objective":{"type":"string","maxLength":2000},
                "acceptance":{"type":"array","minItems":1,"maxItems":1,
                    "items":{"type":"string","maxLength":400}},
                "readOnlyInputs":{"type":"array","maxItems":24,
                    "items":{"type":"string","minLength":1,"maxLength":180}},
                "limits":{"type":"object","additionalProperties":false,
                    "properties":{
                        "maxActiveTasks":{"type":"integer","const":1},
                        "maxTurnsPerTask":{"type":"integer","minimum":1,"maximum":2},
                        "wallMinutes":{"type":"integer","minimum":1,"maximum":30}
                    }}
            }
        }),
        "status" | "stop" | "review_execution" => json!({
            "type":"object","additionalProperties":false,"required":["runId"],
            "properties":{"runId":{"type":"string","maxLength":69}}
        }),
        _ => json!({"type":"object","additionalProperties":false,"properties":{}}),
    }
}

pub(crate) async fn request(
    app: &tauri::AppHandle, action: &str, input: Value
) -> Result<Value, String> {
    let root = app.path().app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?.join("goal-runs");
    let app = app.clone();
    let action = action.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        if action == "prepare" {
            let scope: ScopeV2 = serde_json::from_value(input)
                .map_err(|_| "INVALID_AGENT_V2_SCOPE")?;
            return prepare(&app, &root, scope);
        }
        let lookup: Lookup = serde_json::from_value(input)
            .map_err(|_| "INVALID_AGENT_V2_LOOKUP")?;
        let (id, suffix) = lookup.run_id.split_once('.')
            .ok_or("INVALID_RUN_ID")?;
        if !valid_uuid(id) || suffix.len() != 32 ||
            !suffix.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("INVALID_RUN_ID".into());
        }
        let file = root.join(format!("{id}.v2.json"));
        let run = read_run(&file)?
            .filter(|run| run.run_id == lookup.run_id)
            .ok_or("AGENT_V2_RUN_NOT_FOUND")?;
        match action.as_str() {
            "status" => snapshot(&file, &run),
            "review_execution" => request_execution_review(&app, &file, &run),
            "stop" => {
                if !file.with_extension("stopped").exists() {
                    write_once(&file.with_extension("stopped"), b"stopped")?;
                }
                // STOP is durable first. Then terminate any process-tree
                // containment owned by this native Tauri instance. A lost
                // handle cannot turn the STOP marker back into authorization.
                let jobs = app.state::<crate::agent_worker_job::NativeWorkerJobs>();
                jobs.stop(&run.run_id).map_err(str::to_owned)?;
                snapshot(&file, &run)
            }
            _ => Err("INVALID_AGENT_V2_ACTION".into()),
        }
    }).await.map_err(|_| "AGENT_V2_WORKER_FAILED")?
}

// Look up an existing native v2 record without accepting a scope, executable,
// worker name, or directory from the Node child. This never writes storage.
fn bound_run(
    app: &tauri::AppHandle, run_id: &str
) -> Result<(PathBuf, PreparedAgentRun), String> {
    let (id, suffix) = run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
    if !valid_uuid(id) || suffix.len() != 32 ||
        !suffix.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("INVALID_RUN_ID".into());
    }
    let root = app.path().app_local_data_dir()
        .map_err(|_| "GOAL_DATA_DIR_UNAVAILABLE")?.join("goal-runs");
    let file = root.join(format!("{id}.v2.json"));
    let run = read_run(&file)?
        .filter(|run| run.run_id == run_id)
        .ok_or("AGENT_V2_RUN_NOT_FOUND")?;
    Ok((file, run))
}

// Sanitized source-status projection. Does not authorize a turn or attest QA.
pub(crate) fn inspect_prepared_source(
    app: &tauri::AppHandle, run_id: &str
) -> Result<Value, String> {
    let (file, run) = bound_run(app, run_id)?;
    let view = snapshot(&file, &run)?;
    Ok(json!({
        "source":"NATIVE_HOST_READ_ONLY","schemaVersion":2,
        "runId":run_id,"state":view["state"],
        "workspaceId":run.scope.workspace_id,
        "workerProfileId":run.scope.worker_profile_id,
        "adapterId":run.worker.adapter_id,
        "baseSha":run.base_sha,
        "scopeAndBinaryCurrent":view["scopeAndBinaryCurrent"],
        "executionReview":view["executionReview"],
        "executionReady":false,"nextPromptAllowed":false,
        "qa":"NOT_EXECUTED"
    }))
}

// Native v2 READ-ONLY source identity for the future common agent controller.
// This is intentionally NOT a worker capability attestation or dispatch
// approval. Runtime capability fields remain UNKNOWN and the sandbox fingerprint
// names an unimplemented boundary, so no adapter can interpret it as ready.
pub(crate) fn read_prepared_source_binding(
    app: &tauri::AppHandle, run_id: &str
) -> Result<Value, String> {
    let (file, run) = bound_run(app, run_id)?;
    let view = snapshot(&file, &run)?;
    if view["state"] != "APPROVED_SOURCE_ONLY"
        || view["scopeAndBinaryCurrent"] != true {
        return Err("AGENT_V2_SOURCE_NOT_APPROVED".into());
    }
    // Hashes identify source intent, not OS enforcement. A separate native
    // execution approval must bind a different, verified sandbox policy.
    let permission_hash = format!("{:x}", Sha256::digest(
        b"lazyprompting/agent-v2/source-only/read-only/no-execution/v1"
    ));
    let sandbox_hash = format!("{:x}", Sha256::digest(
        b"lazyprompting/agent-v2/native-sandbox-not-yet-verified/v1"
    ));
    let capabilities = json!({
        "openSession":"UNKNOWN","resumeSession":"UNKNOWN",
        "submitTurn":"UNKNOWN","observeTurn":"UNKNOWN",
        "cancelTurn":"UNKNOWN","streamEvents":"UNKNOWN",
        "toolPermissionCallback":"UNKNOWN","readOnlyIsolation":"UNKNOWN",
        "workspaceWriteIsolation":"UNSUPPORTED",
        "trustedToolExecution":"UNSUPPORTED","tokenUsage":"UNKNOWN",
        "contextCompaction":"UNKNOWN"
    });
    let parent = file.parent().ok_or("GOAL_DATA_DIR_UNAVAILABLE")?;
    let data_dir = parent.join(format!("{}.v2.run", run.scope.request_id));
    let stop_file = file.with_extension("stopped");
    let raw = serde_json::to_vec(&run).map_err(|_| "AGENT_V2_RECORD_INVALID")?;
    Ok(json!({
        "source":"NATIVE_HOST_READ_ONLY","schemaVersion":2,
        "bindingVersion":1,"runId":run_id,
        "goalId":run.scope.request_id,
        "workspaceId":run.scope.workspace_id,"taskId":"task-1",
        "sourceApprovalSha256":format!("{:x}", Sha256::digest(&raw)),
        "approvedInputCount":run.scope.read_only_inputs.len(),
        "sourceApproved":true,"executionAuthorized":false,
        "executionReview":view["executionReview"],
        "executionReady":false,"qa":"NOT_EXECUTED",
        "scope":{
            "workerProfile":{
                "profileId":run.worker.profile_id,
                "adapterId":run.worker.adapter_id,
                "adapterContractVersion":1,
                "runtimeVersion":"unverified",
                "executableSha256":run.worker.executable_sha256,
                "platform":"win32","capabilities":capabilities
            },
            "permissionPolicySha256":permission_hash,
            "sandboxPolicySha256":sandbox_hash,
            "executable":run.worker.executable.to_string_lossy().into_owned(),
            "cwd":run.repository.to_string_lossy().into_owned(),
            "dataDir":data_dir.to_string_lossy().into_owned(),
            "stopFile":stop_file.to_string_lossy().into_owned(),
            "objective":run.scope.objective,
            "acceptance":run.scope.acceptance,
            "baseSha":run.base_sha,
            "limits":{
                "maxActiveTasks":run.scope.limits.max_active_tasks,
                "maxTurnsPerTask":run.scope.limits.max_turns_per_task,
                "wallMinutes":run.scope.limits.wall_minutes
            },
            "coding":null
        }
    }))
}


// This is the ONLY source-owned v2 action decision at this milestone. It
// does not authorize any operation until a real, pinned OS process sandbox,
// worker-session receipt and independent verifier have been integrated.
// A source approval or operator's execution review is NEVER sufficient.
pub(crate) fn evaluate_agent_action(
    app: &tauri::AppHandle, run_id: &str, action: &str
) -> Result<Value, String> {
    if !matches!(action, "start" | "observe" | "cancel" | "reconcileReserved") {
        return Err("INVALID_AGENT_V2_ACTION".into());
    }
    let (file, run) = bound_run(app, run_id)?;
    let view = snapshot(&file, &run)?;
    let reason = if view["state"] == "STOPPED" {
        "AGENT_STOPPED"
    } else if view["state"] != "APPROVED_SOURCE_ONLY" ||
              view["scopeAndBinaryCurrent"] != true {
        "AGENT_V2_SOURCE_NOT_APPROVED"
    } else if view["executionReview"] != "REVIEWED_NO_EXECUTION" {
        "AGENT_EXECUTION_REVIEW_REQUIRED"
    } else if action == "start" {
        "AGENT_OS_SANDBOX_NOT_VERIFIED"
    } else {
        "AGENT_HOST_TURN_RECEIPT_REQUIRED"
    };
    Ok(json!({
        "source":"NATIVE_HOST_ACTION_POLICY","schemaVersion":2,
        "runId":run_id,"action":action,"admitted":false,
        "reason":reason,"executionReview":view["executionReview"],
        "executionReady":false,"nextPromptAllowed":false,
        "qa":"NOT_EXECUTED"
    }))
}


// Private Tauri-authority composition: no MCP or renderer method calls this.
// Only a fully reviewed, still-current run can produce a temporary, host-owned
// copy of explicitly approved tracked files. This does NOT launch a process,
// grant SID access or issue a provider/QA receipt.
pub(crate) fn stage_reviewed_worker_inputs(
    app: &tauri::AppHandle, run_id: &str
) -> Result<crate::agent_worker_snapshot::PreparedWorkerSnapshot, String> {
    let (file,run)=bound_run(app,run_id)?;
    let approved=snapshot(&file,&run)?;
    if approved["state"]!="APPROVED_SOURCE_ONLY" ||
       approved["executionReview"]!="REVIEWED_NO_EXECUTION" ||
       approved["scopeAndBinaryCurrent"]!=true {
        return Err("AGENT_INPUT_STAGE_NOT_AUTHORIZED".into());
    }
    if run.scope.read_only_inputs.is_empty() {
        return Err("AGENT_INPUT_STAGE_EMPTY_ALLOWLIST".into());
    }
    let base=app.path().app_local_data_dir()
        .map_err(|_|"AGENT_SNAPSHOT_ROOT_UNAVAILABLE")?;
    let inputs=base.join("agent-v2-private-inputs");
    if !inputs.exists() {
        fs::create_dir(&inputs).map_err(|_|"AGENT_SNAPSHOT_ROOT_UNAVAILABLE")?;
    }
    let staged=crate::agent_worker_snapshot::prepare_snapshot(
        &inputs,&run.repository,&run.scope.read_only_inputs,&run.base_sha
    ).map_err(str::to_owned)?;
    // STOP, file ACL or checkout changes while staging invalidate the
    // result; its Drop removes the private staging directory on failure.
    let recheck=snapshot(&file,&run)?;
    if recheck["state"]!="APPROVED_SOURCE_ONLY" ||
       recheck["executionReview"]!="REVIEWED_NO_EXECUTION" ||
       recheck["scopeAndBinaryCurrent"]!=true {
        return Err("AGENT_INPUT_STAGE_SOURCE_CHANGED".into());
    }
    Ok(staged)
}


// Private native pre-launch chain. Every stage owns its resources: a failure
// drops the snapshot, terminates the never-resumed child and retires the
// AppContainer profile/Job Object. No untrusted action, tool or renderer can
// invoke this; no ResumeThread/worker/provider call exists in this path.
//
// IMPORTANT: This does not prove OS filesystem/network denial. Only native
// security probes and a separate per-dispatch permission grant can ever allow
// a future running worker, and those are NOT implemented here.
pub(crate) fn assemble_private_suspended_job(
    app: &tauri::AppHandle, run_id: &str
) -> Result<crate::agent_worker_job::WorkerJobLease, String> {
    use crate::agent_worker_job::{WorkerJobBudget,WorkerJobLease};
    use crate::agent_worker_snapshot_acl::grant_snapshot_to_container;
    use crate::agent_worker_spawn::SuspendedAppContainerChild;

    let (file,run)=bound_run(app,run_id)?;
    let staged=stage_reviewed_worker_inputs(app,run_id)?;
    // Source-only stage: no prompt, arbitrary argv, command shell, inherited
    // user credentials, provider network or public process entrance.
    let child=SuspendedAppContainerChild::create(
        &run.worker,&run.repository,&[]
    ).map_err(str::to_owned)?;
    let granted=grant_snapshot_to_container(
        staged,child.appcontainer().map_err(str::to_owned)?
    ).map_err(str::to_owned)?;
    let budget=WorkerJobBudget::bounded(
        1,1024,768,u32::from(run.scope.limits.wall_minutes)
    ).map_err(str::to_owned)?;
    let mut job=WorkerJobLease::create(budget).map_err(str::to_owned)?;
    job.attach_suspended(child).map_err(str::to_owned)?;
    job.hold_snapshot(granted).map_err(str::to_owned)?;
    // Validate the approved run again after the OS operations. This method
    // returns an owned SUSPENDED job handle to native source only.
    let view=snapshot(&file,&run)?;
    if view["state"]!="APPROVED_SOURCE_ONLY" ||
       view["executionReview"]!="REVIEWED_NO_EXECUTION" ||
       view["scopeAndBinaryCurrent"]!=true {
        return Err("AGENT_PRELAUNCH_SOURCE_RECONCILE_REQUIRED".into());
    }
    Ok(job)
}
