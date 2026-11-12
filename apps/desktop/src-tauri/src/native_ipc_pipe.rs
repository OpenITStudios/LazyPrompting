use std::io;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::ptr::{addr_of_mut, null_mut};
use std::time::Duration;

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

use super::lightpanda_grants::LightpandaGrantStore;
use super::native_ipc_auth::HostChallenge;
use super::native_ipc_frame::{read_frame_async, write_frame_async};

const DEADLINE: Duration = Duration::from_secs(8);

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

impl AuthenticatedPipe {
    // During an authenticated private stdio request, allow the owned Node
    // gateway to ask bounded read-only questions of the native authority.
    // The native caller must hold the per-session gateway operation lock.
    // This shares the same pipe as Lightpanda admission, so it must never
    // run simultaneously with authorize_next.
    pub(crate) async fn serve_agent_callbacks(
        &mut self,
        token: &str,
        mut query: impl FnMut(&str, &str) -> Result<Value, String>,
    ) -> Result<(), &'static str> {
        use std::time::Instant;
        if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("AGENT_CALLBACK_TOKEN_INVALID");
        }
        let deadline = Instant::now() + Duration::from_secs(22);
        for _ in 0..8 {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("AGENT_CALLBACK_DEADLINE");
            }
            let frame = timeout(remaining.min(DEADLINE), read_frame_async(&mut self.server))
                .await.map_err(|_| "AGENT_CALLBACK_TIMEOUT")??;
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
                    let operation = frame["operation"].as_str()
                        .ok_or("AGENT_CALLBACK_INVALID_FRAME")?;
                    let run_id = frame["runId"].as_str()
                        .ok_or("AGENT_CALLBACK_INVALID_FRAME")?;
                    if !matches!(operation, "inspectPreparedRun" | "readApprovedSource" |
                        "evaluateAgentAction") {
                        return Err("AGENT_CALLBACK_OPERATION_DENIED");
                    }
                    let mut response = json!({"type":"agentCallbackResult",
                        "token":token,"operation":operation});
                    match query(operation, run_id) {
                        Ok(result) => response["result"] = result,
                        Err(error) => {
                            response["error"] = json!(error);
                        }
                    }
                    timeout(DEADLINE, write_frame_async(&mut self.server, &response))
                        .await.map_err(|_| "AGENT_CALLBACK_REPLY_TIMEOUT")??;
                }
                _ => return Err("AGENT_CALLBACK_INVALID_FRAME"),
            }
        }
        Err("AGENT_CALLBACK_CAPACITY")
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

    // One frame corresponds to one host-originated MCP invocation. A malformed
    // frame, a different grant, or a timeout retires the pending grant as well.
    pub(crate) async fn authorize_next(
        &mut self,
        expected_grant: &str,
        execute: impl FnOnce() -> Result<Value, &'static str>,
    ) -> Result<(), &'static str> {
        let result = timeout(DEADLINE, async {
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
                    .authorize_next(id, || Ok(json!({"executed":true})))
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
