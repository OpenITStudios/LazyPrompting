// Native worker stdout/stderr CAPTURE, not provider authorization, a model
// transport, or a final-turn receipt. No file/network/process access here.
//
// This bounded, incremental source stage consumes bytes from the host-owned
// pipe reader. The future native job owner must independently enforce a
// deadline and kill the job if a pipe stalls or a limit is exceeded. A worker
// stream is always untrusted data, even when its process token is verified.
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

const MAX_STDOUT_BYTES: usize = 1024 * 1024;
const MAX_STDERR_BYTES: usize = 128 * 1024;
const MAX_LINE_BYTES: usize = 128 * 1024;
const MAX_EVENTS: usize = 512;
const MAX_ID_BYTES: usize = 128;
const MAX_CHUNK: usize = 64 * 1024;

fn id_ok(value: &str) -> bool {
    !value.is_empty() && value.len() <= MAX_ID_BYTES &&
        value.bytes().all(|b| b.is_ascii_alphanumeric() ||
            matches!(b, b'_' | b'-' | b':'))
}
fn hash_hex(sha: Sha256) -> String {
    format!("{:x}", sha.finalize())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct WorkerIoIdentity {
    pub(crate) run_id: String,
    pub(crate) dispatch_id: String,
    pub(crate) session_id: String,
    pub(crate) scope_hash: String,
    pub(crate) profile_id: String,
    pub(crate) process_id: u32,
}

impl WorkerIoIdentity {
    pub(crate) fn valid(&self) -> bool {
        let Some((uuid, nonce)) = self.run_id.split_once('.') else { return false };
        let valid_run = uuid.len() == 36 && nonce.len() == 32 &&
            uuid.bytes().enumerate().all(|(i, b)| {
                if matches!(i, 8 | 13 | 18 | 23) { b == b'-' }
                else { b.is_ascii_hexdigit() }
            }) && nonce.bytes().all(|b| b.is_ascii_hexdigit());
        valid_run && id_ok(&self.dispatch_id) && id_ok(&self.session_id) &&
            matches!(self.profile_id.as_str(), "codex-local" | "opencode-local") &&
            self.scope_hash.len() == 64 &&
            self.scope_hash.bytes().all(|b| b.is_ascii_hexdigit()) &&
            self.process_id != 0
    }
}

// A private host observation, not a worker-supplied attestation. The caller
// MUST compare exact expected identity and persisted PromptOutbox reservation.
// It can be used only as input to independent provider reconciliation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkerIoCandidate {
    source: &'static str,
    disposition: &'static str,
    reason: &'static str,
    run_id: String,
    dispatch_id: String,
    session_id: String,
    scope_hash: String,
    profile_id: String,
    process_id: u32,
    candidate_turn_id: Option<String>,
    stdout_sha256: String,
    stderr_sha256: String,
    stdout_bytes: usize,
    stderr_bytes: usize,
    event_count: usize,
    exit_code: Option<i32>,
    qa: &'static str,
    next_prompt_allowed: bool,
}

// A strict OpenCode v2 JSONL interpretation. The real host may support other
// adapters later, but a Codex App Server event MUST NOT be parsed as OpenCode.
pub(crate) struct OpenCodeIoCapture {
    id: WorkerIoIdentity,
    stdout_hash: Sha256,
    stderr_hash: Sha256,
    line: Vec<u8>,
    stdout_bytes: usize,
    stderr_bytes: usize,
    event_count: usize,
    started: bool,
    finished: bool,
    error_seen: bool,
    text_id: Option<String>,
    text_seen: bool,
    closed: bool,
    invalid: Option<&'static str>,
}

