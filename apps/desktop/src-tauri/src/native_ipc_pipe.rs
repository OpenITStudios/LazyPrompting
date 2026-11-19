use std::io;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::ptr::{addr_of_mut, null_mut};
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tokio::time::timeout;
use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE};
use windows_sys::Win32::Security::{
    AddAccessAllowedAce, GetTokenInformation, InitializeAcl, InitializeSecurityDescriptor,
    SetSecurityDescriptorDacl, TokenLogonSid, ACL, ACL_REVISION, SECURITY_ATTRIBUTES,
    SECURITY_DESCRIPTOR, TOKEN_GROUPS, TOKEN_QUERY,
};
use windows_sys::Win32::System::Pipes::GetNamedPipeClientProcessId;
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

use super::lightpanda_grants::{LightpandaGrantStore, PreviewTargetScope};
use super::native_ipc_auth::HostChallenge;
use super::native_ipc_frame::{read_frame_async, write_frame_async};

const DEADLINE: Duration = Duration::from_secs(8);

// Native effect callbacks share the parent stdio request deadline.
// Async frame waits cannot silently extend the request's total budget.
fn callback_budget(
    deadline: Instant,
    per_frame: Duration,
    timeout_code: &'static str,
) -> Result<Duration, &'static str> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        Err(timeout_code)
    } else {
        Ok(remaining.min(per_frame))
    }
}

pub(crate) struct NativePipeListener {
    pub(crate) server: NamedPipeServer,
}

pub(crate) struct AuthenticatedPipe {
    server: NamedPipeServer,
    grants: LightpandaGrantStore,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdmissionRequest {
    #[serde(rename = "type")]
    kind: String,
    grant_id: String,
    capability: String,
    workspace_id: String,
    url: Option<String>,
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

impl NativePipeListener {
    pub(crate) fn bind(name: &str) -> io::Result<Self> {
        Self::bind_with_instances(name, true, 1)
    }

    pub(crate) fn bind_with_instances(name: &str, first: bool, max: usize) -> io::Result<Self> {
        let suffix = name
            .strip_prefix(r"\\.\pipe\lazyprompting-")
            .unwrap_or_default();
        if suffix.len() != 32 || !suffix.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "IPC_INVALID_PIPE_NAME",
            ));
        }
        // The token buffer owns the SID until AddAccessAllowedAce copies it.
        let mut handle = null_mut();
        let token = unsafe {
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut handle) == 0 {
                return Err(io::Error::last_os_error());
            }
            OwnedHandle::from_raw_handle(handle)
        };
        let mut length = 0;
        unsafe {
            GetTokenInformation(
                token.as_raw_handle(),
                TokenLogonSid,
                null_mut(),
                0,
                &mut length,
            )
        };
        if !(size_of::<TOKEN_GROUPS>() as u32..=4096).contains(&length) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "IPC_LOGON_SID_UNAVAILABLE",
            ));
        }
        let mut token_info = vec![0usize; (length as usize).div_ceil(size_of::<usize>())];
        let mut acl_storage = [0u32; 32];
        let acl = acl_storage.as_mut_ptr().cast::<ACL>();
        let mut descriptor = SECURITY_DESCRIPTOR::default();
        let descriptor = addr_of_mut!(descriptor).cast();
        let server = unsafe {
            if GetTokenInformation(
                token.as_raw_handle(),
                TokenLogonSid,
                token_info.as_mut_ptr().cast(),
                length,
                &mut length,
            ) == 0
            {
                return Err(io::Error::last_os_error());
            }
            let groups = &*token_info.as_ptr().cast::<TOKEN_GROUPS>();
            if groups.GroupCount != 1 || groups.Groups[0].Sid.is_null() {
                return Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "IPC_LOGON_SID_UNAVAILABLE",
                ));
            }
            if InitializeAcl(acl, size_of::<[u32; 32]>() as u32, ACL_REVISION) == 0
                || AddAccessAllowedAce(
                    acl,
                    ACL_REVISION,
                    GENERIC_READ | GENERIC_WRITE,
                    groups.Groups[0].Sid,
                ) == 0
                || InitializeSecurityDescriptor(descriptor, 1) == 0
                || SetSecurityDescriptorDacl(descriptor, 1, acl, 0) == 0
            {
                return Err(io::Error::last_os_error());
            }
            let mut attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: descriptor,
                bInheritHandle: 0,
            };
            // Windows copies the descriptor while creating the instance.
            ServerOptions::new()
                .first_pipe_instance(first)
                .max_instances(max)
                .reject_remote_clients(true)
                .create_with_security_attributes_raw(name, addr_of_mut!(attributes).cast())?
        };
        Ok(Self { server })
    }

    async fn accept_pid(&self, expected_pid: u32) -> Result<(), &'static str> {
        self.server
            .connect()
            .await
            .map_err(|_| "IPC_CONNECT_FAILED")?;
        let mut pid = 0;
        if unsafe { GetNamedPipeClientProcessId(self.server.as_raw_handle(), &mut pid) } == 0
            || pid == 0
            || pid != expected_pid
        {
            return Err("IPC_CLIENT_PID_MISMATCH");
        }
        Ok(())
    }

    pub(crate) async fn authenticate(
        mut self,
        child_pid: u32,
        session: [u8; 16],
        secret: [u8; 32],
    ) -> Result<AuthenticatedPipe, &'static str> {
        timeout(DEADLINE, async {
            self.accept_pid(child_pid).await?;
            let mut challenge = HostChallenge::new(secret, child_pid, session)?;
            write_frame_async(
                &mut self.server,
                &json!({
                    "type":"challenge", "nonce":hex(&challenge.nonce())
                }),
            )
            .await?;
            let message = read_frame_async(&mut self.server).await?;
            let proof = child_proof(&message).ok_or("IPC_CHILD_PROOF_INVALID")?;
            if !challenge.verify_child(child_pid, &proof) {
                return Err("IPC_CHILD_PROOF_INVALID");
            }
            let host = challenge.host_proof().ok_or("IPC_HOST_PROOF_UNAVAILABLE")?;
            write_frame_async(
                &mut self.server,
                &json!({"type":"hostProof","proof":hex(&host)}),
            )
            .await?;
            if read_frame_async(&mut self.server).await? != json!({"type":"authenticated"}) {
                return Err("IPC_CHILD_CONFIRMATION_INVALID");
            }
            Ok(())
        })
        .await
        .map_err(|_| "IPC_HANDSHAKE_TIMEOUT")??;
        Ok(AuthenticatedPipe {
            server: self.server,
            grants: LightpandaGrantStore::default(),
        })
    }
}

