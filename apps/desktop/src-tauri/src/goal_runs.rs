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
        match (action.as_str(), lookup.action.as_deref()) {
            ("status" | "report", None) => snapshot(&file, &run),
            ("control", Some("stop")) => {
                if !file.with_extension("stopped").is_file() {
                    write_atomic(&file.with_extension("stopped"), b"stopped")?;
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
                if !matches!(
                    report["state"].as_str(),
                    Some("RUNNING" | "NEEDS_ATTENTION")
                ) || !report["deadline"].is_u64()
                {
                    return Err("GOAL_RESUME_NOT_AVAILABLE".into());
                }
                launch(&app, &file, &run, true)?;
                Ok(json!({"runId":run.run_id,"state":"STARTING","mode":run.scope.mode()}))
            }
            ("control", Some("pause")) => Err("GOAL_PAUSE_UNAVAILABLE".into()),
            _ => Err("INVALID_GOAL_ACTION".into()),
        }
    })
    .await
    .map_err(|_| "GOAL_WORKER_FAILED")?
}

fn start(app: &tauri::AppHandle, root: &Path, mut scope: Scope) -> Result<Value, String> {
    scope.request_id.make_ascii_lowercase();
    validate(&scope)?;
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
        let approved =
            crate::operator_confirmation::confirm(owner, "LazyPrompting · Goal scope", &message);
        let decision: &[u8] = if approved {
            run.scope.approval()
        } else {
            b"declined"
        };
        if let Err(error) = write_atomic(&file.with_extension("decision"), decision) {
            eprintln!("Goal approval storage: {error}");
            return;
        }
        if approved && !file.with_extension("stopped").exists() {
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

fn load_report(file: &Path) -> Result<Option<Value>, String> {
    match fs::read(file.with_extension("run").join("report.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(|_| "GOAL_STORAGE_FAILED".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("GOAL_STORAGE_FAILED".into()),
    }
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
        "executionAvailable":decision==run.scope.approval(),"mode":run.scope.mode(),"tasks":[]});
    if decision == run.scope.approval() {
        if let Some(report) = load_report(file)? {
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
        result["reason"] = json!("GOAL_EXECUTOR_UNAVAILABLE");
    }
    Ok(result)
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

fn git(repository: &Path, args: &[&str]) -> Result<String, String> {
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
}
