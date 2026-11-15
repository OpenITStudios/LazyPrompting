use crate::browser_support_tabs::{control_active,BrowserCaller};
use crate::embedded_webview::control_browser;
use crate::mcp_workspace_leases::{trusted_client_identity, McpWorkspaceLeases};
use crate::native_ipc_frame::{read_frame_async, write_frame_async};
use crate::native_ipc_pipe::NativePipeListener;
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{Emitter, Manager};
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

// A v2 prepared scope is owned by one installed stdio client. The namespace
// is intentionally separate from the v1 goal lease.
fn agent_request_key(action: &str, args: &Value) -> Result<String, &'static str> {
    let id = match action {
        "prepare" => args["requestId"].as_str(),
        "status" | "stop" | "review_execution" => {
            let run_id = args["runId"].as_str().ok_or("INVALID_RUN_ID")?;
            let (id, suffix) = run_id.split_once('.').ok_or("INVALID_RUN_ID")?;
            if suffix.len() != 32 || !suffix.bytes().all(|byte| byte.is_ascii_hexdigit()) {
                return Err("INVALID_RUN_ID");
            }
            Some(id)
        }
        _ => return Err("INVALID_AGENT_V2_ACTION"),
    }.ok_or("INVALID_AGENT_V2_SCOPE")?;
    if id.len() != 36 || !id.bytes().enumerate().all(|(i, byte)| {
        if matches!(i, 8 | 13 | 18 | 23) { byte == b'-' }
        else { byte.is_ascii_hexdigit() }
    }) {
        return Err("INVALID_RUN_ID");
    }
    Ok(format!("agent:{}", id.to_ascii_lowercase()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrowserRequest {
    workspace_id: String,
    action: String,
    address: Option<String>,
    mode: Option<String>,
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
                    } else if let Some(action) = value["codeModeAction"].as_str() {
                        // Native peer identity was verified above. Scope comes only
                        // from already-owned goal/agent/workspace leases, never
                        // an interpreted JS argument or client-supplied grant.
                        let args=value["arguments"].clone();
                        let catalog=&value["nativeCatalog"];
                        let valid=value.as_object().is_some_and(|o|
                            o.len()==3 && o.contains_key("nativeCatalog")) &&
                            catalog["source"]=="NATIVE_MCP_CATALOG" &&
                            catalog["capabilities"].as_array().is_some_and(|items|
                                items.len()==22) &&
                            args.as_object().is_some_and(|o|{
                                if action=="catalog"{return o.is_empty()}
                                action=="execute" && o.len()>=1 && o.len()<=7 &&
                                o.keys().all(|key|matches!(key.as_str(),
                                    "code"|"runId"|"workspaceId"|"agentRunId"|"receipt"|
                                    "repositoryStatus"|"handoffWorkspaceId")) &&
                                args["code"].as_str().is_some_and(|code|
                                    !code.trim().is_empty() && code.len()<=4096) &&
                                (!o.contains_key("repositoryStatus") ||
                                    (o.contains_key("agentRunId") && args["repositoryStatus"]==true)) &&
                                ["runId","agentRunId"].iter().all(|key|
                                    !o.contains_key(*key) ||
                                    args[*key].as_str().is_some_and(|id|id.len()==69)) &&
                                (!o.contains_key("workspaceId") ||
                                    args["workspaceId"].as_str().is_some_and(|id|
                                        crate::embedded_webview::label_for(id).is_ok())) &&
                                (!o.contains_key("handoffWorkspaceId") ||
                                    args["handoffWorkspaceId"].as_str().is_some_and(|id|
                                        crate::embedded_webview::label_for(id).is_ok())) &&
                                (!o.contains_key("receipt") || (
                                    o.contains_key("runId") &&
                                    args["receipt"].as_object().is_some_and(|fields|
                                        fields.len()==2 &&
                                        fields.contains_key("taskId") &&
                                        fields.contains_key("turnId") &&
                                        fields["taskId"].as_str().is_some_and(|id|
                                            matches!(id,"task-1"|"task-2"|"task-3"|
                                                "task-4"|"task-5"|"task-6"|
                                                "task-7"|"task-8")) &&
                                        fields["turnId"].as_str().is_some_and(|id|
                                            !id.is_empty() && id.len()<=128 &&
                                            id.bytes().all(|c|c.is_ascii_alphanumeric()||
                                                b"_:-".contains(&c))))));
                            });
                        if !valid {Err("CODE_MODE_INVALID_ARGUMENTS".into())}
                        else {
                            async {
                                let (goal,goal_key)=if let Some(id)=args["runId"].as_str(){
                                    let key=goal_request_key("status",&json!({"runId":id}))
                                        .map_err(str::to_owned)?;
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let snapshot=crate::goal_runs::code_mode_status(&app,id).await?;
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    (Some(snapshot),Some(key))
                                }else{(None,None)};
                                let receipt=if args["receipt"].is_object(){
                                    let id=args["runId"].as_str().ok_or(
                                        "CODE_MODE_GOAL_REQUIRED".to_owned())?;
                                    let key=goal_key.as_deref().ok_or(
                                        "CODE_MODE_GOAL_REQUIRED".to_owned())?;
                                    leases.require_owned(key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let selected=crate::goal_runs::code_mode_receipt(
                                        &app,id,args["receipt"]["taskId"].as_str()
                                            .ok_or("CODE_MODE_RECEIPT_INVALID".to_owned())?,
                                        args["receipt"]["turnId"].as_str()
                                            .ok_or("CODE_MODE_RECEIPT_INVALID".to_owned())?
                                    ).await?;
                                    leases.require_owned(key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    Some(selected)
                                }else{None};
                                let (agent,agent_key)=if let Some(id)=args["agentRunId"].as_str(){
                                    let key=agent_request_key("status",&json!({"runId":id}))
                                        .map_err(str::to_owned)?;
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let app_copy=app.clone();
                                    let id_owned=id.to_owned();
                                    let status=tauri::async_runtime::spawn_blocking(move||{
                                        crate::agent_goal_authority::code_mode_status(
                                            &app_copy,&id_owned)
                                    }).await.map_err(|_|"CODE_MODE_AGENT_STATUS_UNAVAILABLE".to_owned())??;
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    (Some(status),Some(key))
                                }else{(None,None)};
                                let repository=if args["repositoryStatus"]==true{
                                    let id=args["agentRunId"].as_str().ok_or(
                                        "CODE_MODE_AGENT_SCOPE_REQUIRED".to_owned())?;
                                    let key=agent_key.as_deref().ok_or(
                                        "CODE_MODE_AGENT_SCOPE_REQUIRED".to_owned())?;
                                    leases.require_owned(key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let host=app.clone();
                                    let target=id.to_owned();
                                    let status=tauri::async_runtime::spawn_blocking(move||{
                                        crate::agent_goal_authority::code_mode_repository(
                                            &host,&target)
                                    }).await.map_err(|_|"CODE_MODE_REPOSITORY_UNAVAILABLE".to_owned())??;
                                    leases.require_owned(key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    Some(status)
                                }else{None};
                                let (browser,workspace_key)=if let Some(ws)=args["workspaceId"].as_str(){
                                    leases.require_owned(ws,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let origin=crate::browser_support_tabs::code_mode_support_origin(&app,ws)?;
                                    leases.require_owned(ws,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    (Some(origin),Some(ws.to_owned()))
                                }else{(None,None)};
                                let (handoff_workspace,handoff_status)=
                                    if let Some(ws)=args["handoffWorkspaceId"].as_str(){
                                        leases.require_owned(ws,client.unwrap())
                                            .map_err(str::to_owned)?;
                                        let status=app.state::<
                                            crate::chat_manual_handoff::PendingManualHandoffs>()
                                            .code_mode_status(ws)?;
                                        leases.require_owned(ws,client.unwrap())
                                            .map_err(str::to_owned)?;
                                        (Some(ws.to_owned()),Some(status))
                                    }else{(None,None)};
                                let origin_before=browser.clone();
                                let agent_before=agent.clone();
                                let repository_before=repository.clone();
                                let native_catalog=value["nativeCatalog"].clone();
                                let host=app.clone();
                                let caller=client.unwrap();
                                let effect_leases=leases.clone();
                                let workspace_for_host=handoff_workspace.clone();
                                let handoff_before=handoff_status.clone();
                                let workspace_for_callback=handoff_workspace.clone();
                                let action=action.to_owned();
                                let effect_possible=handoff_workspace.is_some();
                                let output=tauri::async_runtime::spawn_blocking(move||{
                                    let root=host.path().resource_dir()
                                        .map_err(|_|"GATEWAY_RESOURCE_DIR_UNAVAILABLE")?
                                        .join("gateway");
                                    let gateway=host.state::<crate::gateway_session::GatewaySession>();
                                    gateway.probe_packaged(&root).map_err(str::to_owned)?;
                                    let app_for_effect=host.clone();
                                    gateway.request_code_mode(&action,args["code"].as_str(),
                                        goal,browser,agent,receipt,repository,
                                        native_catalog,handoff_status,
                                        workspace_for_host.as_deref(),
                                        move |capability,effect_args|{
                                            if capability!="workspace_chat.prepare_handoff" {
                                                return Err("CODE_EFFECT_CAPABILITY_DENIED".into());
                                            }
                                            let ws=workspace_for_callback.as_deref()
                                                .ok_or("CODE_EFFECT_WORKSPACE_REQUIRED")?;
                                            if effect_args["workspaceId"]!=ws {
                                                return Err("CODE_EFFECT_SCOPE_MISMATCH".into());
                                            }
                                            effect_leases.require_owned(ws,caller)
                                                .map_err(str::to_owned)?;
                                            let draft=crate::chat_manual_handoff::prepare(
                                                effect_args.clone())?;
                                            effect_leases.require_owned(ws,caller)
                                                .map_err(str::to_owned)?;
                                            let pending=app_for_effect.state::<
                                                crate::chat_manual_handoff::PendingManualHandoffs>()
                                                .retain(draft)?;
                                            let _=app_for_effect.emit_to(
                                                tauri::EventTarget::webview("main"),
                                                "workspace-chat-draft",&pending);
                                            Ok(pending)
                                        })
                                }).await.map_err(|_|"CODE_MODE_TASK_FAILED".to_owned())?;
                                let output=match output {
                                    Ok(output)=>output,
                                    Err(error) if effect_possible=>
                                        return Err("CODE_MODE_EFFECT_RECONCILE_REQUIRED".into()),
                                    Err(error)=>return Err(error),
                                };
                                let post_effect=output["mode"]=="HOST_MANUAL_DRAFT";
                                let verified:Result<Value,String>=async {
                                if let Some(key)=goal_key {
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                }
                                if let (Some(id),Some(before))=(
                                    value["arguments"]["agentRunId"].as_str(),repository_before){
                                    let host=app.clone();
                                    let target=id.to_owned();
                                    let current=tauri::async_runtime::spawn_blocking(move||{
                                        crate::agent_goal_authority::code_mode_repository(
                                            &host,&target)
                                    }).await.map_err(|_|"CODE_MODE_REPOSITORY_UNAVAILABLE".to_owned())??;
                                    if current!=before {
                                        return Err("CODE_MODE_REPOSITORY_CHANGED".into());
                                    }
                                }
                                if let Some(key)=agent_key {
                                    leases.require_owned(&key,client.unwrap())
                                        .map_err(str::to_owned)?;
                                }
                                if let Some(ws)=handoff_workspace {
                                    if leases.require_owned(&ws,client.unwrap()).is_err() {
                                        // The inbox may already contain a draft; never
                                        // allow an unacknowledged retry.
                                        return Err("CODE_MODE_EFFECT_RECONCILE_REQUIRED".into());
                                    }
                                    let latest=app.state::<
                                        crate::chat_manual_handoff::PendingManualHandoffs>()
                                        .code_mode_status(&ws)?;
                                    let before=handoff_before.as_ref()
                                        .ok_or("CODE_MODE_HANDOFF_BINDING_INVALID")?;
                                    crate::chat_manual_handoff::code_mode_confirm_result(
                                        before,&latest,&output).map_err(str::to_owned)?;
                                }
                                if let (Some(ws),Some(origin))=(workspace_key,origin_before){
                                    leases.require_owned(&ws,client.unwrap())
                                        .map_err(str::to_owned)?;
                                    let latest=crate::browser_support_tabs::code_mode_support_origin(&app,&ws)?;
                                    if latest!=origin{return Err("CODE_MODE_WORKSPACE_CHANGED".into());}
                                }
                                if let (Some(id),Some(before))=(
                                    value["arguments"]["agentRunId"].as_str(),agent_before){
                                    let host=app.clone();
                                    let id=id.to_owned();
                                    let latest=tauri::async_runtime::spawn_blocking(move||{
                                        crate::agent_goal_authority::code_mode_status(&host,&id)
                                    }).await.map_err(|_|"CODE_MODE_AGENT_STATUS_UNAVAILABLE".to_owned())??;
                                    if latest!=before {
                                        return Err("CODE_MODE_AGENT_CHANGED".into());
                                    }
                                }
                                    Ok(output)
                                }.await;
                                match verified {
                                    Err(_) if post_effect=>
                                        Err("CODE_MODE_EFFECT_RECONCILE_REQUIRED".into()),
                                    other=>other,
                                }
                            }.await
                        }
                    } else if let Some(action) = value["agentRunAction"].as_str() {
                        // A prepared agent goal cannot claim a workspace that
                        // another live client currently owns for browser control.
                        let workspace_admitted = if action == "prepare" {
                            value["arguments"]["workspaceId"].as_str()
                                .ok_or("INVALID_WORKSPACE".to_owned())
                                .and_then(|workspace| {
                                    crate::embedded_webview::label_for(workspace)?;
                                    leases.authorize(workspace, client.unwrap(), false)
                                        .map_err(|error| error.to_owned())
                                })
                        } else {
                            Ok(())
                        };
                        match workspace_admitted {
                            Ok(()) => match agent_request_key(action, &value["arguments"]) {
                                Ok(key) => match leases.authorize(&key, client.unwrap(), false) {
                                    Ok(()) => crate::agent_goal_authority::request(
                                        &app, action, value["arguments"].clone()
                                    ).await,
                                    Err(error) => Err(error.to_owned()),
                                },
                                Err(error) => Err(error.to_owned()),
                            },
                            Err(error) => Err(error),
                        }
                    } else if let Some(action) = value["manualChatAction"].as_str() {
                        if action != "prepare_handoff" {
                            Err("INVALID_MANUAL_CHAT_ACTION".to_owned())
                        } else {
                            value["arguments"]["workspaceId"]
                                .as_str()
                                .ok_or("INVALID_WORKSPACE".to_owned())
                                .and_then(|workspace| {
                                    crate::embedded_webview::label_for(workspace)?;
                                    // Validate all caller data before reserving
                                    // a workspace lease. Invalid requests must
                                    // have no lease side effect.
                                    let draft = crate::chat_manual_handoff::prepare(
                                        value["arguments"].clone(),
                                    )?;
                                    leases.authorize(workspace, client.unwrap(), false)
                                        .map_err(str::to_owned)?;
                                    // The bounded native inbox is authoritative until
                                    // operator dismissal; frontend events are hints only.
                                    // Client content remains unverified and is not a goal.
                                    let pending = app.state::<crate::chat_manual_handoff::PendingManualHandoffs>()
                                        .retain(draft)?;
                                    let _ = app.emit_to(
                                        tauri::EventTarget::webview("main"),
                                        "workspace-chat-draft",
                                        &pending,
                                    );
                                    Ok(pending)
                                })
                        }
                    } else if let Some(action) = value["fixtureAction"].as_str() {
                        crate::chat_fixture_native::request(&app, action, value["arguments"].clone())
                            .await
                    } else {
                        async {
                            let request=serde_json::from_value::<BrowserRequest>(value)
                                .map_err(|_|"INVALID_BROWSER_REQUEST".to_owned())?;
                            crate::embedded_webview::label_for(&request.workspace_id)?;
                            if !matches!(request.action.as_str(),
                                "open"|"navigate"|"location"|"back"|"forward"|"reload"|"release"|"observe")
                            {return Err("INVALID_BROWSER_ACTION".into())}
                            if request.action=="observe" {
                                if request.address.is_some() ||
                                   !matches!(request.mode.as_deref().unwrap_or("compact"),"compact"|"delta"){
                                    return Err("OBSERVATION_INVALID_ARGUMENTS".into())
                                }
                            } else if request.mode.is_some() ||
                               (request.action=="release"&&request.address.is_some()){
                                return Err("INVALID_BROWSER_REQUEST".into())
                            }
                            // Denied observations cannot reserve someone else's
                            // workspace lease; then apply the existing trusted client gate.
                            if request.action=="observe"{
                                crate::browser_observation::preflight(&app,&request.workspace_id)?;
                            }
                            // Existing trusted stdio caller and workspace lease own
                            // access for CLI/MCP; one-shot UI approval is additional.
                            leases.authorize(&request.workspace_id,client.unwrap(),
                                request.action=="release").map_err(str::to_owned)?;
                            if request.action=="release" {
                                return Ok(json!({"workspaceId":request.workspace_id,"released":true}));
                            }
                            if request.action=="observe" {
                                return crate::browser_observation::observe(
                                    &app,&request.workspace_id,
                                    request.mode.as_deref().unwrap_or("compact"),"mcp").await;
                            }
                            if request.action=="open" {
                                control_browser(&app,&request.workspace_id,
                                    "open",request.address.as_deref())
                            }else{
                                control_active(&app,&request.workspace_id,
                                    &request.action,request.address.as_deref(),
                                    BrowserCaller::InstalledMcp)
                            }
                        }.await
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