// Parse and bound the exact one-shot native effect frame before any action.
fn code_effect_request_allowed(frame: &Value, token: &str, invoked: bool) -> bool {
    !invoked
        && frame.as_object().is_some_and(|obj| obj.len() == 4)
        && frame["type"] == "codeEffectRequest"
        && frame["token"].as_str() == Some(token)
        && matches!(
            frame["capability"].as_str(),
            Some("workspace_chat.prepare_handoff" | "workspace_chat.continue_handoff")
        )
        && frame["arguments"].is_object()
        && serde_json::to_vec(&frame["arguments"]).is_ok_and(|bytes| bytes.len() <= 8192)
}

impl AuthenticatedPipe {
    // During an authenticated private stdio request, allow the owned Node
    // gateway to ask bounded read-only questions of the native authority.
    // The native caller must hold the per-session gateway operation lock.
    // This shares the same pipe as Lightpanda admission, so it must never
    // run simultaneously with authorize_next.
    pub(crate) async fn serve_agent_callbacks(
        &mut self,
        token: &str,
        request_deadline: Instant,
        mut query: impl FnMut(&str, &str) -> Result<Value, String>,
    ) -> Result<(), &'static str> {
        if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("AGENT_CALLBACK_TOKEN_INVALID");
        }
        let deadline = request_deadline.min(Instant::now() + Duration::from_secs(22));
        for _ in 0..8 {
            let remaining = callback_budget(deadline, DEADLINE, "AGENT_CALLBACK_DEADLINE")?;
            let frame = timeout(remaining, read_frame_async(&mut self.server))
                .await
                .map_err(|_| "AGENT_CALLBACK_TIMEOUT")??;
            if frame["token"].as_str() != Some(token) {
                return Err("AGENT_CALLBACK_TOKEN_MISMATCH");
            }
            match frame["type"].as_str() {
                Some("agentCallbackDone") => {
                    if frame.as_object().is_none_or(|x| x.len() != 2) {
                        return Err("AGENT_CALLBACK_INVALID_DONE");
                    }
                    return Ok(());
                }
                Some("agentCallback") => {
                    if frame.as_object().is_none_or(|x| x.len() != 4) {
                        return Err("AGENT_CALLBACK_INVALID_FRAME");
                    }
                    let operation = frame["operation"]
                        .as_str()
                        .ok_or("AGENT_CALLBACK_INVALID_FRAME")?;
                    let run_id = frame["runId"]
                        .as_str()
                        .ok_or("AGENT_CALLBACK_INVALID_FRAME")?;
                    if !matches!(
                        operation,
                        "inspectPreparedRun" | "readApprovedSource" | "evaluateAgentAction"
                    ) {
                        return Err("AGENT_CALLBACK_OPERATION_DENIED");
                    }
                    let mut response = json!({"type":"agentCallbackResult",
                        "token":token,"operation":operation});
                    // A delayed frame must not start native source/approval work
                    // after the parent request deadline has expired.
                    callback_budget(deadline, DEADLINE, "AGENT_CALLBACK_DEADLINE")?;
                    match query(operation, run_id) {
                        Ok(result) => response["result"] = result,
                        Err(error) => {
                            response["error"] = json!(error);
                        }
                    }
                    let remaining =
                        callback_budget(deadline, DEADLINE, "AGENT_CALLBACK_REPLY_TIMEOUT")?;
                    timeout(remaining, write_frame_async(&mut self.server, &response))
                        .await
                        .map_err(|_| "AGENT_CALLBACK_REPLY_TIMEOUT")??;
                }
                _ => return Err("AGENT_CALLBACK_INVALID_FRAME"),
            }
        }
        Err("AGENT_CALLBACK_CAPACITY")
    }

    // One scoped, synchronous native effect per Code Mode program.
    // The authenticated pipe, per-request token and original MCP-client
    // lease gate are mandatory; an effect is never authorized by JS.
    // The existing manual draft inbox supplies idempotent fingerprinting.
    pub(crate) async fn serve_code_effect_callbacks(
        &mut self,
        token: &str,
        request_deadline: Instant,
        mut run: impl FnMut(&str, &Value) -> Result<Value, String>,
    ) -> Result<(), &'static str> {
        if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("CODE_EFFECT_TOKEN_INVALID");
        }
        let mut invoked = false;
        for _ in 0..2 {
            let remaining = callback_budget(
                request_deadline,
                Duration::from_secs(4),
                "CODE_EFFECT_CALLBACK_TIMEOUT",
            )?;
            let frame = timeout(remaining, read_frame_async(&mut self.server))
                .await
                .map_err(|_| "CODE_EFFECT_CALLBACK_TIMEOUT")??;
            if frame["token"].as_str() != Some(token) {
                return Err("CODE_EFFECT_TOKEN_MISMATCH");
            }
            match frame["type"].as_str() {
                Some("codeEffectDone") => {
                    if frame.as_object().is_none_or(|obj| obj.len() != 2) {
                        return Err("CODE_EFFECT_DONE_INVALID");
                    }
                    return Ok(());
                }
                Some("codeEffectRequest") => {
                    if !code_effect_request_allowed(&frame, token, invoked) {
                        return Err("CODE_EFFECT_CAPABILITY_DENIED");
                    }
                    let capability = frame["capability"]
                        .as_str()
                        .ok_or("CODE_EFFECT_FRAME_INVALID")?;
                    let args = &frame["arguments"];
                    callback_budget(
                        request_deadline,
                        Duration::from_secs(4),
                        "CODE_EFFECT_CALLBACK_TIMEOUT",
                    )?;
                    invoked = true;
                    let mut reply = json!({"type":"codeEffectResult",
                        "token":token,"capability":capability});
                    match run(capability, args) {
                        Ok(result) => reply["result"] = result,
                        Err(reason) => {
                            reply["error"] = json!(if reason.len() <= 80
                                && reason.bytes().all(|b| b.is_ascii_uppercase() || b == b'_')
                            {
                                reason
                            } else {
                                "CODE_EFFECT_DENIED".to_owned()
                            })
                        }
                    }
                    let remaining = callback_budget(
                        request_deadline,
                        Duration::from_secs(4),
                        "CODE_EFFECT_REPLY_TIMEOUT",
                    )?;
                    timeout(remaining, write_frame_async(&mut self.server, &reply))
                        .await
                        .map_err(|_| "CODE_EFFECT_REPLY_TIMEOUT")??;
                }
                _ => return Err("CODE_EFFECT_FRAME_INVALID"),
            }
        }
        Err("CODE_EFFECT_CAPACITY")
    }

    pub(crate) fn issue_grant(
        &mut self,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
        operator_approved: bool,
        backend_verified: bool,
    ) -> Option<String> {
        self.grants.issue_secure(
            capability,
            workspace,
            url,
            DEADLINE,
            operator_approved,
            true,
            backend_verified,
        )
    }

    // Native window-owned offline action only. Reuse the SAME grant store
    // as existing read permissions; issue and consume one exact target
    // grant immediately before invoking a trusted Rust CDP operation.
    // No renderer/MCP/Code Mode channel can mint this grant.
    pub(crate) fn run_native_preview_target<T>(
        &mut self,
        scope: PreviewTargetScope,
        execute: impl FnOnce() -> Result<T, &'static str>,
    ) -> Result<T, &'static str> {
        let grant = self
            .grants
            .issue_reviewed_target(scope.clone(), Duration::from_secs(8), true, true, true)
            .ok_or("BROWSER_ACTION_GRANT_DENIED")?;
        if !self.grants.consume_reviewed_target(&grant, &scope) {
            return Err("BROWSER_ACTION_GRANT_CONSUMED");
        }
        execute()
    }

    // One frame corresponds to one host-originated MCP invocation. A malformed
    // frame, a different grant, or a timeout retires the pending grant as well.
    pub(crate) async fn authorize_next(
        &mut self,
        expected_grant: &str,
        request_deadline: Instant,
        execute: impl FnOnce() -> Result<Value, &'static str>,
    ) -> Result<(), &'static str> {
        let remaining = match callback_budget(request_deadline, DEADLINE, "IPC_ADMISSION_TIMEOUT") {
            Ok(remaining) => remaining,
            Err(error) => {
                self.grants.revoke(expected_grant);
                return Err(error);
            }
        };
        let result = timeout(remaining, async {
            let message = read_frame_async(&mut self.server).await?;
            let request: AdmissionRequest =
                serde_json::from_value(message).map_err(|_| "IPC_INVALID_ADMISSION_REQUEST")?;
            let allowed = request.kind == "authorize"
                && request.grant_id == expected_grant
                && self.grants.consume(
                    expected_grant,
                    &request.capability,
                    &request.workspace_id,
                    request.url.as_deref(),
                );
            let mut reply = json!({
                "type":"admission", "grantId":request.grant_id, "allowed":allowed
            });
            if allowed {
                // Consume a grant once. If the deadline expired before the
                // synchronous native effect starts, deny instead of replaying.
                callback_budget(request_deadline, DEADLINE, "IPC_ADMISSION_TIMEOUT")?;
                match execute() {
                    Ok(result) => reply["result"] = result,
                    Err(code) => reply["error"] = json!(code),
                }
            }
            write_frame_async(&mut self.server, &reply).await?;
            if !allowed {
                return Err("IPC_ADMISSION_DENIED");
            }
            Ok(())
        })
        .await;
        self.grants.revoke(expected_grant);
        result.map_err(|_| "IPC_ADMISSION_TIMEOUT")?
    }
}

