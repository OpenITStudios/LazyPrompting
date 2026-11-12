// Read-only native inventory. This is NOT a provider registration, execution
// grant, login check or proof that sandbox and QA are ready.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Read, Result as IoResult},
    path::Path,
};

// Executables above this bound require an operator-owned inventory procedure.
// Discovery never launches a binary or follows a model-supplied path.
const MAX_BINARY_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentWorkerProfileStatus {
    profile_id: &'static str,
    adapter_id: &'static str,
    source: &'static str,
    configured: bool,
    executable_sha256: Option<String>,
    execution_ready: bool,
    reason: &'static str,
}

fn digest_executable(path: &Path) -> IoResult<String> {
    let file = File::open(path)?;
    let meta = file.metadata()?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_BINARY_BYTES {
        return Err(std::io::Error::other("AGENT_BINARY_SIZE_INVALID"));
    }
    let mut reader = std::io::BufReader::new(file);
    let mut buffer = [0u8; 64 * 1024];
    let mut sha = Sha256::new();
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        sha.update(&buffer[..count]);
    }
    Ok(format!("{:x}", sha.finalize()))
}

fn profile(
    profile_id: &'static str,
    adapter_id: &'static str,
    variable: &'static str,
) -> AgentWorkerProfileStatus {
    let Some(raw) = std::env::var_os(variable) else {
        return AgentWorkerProfileStatus {
            profile_id,
            adapter_id,
            source: "NATIVE_HOST_READ_ONLY",
            configured: false,
            executable_sha256: None,
            execution_ready: false,
            reason: "AGENT_EXECUTABLE_NOT_CONFIGURED",
        };
    };
    let source = Path::new(&raw);
    if !source.is_absolute() || source.extension().and_then(|e| e.to_str())
        .is_none_or(|e| !e.eq_ignore_ascii_case("exe"))
    {
        return AgentWorkerProfileStatus {
            profile_id, adapter_id, source: "NATIVE_HOST_READ_ONLY",
            configured: false, executable_sha256: None, execution_ready: false,
            reason: "AGENT_EXECUTABLE_PATH_INVALID",
        };
    }
    let result = fs::canonicalize(source).and_then(|path| digest_executable(&path));
    match result {
        Ok(hash) => AgentWorkerProfileStatus {
            profile_id, adapter_id, source: "NATIVE_HOST_READ_ONLY",
            configured: true, executable_sha256: Some(hash),
            execution_ready: false,
            reason: "AGENT_NATIVE_SANDBOX_AND_APPROVAL_REQUIRED",
        },
        Err(_) => AgentWorkerProfileStatus {
            profile_id, adapter_id, source: "NATIVE_HOST_READ_ONLY",
            configured: false, executable_sha256: None, execution_ready: false,
            reason: "AGENT_EXECUTABLE_UNAVAILABLE",
        },
    }
}

// This command never supplies executable paths, permission flags or secrets
// to the renderer. A digest is diagnostic only: execution must rehash the file
// and validate a native scope + process sandbox immediately before spawn.
#[tauri::command]
pub(crate) fn list_agent_worker_profiles() -> Vec<AgentWorkerProfileStatus> {
    vec![
        profile("codex-local", "codex-app-server", "LAZYPROMPTING_CODEX_EXE"),
        profile("opencode-local", "opencode-v2", "LAZYPROMPTING_OPENCODE_EXE"),
    ]
}


#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ApprovedWorkerIdentity {
    pub(crate) profile_id: String,
    pub(crate) adapter_id: String,
    pub(crate) executable: std::path::PathBuf,
    pub(crate) executable_sha256: String,
}

// Native host only. This is a snapshot for a future *separately approved*
// launch; a SHA-256 digest is not a credential or a sandbox grant.
pub(crate) fn resolve_approved_worker(profile_id: &str) -> Result<ApprovedWorkerIdentity, String> {
    let (adapter, variable) = match profile_id {
        "codex-local" => ("codex-app-server", "LAZYPROMPTING_CODEX_EXE"),
        "opencode-local" => ("opencode-v2", "LAZYPROMPTING_OPENCODE_EXE"),
        _ => return Err("AGENT_PROFILE_NOT_SUPPORTED".into()),
    };
    let raw = std::env::var_os(variable).ok_or("AGENT_EXECUTABLE_NOT_CONFIGURED")?;
    let source = std::path::PathBuf::from(raw);
    if !source.is_absolute()
        || source.extension().and_then(|s| s.to_str())
            .is_none_or(|s| !s.eq_ignore_ascii_case("exe"))
    {
        return Err("AGENT_EXECUTABLE_PATH_INVALID".into());
    }
    let canonical = fs::canonicalize(&source).map_err(|_| "AGENT_EXECUTABLE_UNAVAILABLE")?;
    let digest = digest_executable(&canonical)
        .map_err(|_| "AGENT_EXECUTABLE_UNAVAILABLE")?;
    Ok(ApprovedWorkerIdentity {
        profile_id: profile_id.to_owned(), adapter_id: adapter.to_owned(),
        executable: canonical, executable_sha256: digest,
    })
}

pub(crate) fn revalidate_approved_worker(expected: &ApprovedWorkerIdentity) -> Result<(), String> {
    let now = resolve_approved_worker(&expected.profile_id)?;
    if now != *expected {
        return Err("AGENT_APPROVED_EXECUTABLE_CHANGED".into());
    }
    Ok(())
}
