use crate::embedded_webview::control_browser;
use crate::native_ipc_frame::{read_frame_async, write_frame_async};
use crate::native_ipc_pipe::NativePipeListener;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io,
    os::windows::{
        ffi::OsStringExt,
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
    },
    path::Path,
    time::Duration,
};
use tokio::io::AsyncReadExt;
use tokio::net::windows::named_pipe::ClientOptions;
use tokio::time::timeout;

const DEADLINE: Duration = Duration::from_secs(5);
// IOCP may retain a disconnected handle briefly after its Rust owner is dropped.
const PIPE_INSTANCES: usize = 32;

fn client_is_installed_mcp(
    pipe: &tokio::net::windows::named_pipe::NamedPipeServer,
    executable: &Path,
) -> bool {
    use windows_sys::Win32::System::{
        Pipes::GetNamedPipeClientProcessId,
        Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION},
    };
    let mut pid = 0;
    let mut buffer = vec![0u16; 32768];
    let mut length = buffer.len() as u32;
    unsafe {
        if GetNamedPipeClientProcessId(pipe.as_raw_handle(), &mut pid) == 0 || pid == 0 {
            return false;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return false;
        }
        let process = OwnedHandle::from_raw_handle(process);
        if QueryFullProcessImageNameW(process.as_raw_handle(), 0, buffer.as_mut_ptr(), &mut length)
            == 0
        {
            return false;
        }
    }
    let path = std::ffi::OsString::from_wide(&buffer[..length as usize]);
    dunce::canonicalize(path).is_ok_and(|path| path == executable)
}

fn pipe_name() -> io::Result<String> {
    let mut session = 0;
    if unsafe {
        windows_sys::Win32::System::RemoteDesktop::ProcessIdToSessionId(
            std::process::id(),
            &mut session,
        )
    } == 0
    {
        return Err(io::Error::last_os_error());
    }
    Ok(format!(
        r"\\.\pipe\lazyprompting-{:032x}",
        u128::MAX - u128::from(session)
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserRequest {
    workspace_id: String,
    action: String,
    address: Option<String>,
}

pub(crate) fn start(app: tauri::AppHandle) -> io::Result<()> {
    start_at(app, pipe_name()?)
}

pub(crate) fn start_at(app: tauri::AppHandle, name: String) -> io::Result<()> {
    let executable = dunce::canonicalize(std::env::current_exe()?)?;
    let mut listener = tauri::async_runtime::block_on(async {
        NativePipeListener::bind_with_instances(&name, true, PIPE_INSTANCES)
    })?;
    tauri::async_runtime::spawn(async move {
        loop {
            if listener.server.connect().await.is_err() {
                break;
            }
            // Keep the connected instance occupied until drop. Reusing a disconnected
            // handle races with the next client opening the same instance.
            let next = match NativePipeListener::bind_with_instances(&name, false, PIPE_INSTANCES) {
                Ok(next) => next,
                Err(error) => {
                    eprintln!("Browser MCP pipe could not listen: {error}");
                    break;
                }
            };
            let mut connection = std::mem::replace(&mut listener, next).server;
            let _ = timeout(DEADLINE, async {
                let value = read_frame_async(&mut connection).await?;
                let result = if !client_is_installed_mcp(&connection, &executable) {
                    Err("BROWSER_MCP_CLIENT_NOT_TRUSTED".to_owned())
                } else if let Some(action) = value["goalAction"].as_str() {
                    crate::goal_runs::request(&app, action, value["arguments"].clone()).await
                } else if let Some(action) = value["fixtureAction"].as_str() {
                    crate::chat_fixture_native::request(&app, action, value["arguments"].clone()).await
                } else {
                    serde_json::from_value::<BrowserRequest>(value)
                        .map_err(|_| "INVALID_BROWSER_REQUEST".to_owned())
                        .and_then(|request| {
                            control_browser(
                                &app,
                                &request.workspace_id,
                                &request.action,
                                request.address.as_deref(),
                            )
                        })
                };
                let reply = match result {
                    Ok(result) => json!({"result":result}),
                    Err(error) => json!({"error":error}),
                };
                write_frame_async(&mut connection, &reply).await?;
                // Keep the buffers alive until the client finishes reading the response.
                let _ = connection.read_u8().await;
                Ok::<(), &'static str>(())
            })
            .await;
        }
    });
    Ok(())
}

pub(crate) fn request(value: Value) -> Result<Value, String> {
    let name = pipe_name().map_err(|_| "WINDOWS_SESSION_UNAVAILABLE")?;
    tauri::async_runtime::block_on(request_at(&name, value))
}

pub(crate) async fn request_at(name: &str, value: Value) -> Result<Value, String> {
    let mut pipe = ClientOptions::new()
        .security_qos_flags(windows_sys::Win32::Storage::FileSystem::SECURITY_ANONYMOUS)
        .open(name)
        .map_err(|error| match error.raw_os_error() {
            Some(231) => "BROWSER_MCP_BUSY",
            _ => "LAZYPROMPTING_APP_NOT_OPEN",
        })?;
    let reply = timeout(DEADLINE, async {
        write_frame_async(&mut pipe, &value).await?;
        read_frame_async(&mut pipe).await
    })
    .await
    .map_err(|_| "BROWSER_MCP_TIMEOUT")??;
    if let Some(error) = reply["error"].as_str() {
        return Err(error.to_owned());
    }
    reply
        .get("result")
        .cloned()
        .ok_or_else(|| "INVALID_BROWSER_REPLY".into())
}
