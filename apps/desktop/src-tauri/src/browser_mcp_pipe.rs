use crate::embedded_webview::control_browser;
use crate::mcp_workspace_leases::{trusted_client_identity, McpWorkspaceLeases};
use crate::native_ipc_frame::{read_frame_async, write_frame_async};
use crate::native_ipc_pipe::NativePipeListener;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io,
    path::Path,
    time::Duration,
};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;
use std::sync::Arc;
use tokio::net::windows::named_pipe::ClientOptions;
use tokio::time::timeout;

const DEADLINE: Duration = Duration::from_secs(5);
// IOCP may retain a disconnected handle briefly after its Rust owner is dropped.
const PIPE_INSTANCES: usize = 32;
// Leave headroom for a listening instance and bounded liveness requests.
const MAX_ACTIVE_MCP_CALLS: usize = 24;

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

// A goal's client lease binds to its durable request UUID. The native goal
// scope/approval and STOP files remain canonical; the lease grants no work.
fn goal_request_key(action: &str, args: &Value) -> Result<String, &'static str> {
    let id = match action {
        "start" => args["requestId"].as_str(),
        "status" | "report" | "control" | "turn_receipt" => {
            let run_id = args["runId"].as_str().ok_or("INVALID_RUN_ID")?;
            let (id, suffix) = run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
            if suffix.len() != 32 || !suffix.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return Err("INVALID_RUN_ID");
            }
            Some(id)
        }
        _ => None,
    }.ok_or("INVALID_GOAL_ACTION")?;
    if id.len() != 36 || !id.bytes().enumerate().all(|(i, byte)| {
        if matches!(i, 8 | 13 | 18 | 23) {
            byte == b'-'
        } else {
            byte.is_ascii_hexdigit()
        }
    }) {
        return Err("INVALID_RUN_ID");
    }
    Ok(format!("goal:{id}").to_ascii_lowercase())
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
    let permits = Arc::new(Semaphore::new(MAX_ACTIVE_MCP_CALLS));
    let leases = Arc::new(McpWorkspaceLeases::default());
    tauri::async_runtime::spawn(async move {
        loop {
            // Backpressure is shared by every installed MCP facade connected
            // to this desktop host; one slow client must not block the others.
            let permit = match permits.clone().acquire_owned().await {
                Ok(permit) => permit,
                Err(_) => break,
            };
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
            let app = app.clone();
            let executable = executable.clone();
            let leases = leases.clone();
            tauri::async_runtime::spawn(async move {
                let _permit = permit;
                let _ = timeout(DEADLINE, async {
                let value = read_frame_async(&mut connection).await?;
                // A liveness probe from the facade: answer immediately and keep
                // the accept loop free.
                if value["hostPing"].as_bool() == Some(true) {
                    let _ = write_frame_async(&mut connection, &json!({"result":{"host":"ready"}}))
                        .await;
                    let _ = connection.read_u8().await;
                    return Ok::<(), &'static str>(());
                }
                let client = trusted_client_identity(&connection, &executable);
                let result = if client.is_none() {
                    Err("BROWSER_MCP_CLIENT_NOT_TRUSTED".to_owned())
                } else if let Some(action) = value["goalAction"].as_str() {
                    match goal_request_key(action, &value["arguments"]) {
                        Ok(key) => match leases.authorize(&key, client.unwrap(), false) {
                            Ok(()) => crate::goal_runs::request(&app, action, value["arguments"].clone()).await,
                            Err(error) => Err(error.to_owned()),
                        },
                        Err(error) => Err(error.to_owned()),
                    }
                } else if let Some(action) = value["fixtureAction"].as_str() {
                    crate::chat_fixture_native::request(&app, action, value["arguments"].clone())
                        .await
                } else {
                    serde_json::from_value::<BrowserRequest>(value)
                        .map_err(|_| "INVALID_BROWSER_REQUEST".to_owned())
                        .and_then(|request| {
                            crate::embedded_webview::label_for(&request.workspace_id)?;
                            if !matches!(request.action.as_str(),
                                "open" | "navigate" | "location" | "back" | "forward" | "reload" | "release")
                                || (request.action == "release" && request.address.is_some())
                            {
                                return Err("INVALID_BROWSER_ACTION".into());
                            }
                            // A different installed MCP client cannot hijack a live
                            // client's browser tab. Dead PID+creation leases are reclaimable.
                            leases.authorize(&request.workspace_id, client.unwrap(),
                                request.action == "release").map_err(str::to_owned)?;
                            if request.action == "release" {
                                return Ok(json!({"workspaceId":request.workspace_id,"released":true}));
                            }
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
                }).await;
            });
        }
    });
    Ok(())
}

pub(crate) fn request(value: Value) -> Result<Value, String> {
    let name = pipe_name().map_err(|_| "WINDOWS_SESSION_UNAVAILABLE")?;
    // Handshake and tool discovery must not wait for the desktop to start.
    // Only an actual privileged tool invocation triggers host startup.
    if !ensure_host_running() {
        return Err("LAZYPROMPTING_APP_NOT_OPEN".into());
    }
    tauri::async_runtime::block_on(request_at(&name, value))
}

// A named Windows mutex coordinates startup across *different* MCP client
// processes. A process-local mutex would not prevent duplicate desktop hosts.
#[cfg(windows)]
struct HostStartGuard {
    handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl Drop for HostStartGuard {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::ReleaseMutex;
        unsafe {
            ReleaseMutex(self.handle);
            CloseHandle(self.handle);
        }
    }
}

#[cfg(windows)]
fn host_start_lock(name: &str) -> Option<HostStartGuard> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{CreateMutexW, WaitForSingleObject};
    let pipe_suffix = name.rsplit('\\').next()?;
    let mutex_name = format!(r"Local\LazyPrompting-McpStart-{pipe_suffix}");
    let wide: Vec<u16> = mutex_name.encode_utf16().chain(std::iter::once(0)).collect();
    let handle = unsafe { CreateMutexW(std::ptr::null(), 0, wide.as_ptr()) };
    if handle.is_null() { return None; }
    let wait = unsafe { WaitForSingleObject(handle, 40_000) };
    // WAIT_OBJECT_0 or WAIT_ABANDONED: both confer mutex ownership.
    if matches!(wait, 0 | 0x80) {
        Some(HostStartGuard { handle })
    } else {
        unsafe { CloseHandle(handle); }
        None
    }
}

// An MCP client starts this facade on demand, exactly like any other stdio
// server. If the desktop window is not running, start it detached so the
// client does not need a manual first step. The host still owns consent;
// starting it grants nothing.
pub(crate) fn ensure_host_running() -> bool {
    let Ok(name) = pipe_name() else {
        return false;
    };
    if host_present(&name) {
        return true;
    }
    #[cfg(windows)]
    {
        let Some(_start_guard) = host_start_lock(&name) else {
            return false;
        };
        // Another client may have launched the host while we awaited the lock.
        if host_present(&name) {
            return true;
        }
        let Ok(executable) = std::env::current_exe() else {
            return false;
        };
        // Never auto-spawn a Rust test binary, a wrapper or an unpackaged copy.
        if !executable.file_name().and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case("lazyprompting-desktop.exe")) {
            return false;
        }
        if !spawn_detached(&executable) {
            return false;
        }
        // Poll for the pipe to appear. The check never connects, so it cannot
        // occupy the host's accept loop.
        for _ in 0..120 {
            std::thread::sleep(std::time::Duration::from_millis(250));
            if host_present(&name) {
                return true;
            }
        }
    }
    false
}