impl OpenCodeIoCapture {
    pub(crate) fn new(id: WorkerIoIdentity) -> Result<Self, &'static str> {
        if !id.valid() || id.profile_id != "opencode-local" {
            return Err("AGENT_IO_IDENTITY_INVALID");
        }
        Ok(Self {
            id, stdout_hash: Sha256::new(), stderr_hash: Sha256::new(),
            line: Vec::new(), stdout_bytes: 0, stderr_bytes: 0,
            event_count: 0, started: false, finished: false,
            error_seen: false, text_id: None, text_seen: false,
            closed: false, invalid: None,
        })
    }

    // Feed bytes from a trusted native-owned stdout HANDLE, never from MCP,
    // a renderer, a model-produced payload or a host callback string.
    pub(crate) fn stdout(&mut self, chunk: &[u8]) -> Result<(), &'static str> {
        if self.closed { return Err("AGENT_IO_CAPTURE_CLOSED"); }
        if let Some(reason) = self.invalid { return Err(reason); }
        if chunk.len() > MAX_CHUNK ||
            self.stdout_bytes.checked_add(chunk.len()).is_none_or(|n| n > MAX_STDOUT_BYTES) {
            return self.hold("AGENT_IO_STDOUT_LIMIT");
        }
        self.stdout_bytes += chunk.len();
        self.stdout_hash.update(chunk);
        for &byte in chunk {
            if byte == b'\n' {
                if !self.line.is_empty() && self.line.last() == Some(&b'\r') {
                    self.line.pop();
                }
                if !self.line.is_empty() {
                    if self.event_count >= MAX_EVENTS {
                        return self.hold("AGENT_IO_EVENT_LIMIT");
                    }
                    self.event_count += 1;
                    if let Err(reason) = self.parse_line() {
                        return self.hold(reason);
                    }
                }
                self.line.clear();
            } else {
                if self.line.len() >= MAX_LINE_BYTES {
                    return self.hold("AGENT_IO_LINE_LIMIT");
                }
                self.line.push(byte);
            }
        }
        Ok(())
    }

    // stderr is diagnostic data only. It is hashed, never trusted as a
    // provider terminal event, and never returned through MCP/UI.
    pub(crate) fn stderr(&mut self, chunk: &[u8]) -> Result<(), &'static str> {
        if self.closed { return Err("AGENT_IO_CAPTURE_CLOSED"); }
        if let Some(reason) = self.invalid { return Err(reason); }
        if chunk.len() > MAX_CHUNK ||
            self.stderr_bytes.checked_add(chunk.len()).is_none_or(|n| n > MAX_STDERR_BYTES) {
            return self.hold("AGENT_IO_STDERR_LIMIT");
        }
        self.stderr_bytes += chunk.len();
        self.stderr_hash.update(chunk);
        Ok(())
    }

    fn hold(&mut self, reason: &'static str) -> Result<(), &'static str> {
        self.invalid = Some(reason);
        Err(reason)
    }

    fn parse_line(&mut self) -> Result<(), &'static str> {
        let value: Value = serde_json::from_slice(&self.line)
            .map_err(|_| "AGENT_IO_JSONL_MALFORMED")?;
        let data = value.as_object().ok_or("AGENT_IO_JSONL_MALFORMED")?;
        if data.get("sessionID").and_then(Value::as_str) != Some(self.id.session_id.as_str()) {
            return Err("AGENT_IO_SESSION_MISMATCH");
        }
        let kind = data.get("type").and_then(Value::as_str)
            .ok_or("AGENT_IO_EVENT_MALFORMED")?;
        if self.finished {
            // Any event after a completed step requires fresh reconciliation:
            // it might belong to a second step or a corrupted provider turn.
            return Err("AGENT_IO_EVENTS_AFTER_TERMINAL");
        }
        match kind {
            "step_start" => {
                if self.started { return Err("AGENT_IO_STEP_REPLAY"); }
                self.started = true;
            }
            "tool_use" => {
                let tool = data.get("part").and_then(|v| v.get("tool"))
                    .and_then(Value::as_str);
                if !matches!(tool, Some("read" | "glob" | "grep")) {
                    return Err("AGENT_IO_UNVERIFIED_TOOL_USE");
                }
            }
            "text" => {
                let part = data.get("part").ok_or("AGENT_IO_TEXT_INVALID")?;
                let id = part.get("messageID").and_then(Value::as_str)
                    .ok_or("AGENT_IO_TEXT_INVALID")?;
                if !id_ok(id) || !part.get("text").and_then(Value::as_str)
                    .is_some_and(|x| !x.trim().is_empty()) {
                    return Err("AGENT_IO_TEXT_INVALID");
                }
                if self.text_id.as_ref().is_some_and(|prior| prior != id) {
                    return Err("AGENT_IO_MESSAGE_ID_CHANGED");
                }
                self.text_id = Some(id.to_owned());
                self.text_seen = true;
            }
            "step_finish" => {
                let reason = data.get("part").and_then(|v| v.get("reason"))
                    .and_then(Value::as_str);
                if !self.started || !self.text_seen || reason != Some("stop") {
                    return Err("AGENT_IO_TERMINAL_CONFLICT");
                }
                self.finished = true;
            }
            "error" => { self.error_seen = true; }
            // Unknown events convey no permission and no terminal proof.
            _ => {}
        }
        Ok(())
    }

    pub(crate) fn finish(mut self, exit_code: Option<i32>) -> WorkerIoCandidate {
        self.closed = true;
        if !self.line.is_empty() && self.invalid.is_none() {
            // A final line without LF is allowed only when it is complete
            // valid JSON. EOF itself is NOT a completion event.
            if self.event_count >= MAX_EVENTS {
                self.invalid = Some("AGENT_IO_EVENT_LIMIT");
            } else {
                self.event_count += 1;
                if let Err(reason) = self.parse_line() {
                    self.invalid = Some(reason);
                }
            }
        }
        let (disposition, reason) = if let Some(invalid) = self.invalid {
            ("RECONCILE_REQUIRED", invalid)
        } else if self.error_seen || exit_code.is_some_and(|x| x != 0) {
            ("RECONCILE_REQUIRED", "AGENT_IO_PROVIDER_ERROR")
        } else if exit_code.is_none() {
            ("RECONCILE_REQUIRED", "AGENT_IO_EXIT_UNOBSERVED")
        } else if !self.finished || !self.text_seen {
            ("RECONCILE_REQUIRED", "AGENT_IO_TERMINAL_MISSING")
        } else {
            // Even a clean stream + zero exit is NOT host/provider receipt
            // attestation. Only a separate trusted provider-session lookup
            // may upgrade this candidate into an acknowledged outbox record.
            ("TERMINAL_CANDIDATE", "AGENT_IO_HOST_RECONCILIATION_REQUIRED")
        };
        WorkerIoCandidate {
            source: "NATIVE_PROCESS_OUTPUT_CAPTURE_ONLY",
            disposition, reason,
            run_id: self.id.run_id,
            dispatch_id: self.id.dispatch_id,
            session_id: self.id.session_id,
            scope_hash: self.id.scope_hash,
            profile_id: self.id.profile_id,
            process_id: self.id.process_id,
            candidate_turn_id: self.text_id,
            stdout_sha256: hash_hex(self.stdout_hash),
            stderr_sha256: hash_hex(self.stderr_hash),
            stdout_bytes: self.stdout_bytes,
            stderr_bytes: self.stderr_bytes,
            event_count: self.event_count,
            exit_code,
            qa: "NOT_EXECUTED", next_prompt_allowed: false,
        }
    }
}