fn child_proof(message: &Value) -> Option<[u8; 32]> {
    if message["type"] != "childProof" || message.as_object()?.len() != 2 {
        return None;
    }
    let text = message["proof"].as_str()?;
    if text.len() != 64 || !text.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let mut bytes = [0; 32];
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&text[index * 2..index * 2 + 2], 16).ok()?;
    }
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::windows::named_pipe::ClientOptions;

    #[test]
    fn callback_deadlines_reject_late_effects_and_cap_frame_waits() {
        let expired = Instant::now();
        assert_eq!(
            callback_budget(expired, DEADLINE, "EXPIRED").unwrap_err(),
            "EXPIRED"
        );
        let remaining = callback_budget(
            Instant::now() + Duration::from_secs(1),
            Duration::from_millis(20),
            "EXPIRED",
        )
        .unwrap();
        assert!(!remaining.is_zero());
        assert!(remaining <= Duration::from_millis(20));
    }

    #[test]
    fn code_mode_native_effect_frame_requires_exact_token_and_single_call() {
        let token = "a".repeat(32);
        let valid = json!({"type":"codeEffectRequest","token":token,
            "capability":"workspace_chat.prepare_handoff",
            "arguments":{"workspaceId":"workspace-01","goal":"Review",
            "acceptance":["Inspect source"]}});
        assert!(code_effect_request_allowed(&valid, &token, false));
        assert!(!code_effect_request_allowed(&valid, &token, true));
        assert!(!code_effect_request_allowed(&valid, &"b".repeat(32), false));
        for (key, value) in [
            ("capability", json!("goal_run.start")),
            ("arguments", json!("arbitrary shell command")),
            ("token", json!("bad")),
            ("type", json!("codeEffectDone")),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(!code_effect_request_allowed(&invalid, &token, false));
        }
        let continuation = json!({"type":"codeEffectRequest","token":token,
            "capability":"workspace_chat.continue_handoff",
            "arguments":{"workspaceId":"workspace-01",
                "previousFingerprint":"a".repeat(64),"reply":"Operator input"}});
        assert!(code_effect_request_allowed(&continuation, &token, false));
        assert!(!code_effect_request_allowed(&continuation, &token, true));
        let mut unknown = continuation;
        unknown["capability"] = json!("workspace_chat.submit");
        assert!(!code_effect_request_allowed(&unknown, &token, false));
        let mut extras = valid.clone();
        extras["grant"] = json!(true);
        assert!(!code_effect_request_allowed(&extras, &token, false));
        let mut excess = valid;
        excess["arguments"]["goal"] = json!("x".repeat(8193));
        assert!(!code_effect_request_allowed(&excess, &token, false));
    }

    #[test]
    fn rejects_other_process_id_before_challenge() {
        tauri::async_runtime::block_on(async {
            let mut nonce = [0; 16];
            getrandom::getrandom(&mut nonce).unwrap();
            let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&nonce));
            let pipe = NativePipeListener::bind(&name).unwrap();
            assert!(NativePipeListener::bind(&name).is_err());
            let _client = ClientOptions::new().open(&name).unwrap();
            let result = pipe
                .authenticate(std::process::id() ^ 1, nonce, [0; 32])
                .await;
            assert!(matches!(result, Err("IPC_CLIENT_PID_MISMATCH")));
        });
    }

    #[test]
    fn matching_pid_with_forged_proof_is_denied() {
        tauri::async_runtime::block_on(async {
            let mut nonce = [0; 16];
            getrandom::getrandom(&mut nonce).unwrap();
            let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&nonce));
            let pipe = NativePipeListener::bind(&name).unwrap();
            let mut client = ClientOptions::new().open(&name).unwrap();
            let fake = tokio::spawn(async move {
                assert_eq!(
                    read_frame_async(&mut client).await.unwrap()["type"],
                    "challenge"
                );
                write_frame_async(
                    &mut client,
                    &json!({"type":"childProof","proof":"ff".repeat(32)}),
                )
                .await
                .unwrap();
            });
            let result = pipe.authenticate(std::process::id(), nonce, [0; 32]).await;
            assert!(matches!(result, Err("IPC_CHILD_PROOF_INVALID")));
            fake.await.unwrap();
        });
    }

    #[test]
    fn native_admission_consumes_scope_and_rejects_replay() {
        tauri::async_runtime::block_on(async {
            let mut nonce = [0; 16];
            getrandom::getrandom(&mut nonce).unwrap();
            let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&nonce));
            let listener = NativePipeListener::bind(&name).unwrap();
            let mut client = ClientOptions::new().open(&name).unwrap();
            listener.accept_pid(std::process::id()).await.unwrap();
            let mut pipe = AuthenticatedPipe {
                server: listener.server,
                grants: LightpandaGrantStore::default(),
            };
            assert!(pipe
                .issue_grant("lightpanda.snapshot", "workspace-01", None, true, false)
                .is_none());
            let grant = pipe
                .issue_grant("lightpanda.snapshot", "workspace-01", None, true, true)
                .unwrap();
            let wrong_scope = pipe
                .issue_grant("lightpanda.snapshot", "workspace-02", None, true, true)
                .unwrap();
            for (id, workspace, allowed) in [
                (&grant, "workspace-01", true),
                (&grant, "workspace-01", false),
                (&wrong_scope, "workspace-01", false),
                (&wrong_scope, "workspace-02", false),
            ] {
                write_frame_async(
                    &mut client,
                    &json!({
                        "type":"authorize","grantId":id,"capability":"lightpanda.snapshot",
                        "workspaceId":workspace,"url":null
                    }),
                )
                .await
                .unwrap();
                let result = pipe
                    .authorize_next(id, Instant::now() + DEADLINE, || {
                        Ok(json!({"executed":true}))
                    })
                    .await;
                assert_eq!(result.is_ok(), allowed);
                let reply = read_frame_async(&mut client).await.unwrap();
                assert_eq!(reply["grantId"], id.as_str());
                assert_eq!(reply["allowed"], allowed);
                assert_eq!(reply.get("result").is_some(), allowed);
            }
        });
    }
}
