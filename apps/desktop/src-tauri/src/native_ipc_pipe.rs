use std::io;
use std::mem::size_of;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::ptr::{addr_of_mut, null_mut};
use std::time::Duration;

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

use super::native_ipc_auth::HostChallenge;
use super::native_ipc_frame::{read_frame_async, write_frame_async};

const DEADLINE: Duration = Duration::from_secs(8);

pub(crate) struct NativePipeListener {
    server: NamedPipeServer,
}

pub(crate) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

impl NativePipeListener {
    pub(crate) fn bind(name: &str) -> io::Result<Self> {
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
            // Windows copies the descriptor while creating this sole instance.
            ServerOptions::new()
                .first_pipe_instance(true)
                .max_instances(1)
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
        &mut self,
        child_pid: u32,
        session: [u8; 16],
        secret: [u8; 32],
    ) -> Result<(), &'static str> {
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
        .map_err(|_| "IPC_HANDSHAKE_TIMEOUT")?
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
            let mut pipe = NativePipeListener::bind(&name).unwrap();
            assert!(NativePipeListener::bind(&name).is_err());
            let _client = ClientOptions::new().open(&name).unwrap();
            let result = pipe
                .authenticate(std::process::id() ^ 1, nonce, [0; 32])
                .await;
            assert_eq!(result, Err("IPC_CLIENT_PID_MISMATCH"));
        });
    }

    #[test]
    fn matching_pid_with_forged_proof_is_denied() {
        tauri::async_runtime::block_on(async {
            let mut nonce = [0; 16];
            getrandom::getrandom(&mut nonce).unwrap();
            let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&nonce));
            let mut pipe = NativePipeListener::bind(&name).unwrap();
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
            assert_eq!(result, Err("IPC_CHILD_PROOF_INVALID"));
            fake.await.unwrap();
        });
    }
}