// Start the desktop window without inheriting any handle of this facade. A
// client waits for the server's stdout to close; an inherited handle would
// keep that pipe open for the whole life of the window.
#[cfg(windows)]
fn spawn_detached(executable: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        CreateProcessW, CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW, DETACHED_PROCESS,
        PROCESS_INFORMATION, STARTUPINFOW,
    };

    let path = executable
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let mut command_line: Vec<u16> = format!("\"{}\"", executable.display())
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let mut startup: STARTUPINFOW = unsafe { std::mem::zeroed() };
    startup.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    let mut process: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };
    // bInheritHandles = FALSE keeps the client's stdio pipe out of the child.
    let created = unsafe {
        CreateProcessW(
            path.as_ptr(),
            command_line.as_mut_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW,
            std::ptr::null(),
            std::ptr::null(),
            &mut startup,
            &mut process,
        )
    };
    if created == 0 {
        return false;
    }
    unsafe {
        CloseHandle(process.hThread);
        CloseHandle(process.hProcess);
    }
    true
}

// Presence check without opening a connection: a busy pipe still means the
// host is running.
fn host_present(name: &str) -> bool {
    use windows_sys::Win32::System::Pipes::WaitNamedPipeW;
    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    let result = unsafe { WaitNamedPipeW(wide.as_ptr(), 0) };
    if result != 0 {
        return true;
    }
    // ERROR_FILE_NOT_FOUND means no host; anything else means the host exists.
    std::io::Error::last_os_error().raw_os_error() != Some(2)
}

pub(crate) async fn request_at(name: &str, value: Value) -> Result<Value, String> {
    let mut pipe = connect_with_wait(name).await?;
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

// The host may still be starting when the first request arrives. Wait a
// bounded time for the pipe instead of failing the call immediately.
async fn connect_with_wait(
    name: &str,
) -> Result<tokio::net::windows::named_pipe::NamedPipeClient, String> {
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
        let attempt = ClientOptions::new()
            .security_qos_flags(windows_sys::Win32::Storage::FileSystem::SECURITY_ANONYMOUS)
            .open(name.to_owned());
        match attempt {
            Ok(pipe) => return Ok(pipe),
            Err(error) => {
                if error.raw_os_error() == Some(231) {
                    return Err("BROWSER_MCP_BUSY".into());
                }
                if std::time::Instant::now() >= deadline {
                    return Err(match error.raw_os_error() {
                        Some(231) => "BROWSER_MCP_BUSY".into(),
                        _ => "LAZYPROMPTING_APP_NOT_OPEN".into(),
                    });
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        }
    }
}

#[cfg(test)]
mod multi_client_tests {
    use super::*;
    #[test]
    fn native_goal_scope_keys_are_stable_and_bounded() {
        let request = "01234567-89ab-cdef-0123-456789abcdef";
        let run = format!("{request}.0123456789abcdef0123456789abcdef");
        let start = goal_request_key("start", &json!({"requestId":request})).unwrap();
        assert_eq!(start, goal_request_key("status", &json!({"runId":run})).unwrap());
        assert!(goal_request_key("start", &json!({"requestId":"traversal"})).is_err());
        assert!(goal_request_key("control", &json!({"runId":format!("{request}.short")})).is_err());
    }
}
