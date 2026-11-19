// Native-owned MCP gateway session. Not a renderer command and not browser authorization.
// All blocking methods must run off the Tauri UI thread.
use super::gateway_child::GatewayChild;
use super::gateway_reader::GatewayReader;
use super::gateway_stdio::{write_message, RequestTracker};
#[cfg(windows)]
use crate::gateway_result::take_object_result;
use serde_json::{json, Value};
use std::path::Path;
use std::process::ChildStdin;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Default)]
pub(crate) struct GatewaySession {
    child: GatewayChild,
    input: Mutex<Option<ChildStdin>>,
    reader: Mutex<Option<GatewayReader>>,
    tracker: Mutex<RequestTracker>,
    operation: Mutex<()>,
    probe: Mutex<()>,
    #[cfg(windows)]
    pipe: Mutex<Option<super::native_ipc_pipe::AuthenticatedPipe>>,
}

impl GatewaySession {
    pub(crate) fn probe_packaged(&self, root: &Path) -> Result<(), &'static str> {
        let _guard = self.probe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let deadline = Duration::from_secs(5);
        let result = (|| {
            if self.child.pid()?.is_none() {
                super::gateway_integrity::verify(root)?;
                self.start(&root.join("node.exe"), &root.join("mcp-gateway.mjs"))?;
                let initialized = self.request(
                    "initialize",
                    json!({"protocolVersion":"2025-03-26","capabilities":{},
                        "clientInfo":{"name":"lazyprompting-desktop","version":env!("CARGO_PKG_VERSION")}}),
                    deadline,
                )?;
                if initialized["result"]["protocolVersion"] != "2025-03-26"
                    || initialized["result"]["serverInfo"]["name"] != "lazyprompting-gateway"
                {
                    return Err("MCP_HANDSHAKE_FAILED");
                }
                let input = self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
                write_message(
                    &mut input.as_ref().ok_or("MCP_WRITER_NOT_READY")?,
                    &json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
                )?;
            }
            let reply = self.request("tools/list", json!({}), deadline)?;
            let tools = reply["result"]["tools"]
                .as_array()
                .ok_or("MCP_TOOL_LIST_FAILED")?;
            if !tools.iter().any(|tool| tool["name"] == "invoke_capability") {
                return Err("MCP_TOOL_LIST_FAILED");
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = self.stop();
        }
        result
    }

    // Trusted host caller only: path provenance and packaging must be checked before use.
    pub(crate) fn start(&self, node: &Path, script: &Path) -> Result<u32, &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_some() {
            return Err("GATEWAY_ALREADY_RUNNING");
        }
        // Reap a prior exited session and disconnect its reader before reuse.
        self.stop_inner()?;
        let pid = self.child.spawn(node, script)?;
        let setup = (|| {
            let (mut input, output) = self.child.take_stdio()?;
            #[cfg(windows)]
            {
                use super::native_ipc_frame::write_frame;
                use super::native_ipc_pipe::{hex, NativePipeListener};
                let mut session = [0; 16];
                let mut secret = [0; 32];
                getrandom::getrandom(&mut session).map_err(|_| "IPC_ENTROPY_UNAVAILABLE")?;
                getrandom::getrandom(&mut secret).map_err(|_| "IPC_ENTROPY_UNAVAILABLE")?;
                let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&session));
                let pipe = tauri::async_runtime::block_on(async {
                    let pipe =
                        NativePipeListener::bind(&name).map_err(|_| "IPC_PIPE_BIND_FAILED")?;
                    write_frame(
                        &mut input,
                        &json!({"type":"bootstrap","pipe":name,
                        "session":hex(&session),"secret":hex(&secret)}),
                    )?;
                    pipe.authenticate(pid, session, secret).await
                });
                secret.fill(0);
                *self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(pipe?);
            }
            let reader = GatewayReader::start(output)?;
            *self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(input);
            *self
                .reader
                .lock()
                .map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(reader);
            Ok::<(), &'static str>(())
        })();
        if let Err(err) = setup {
            let _ = self.stop_inner();
            return Err(err);
        }
        Ok(pid)
    }

    // Strict single-flight request/response. Never use for unauthorized browser operations.
    pub(crate) fn request(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<Value, &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if !matches!(method, "initialize" | "ping" | "tools/list") {
            return Err("MCP_METHOD_NOT_ADMITTED");
        }
        self.request_inner(method, params, timeout, || Ok(()))
    }

    #[cfg(windows)]
    pub(crate) fn request_codex(&self, params: Value) -> Result<Value, String> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/codex",
            params,
            Duration::from_secs(25),
            || Ok(()),
        );
        let reply = match reply {
            Ok(reply) => reply,
            Err(error) => {
                let _ = self.stop_inner();
                return Err(error.into());
            }
        };
        take_object_result(reply, "CODEX_RESULT_UNAVAILABLE")
    }

    // Private native Code Mode route: only read/pure capabilities inside the
    // confined gateway interpreter. Never use arbitrary MCP tool arguments
    // as a native grant or shortcut to a privileged host callback.
    #[cfg(windows)]
    pub(crate) fn request_code_mode(
        &self,
        action: &str,
        code: Option<&str>,
        goal: Option<Value>,
        browser: Option<Value>,
        agent: Option<Value>,
        receipt: Option<Value>,
        repository: Option<Value>,
        effect_policy: Option<Value>,
        native_catalog: Value,
        handoff_status: Option<Value>,
        handoff_workspace: Option<&str>,
        mut invoke_native_effect: impl FnMut(&str, &Value) -> Result<Value, String>,
    ) -> Result<Value, String> {
        if !matches!(action, "catalog" | "execute")
            || (action == "catalog"
                && (code.is_some()
                    || goal.is_some()
                    || browser.is_some()
                    || agent.is_some()
                    || receipt.is_some()
                    || repository.is_some()
                    || handoff_workspace.is_some()
                    || handoff_status.is_some()
                    || effect_policy.is_some()))
            || (action == "execute"
                && !code.is_some_and(|text| !text.trim().is_empty() && text.len() <= 4096))
        {
            return Err("CODE_MODE_INVALID_ARGUMENTS".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let mut params = match code {
            Some(value) => json!({"action":action,"code":value}),
            None => json!({"action":action}),
        };
        if let Some(status) = goal {
            params["goal"] = status;
        }
        if let Some(origin) = browser {
            params["browser"] = origin;
        }
        if let Some(status) = agent {
            params["agent"] = status;
        }
        if let Some(correlated) = receipt {
            params["receipt"] = correlated;
        }
        if let Some(status) = repository {
            params["repository"] = status;
        }
        if let Some(policy) = effect_policy {
            params["effectPolicy"] = policy;
        }
        if native_catalog["source"] != "NATIVE_MCP_CATALOG"
            || native_catalog["capabilities"]
                .as_array()
                .is_none_or(|a| a.len() != 22)
        {
            return Err("CODE_MODE_NATIVE_CATALOG_INVALID".into());
        }
        params["nativeCatalog"] = native_catalog;
        if let Some(status) = handoff_status {
            if status["source"] != "NATIVE_MANUAL_DRAFT_INBOX"
                || status["workspaceId"].as_str() != handoff_workspace
            {
                return Err("CODE_MODE_HANDOFF_BINDING_INVALID".into());
            }
            params["handoffStatus"] = status;
        }
        // Even a program that never requests an effect sends one DONE frame.
        // The authenticated pipe and one-shot token cannot be model supplied.
        let reply = if action == "execute" {
            let mut nonce = [0u8; 16];
            getrandom::getrandom(&mut nonce).map_err(|_| "CODE_MODE_EFFECT_ENTROPY_FAILED")?;
            let token = super::native_ipc_pipe::hex(&nonce);
            params["effectToken"] = json!(token.as_str());
            if let Some(workspace) = handoff_workspace {
                params["handoffWorkspaceId"] = json!(workspace);
            }
            let mut guard = self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let pipe = guard.as_mut().ok_or("IPC_AUTHENTICATION_REQUIRED")?;
            self.request_inner("lazyprompting/code", params, Duration::from_secs(5), || {
                tauri::async_runtime::block_on(
                    pipe.serve_code_effect_callbacks(&token, |capability, arguments| {
                        invoke_native_effect(capability, arguments)
                    }),
                )
            })
        } else {
            self.request_inner("lazyprompting/code", params, Duration::from_secs(5), || {
                Ok(())
            })
        };
        let reply = match reply {
            Ok(value) => value,
            Err(error) => {
                let _ = self.stop_inner();
                return Err(error.into());
            }
        };
        let result = reply.get("result").ok_or("CODE_MODE_RESULT_MISSING")?;
        if result["status"] == "ERROR" {
            let reason = result["code"].as_str().unwrap_or("CODE_MODE_FAILED");
            return Err(if reason.starts_with("CODE_MODE_") && reason.len() <= 80 {
                reason.to_owned()
            } else {
                "CODE_MODE_FAILED".to_owned()
            });
        }
        if result["status"] != "OK" || !result["structuredContent"].is_object() {
            return Err("CODE_MODE_RESULT_INVALID".into());
        }
        Ok(result["structuredContent"].clone())
    }

    // Private authenticated v2 transport. No model, renderer or public MCP
    // call can pass a callback token or ask for arbitrary native operations.
    // The same gateway operation mutex also serializes Lightpanda callbacks.
    #[cfg(windows)]
    pub(crate) fn request_agent(
        &self,
        app: &tauri::AppHandle,
        mut params: Value,
    ) -> Result<Value, String> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let action = params["action"]
            .as_str()
            .ok_or("INVALID_AGENT_ACTION")?
            .to_owned();
        if !matches!(
            action.as_str(),
            "status" | "inspect" | "source" | "start" | "observe" | "cancel" | "reconcileReserved"
        ) {
            return Err("INVALID_AGENT_ACTION".into());
        }
        if action == "status" {
            if params.as_object().is_none_or(|p| p.len() != 1) {
                return Err("INVALID_AGENT_ACTION".into());
            }
        } else if params.as_object().is_none_or(|p| p.len() != 2)
            || !params["runId"].as_str().is_some_and(|id| {
                let Some((uuid, suffix)) = id.split_once('.') else {
                    return false;
                };
                uuid.len() == 36
                    && uuid.bytes().enumerate().all(|(i, byte)| {
                        if matches!(i, 8 | 13 | 18 | 23) {
                            byte == b'-'
                        } else {
                            byte.is_ascii_hexdigit()
                        }
                    })
                    && suffix.len() == 32
                    && suffix.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
        {
            return Err("INVALID_AGENT_ACTION".into());
        }
        // Bind the callback broker to exactly this native request identity.
        // A compromised gateway cannot use a status/inspect request to query
        // a different prepared goal through the authenticated pipe.
        let admitted_run = params["runId"].as_str().map(str::to_owned);
        let mut bytes = [0u8; 16];
        getrandom::getrandom(&mut bytes).map_err(|_| "AGENT_CALLBACK_ENTROPY_FAILED")?;
        let token = super::native_ipc_pipe::hex(&bytes);
        params["callbackToken"] = json!(token.as_str());
        let result = {
            let mut guard = self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let pipe = guard.as_mut().ok_or("IPC_AUTHENTICATION_REQUIRED")?;
            self.request_inner(
                "lazyprompting/agent",
                params,
                Duration::from_secs(25),
                || {
                    tauri::async_runtime::block_on(pipe.serve_agent_callbacks(
                        &token,
                        |operation, run_id| {
                            if admitted_run.as_deref() != Some(run_id) {
                                return Err("AGENT_CALLBACK_SCOPE_MISMATCH".into());
                            }
                            match operation {
                                "inspectPreparedRun" if action == "inspect" => {
                                    crate::agent_goal_authority::inspect_prepared_source(
                                        app, run_id,
                                    )
                                }
                                "readApprovedSource" if action == "source" => {
                                    crate::agent_goal_authority::read_prepared_source_binding(
                                        app, run_id,
                                    )
                                }
                                "evaluateAgentAction"
                                    if matches!(
                                        action.as_str(),
                                        "start" | "observe" | "cancel" | "reconcileReserved"
                                    ) =>
                                {
                                    crate::agent_goal_authority::evaluate_agent_action(
                                        app, run_id, &action,
                                    )
                                }
                                _ => Err("AGENT_CALLBACK_OPERATION_DENIED".into()),
                            }
                        },
                    ))
                },
            )
        };
        let reply = match result {
            Ok(reply) => reply,
            Err(error) => {
                let _ = self.stop_inner();
                return Err(error.into());
            }
        };
        take_object_result(reply, "AGENT_RESULT_UNAVAILABLE")
    }

    #[cfg(windows)]
    pub(crate) fn invoke_lightpanda(
        &self,
        backend: &mut super::lightpanda_private::PrivateLightpanda,
        capability: &str,
        workspace: &str,
        url: Option<&str>,
        approved: bool,
    ) -> Result<Value, &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_none() {
            return Err("GATEWAY_NOT_RUNNING");
        }
        let result = {
            let mut pipe = self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let pipe = pipe.as_mut().ok_or("IPC_AUTHENTICATION_REQUIRED")?;
            let grant = pipe
                .issue_grant(capability, workspace, url, approved, true)
                .ok_or("NATIVE_ADMISSION_DENIED")?;
            let mut arguments = json!({"workspaceId":workspace});
            if let Some(url) = url {
                arguments["url"] = json!(url);
            }
            // Private indexed-read grant is distinct from metadata; the
            // four public MCP tools and registered snapshot capability
            // name are unchanged. No model can mint this native grant.
            let public_capability = if capability == "lightpanda.snapshot.index" {
                arguments["view"] = json!("index");
                "lightpanda.snapshot"
            } else {
                capability
            };
            self.request_inner(
                "tools/call",
                json!({
                    "name":"invoke_capability",
                    "arguments":{"name":public_capability,"arguments":arguments},
                    "_meta":{"lazyprompting/grant":grant}
                }),
                Duration::from_secs(15),
                || {
                    tauri::async_runtime::block_on(
                        pipe.authorize_next(&grant, || backend.invoke(capability, workspace, url)),
                    )
                },
            )
        };
        if result.is_err() {
            let _ = self.stop_inner();
        }
        result
    }

    // Private native-owned PromptOutbox producer. This cannot be called
    // through the four public MCP tools or by Code Mode.
    #[cfg(windows)]
    pub(crate) fn preview_action_outbox(
        &self,
        data_dir: &Path,
        action: &str,
        payload: Value,
    ) -> Result<Value, String> {
        if !data_dir.is_absolute() || !matches!(action, "reserve" | "seal" | "verify" | "hold") {
            return Err("BROWSER_ACTION_INVALID_REQUEST".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/browserAction",
            json!({"action":action,"dataDir":data_dir.to_string_lossy(),"payload":payload}),
            Duration::from_secs(10),
            || Ok(()),
        );
        let reply = match reply {
            Ok(reply) => reply,
            Err(reason) => {
                let _ = self.stop_inner();
                return Err(reason.into());
            }
        };
        take_object_result(reply, "BROWSER_ACTION_OUTBOX_RESULT_MISSING")
    }

    // The installed native host reserves the exact operator-reviewed ChatGPT
    // UI send in the canonical app-local PromptOutbox before WebView.eval.
    // This private request never permits a send or returns chat output.
    #[cfg(windows)]
    pub(crate) fn reserve_operator_chat_send(
        &self,
        data_dir: &Path,
        workspace: &str,
        conversation_digest: &str,
        prompt_digest: &str,
    ) -> Result<Value, String> {
        let sha_ok = |value: &str| {
            value.len() == 64
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
                && value != "0".repeat(64)
        };
        if !data_dir.is_absolute()
            || !super::lightpanda_admission::workspace_allowed(workspace)
            || !sha_ok(conversation_digest)
            || !sha_ok(prompt_digest)
        {
            return Err("OPERATOR_CHAT_RESERVATION_INVALID".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/operatorChatSend",
            json!({
                "dataDir":data_dir.to_string_lossy(),
                "workspaceId":workspace,
                "conversationDigest":conversation_digest,
                "promptDigest":prompt_digest
            }),
            Duration::from_secs(10),
            || Ok(()),
        );
        let reply = match reply {
            Ok(value) => value,
            Err(reason) => {
                let _ = self.stop_inner();
                return Err(reason.into());
            }
        };
        take_object_result(reply, "OPERATOR_CHAT_RESERVATION_UNAVAILABLE")
    }

    // The same host-owned outbox admits an operator's *manual review*.
    // This releases a pending UI attempt without claiming authenticated
    // ChatGPT delivery. Only native main-window continuation can call it.
    #[cfg(windows)]
    pub(crate) fn review_operator_chat_send(
        &self,
        data_dir: &Path,
        workspace: &str,
        conversation_digest: &str,
        prompt_digest: &str,
    ) -> Result<Value, String> {
        let sha_ok = |value: &str| {
            value.len() == 64
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
                && value != "0".repeat(64)
        };
        if !data_dir.is_absolute()
            || !super::lightpanda_admission::workspace_allowed(workspace)
            || !sha_ok(conversation_digest)
            || !sha_ok(prompt_digest)
        {
            return Err("OPERATOR_CHAT_REVIEW_INVALID".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/operatorChatReview",
            json!({"dataDir":data_dir.to_string_lossy(),
                "workspaceId":workspace,
                "conversationDigest":conversation_digest,
                "promptDigest":prompt_digest}),
            Duration::from_secs(10),
            || Ok(()),
        );
        let reply = match reply {
            Ok(reply) => reply,
            Err(code) => {
                let _ = self.stop_inner();
                return Err(code.into());
            }
        };
        take_object_result(reply, "OPERATOR_CHAT_REVIEW_UNAVAILABLE")
    }

    // Operator-only read of the canonical outbox's unresolved chat attempt.
    // The digest values stay inside the trusted native process and are
    // never returned by a renderer/MCP action.
    #[cfg(windows)]
    pub(crate) fn pending_operator_chat_send(
        &self,
        data_dir: &Path,
        workspace: &str,
    ) -> Result<Value, String> {
        if !data_dir.is_absolute() || !super::lightpanda_admission::workspace_allowed(workspace) {
            return Err("OPERATOR_CHAT_PENDING_INVALID".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/operatorChatPending",
            json!({"dataDir":data_dir.to_string_lossy(),
                "workspaceId":workspace}),
            Duration::from_secs(10),
            || Ok(()),
        );
        let reply = match reply {
            Ok(reply) => reply,
            Err(code) => {
                let _ = self.stop_inner();
                return Err(code.into());
            }
        };
        let result = take_object_result(reply, "OPERATOR_CHAT_PENDING_UNAVAILABLE")?;
        if result["workspaceId"] != workspace
            || result["deliveryVerified"] != false
            || result["resultVerified"] != false
            || result["nextPromptAllowed"] != false
            || result["ambiguous"].as_bool().is_none()
            || !result["active"].as_u64().is_some_and(|n| n <= 1000)
        {
            return Err("OPERATOR_CHAT_PENDING_INVALID".into());
        }
        Ok(result)
    }

    // Lock inspection/recovery stays on the existing authenticated
    // gateway RPC channel. A caller cannot pass a different state path.
    // The UI never receives the random owner token.
    #[cfg(windows)]
    pub(crate) fn operator_chat_lock(
        &self,
        data_dir: &Path,
        action: &str,
        owner_token: Option<&str>,
    ) -> Result<Value, String> {
        if !data_dir.is_absolute()
            || !matches!(
                (action, owner_token),
                ("inspect", None) | ("recover", Some(_))
            )
        {
            return Err("OPERATOR_CHAT_LOCK_INVALID".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/operatorChatLock",
            json!({"action":action,"dataDir":data_dir.to_string_lossy(),
                "ownerToken":owner_token}),
            Duration::from_secs(10),
            || Ok(()),
        );
        let reply = match reply {
            Ok(reply) => reply,
            Err(code) => {
                let _ = self.stop_inner();
                return Err(code.into());
            }
        };
        take_object_result(reply, "OPERATOR_CHAT_LOCK_UNAVAILABLE")
    }

    // Private, authenticated Node gateway request for a bounded OpenAI
    // Platform API goal. Does not grant consumer ChatGPT browser actions.
    // The caller must be a main-window, OS-approved Tauri command.
    #[cfg(windows)]
    pub(crate) fn request_api_goal(&self, params: Value) -> Result<Value, String> {
        if params["workspaceId"] != "api-workspace-01"
            || !matches!(params["action"].as_str(), Some("start" | "status" | "stop"))
            || !params["dataDir"].as_str().is_some_and(|p| {
                let path = Path::new(p);
                path.is_absolute() && p.len() <= 4096
            })
        {
            return Err("API_GOAL_NATIVE_SCOPE_INVALID".into());
        }
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self
            .pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .is_none()
        {
            return Err("IPC_AUTHENTICATION_REQUIRED".into());
        }
        let reply = self.request_inner(
            "lazyprompting/apiGoal",
            params,
            Duration::from_secs(15),
            || Ok(()),
        );
        let reply = match reply {
            Ok(result) => result,
            Err(reason) => {
                let _ = self.stop_inner();
                return Err(reason.into());
            }
        };
        take_object_result(reply, "API_GOAL_NATIVE_RESULT_UNAVAILABLE")
    }

    // The OS host selects one canonical app-data file, verifies the exact
    // sealed row and permits the *same existing native grant store* to
    // consume one target grant before a single offline effect.
    #[cfg(windows)]
    pub(crate) fn run_offline_preview_target<T>(
        &self,
        root: &Path,
        file: &Path,
        action_id: &str,
        scope: super::lightpanda_grants::PreviewTargetScope,
        execute: impl FnOnce() -> Result<T, &'static str>,
    ) -> Result<T, String> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid().map_err(String::from)?.is_none() {
            return Err("GATEWAY_NOT_RUNNING".into());
        }
        let mut pipe = self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let host = pipe.as_mut().ok_or("IPC_AUTHENTICATION_REQUIRED")?;
        super::lightpanda_grants::verify_preview_dispatch_reservation_at(
            root, file, &scope, action_id,
        )
        .map_err(String::from)?;
        host.run_native_preview_target(scope, execute)
            .map_err(String::from)
    }

    fn request_inner(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
        after_write: impl FnOnce() -> Result<(), &'static str>,
    ) -> Result<Value, &'static str> {
        if self.child.pid()?.is_none() {
            return Err("GATEWAY_NOT_RUNNING");
        }
        let mut tracker = self
            .tracker
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let id = tracker.begin_with_timeout(timeout)?;
        let result = (|| {
            let deadline = Instant::now()
                .checked_add(timeout)
                .ok_or("MCP_INVALID_TIMEOUT")?;
            let input_guard = self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let mut input = input_guard.as_ref().ok_or("MCP_WRITER_NOT_READY")?;
            write_message(
                &mut input,
                &json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}),
            )?;
            drop(input_guard);
            after_write()?;
            let reader_guard = self
                .reader
                .lock()
                .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let reader = reader_guard.as_ref().ok_or("MCP_READER_NOT_READY")?;
            loop {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    return Err("MCP_REQUEST_TIMEOUT");
                }
                let message = reader.recv(remaining)?;
                if tracker.accept(&message)? {
                    return Ok(message);
                }
            }
        })();
        tracker.cancel();
        result
    }

    pub(crate) fn stop(&self) -> Result<(), &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        self.stop_inner()
    }

    fn stop_inner(&self) -> Result<(), &'static str> {
        #[cfg(windows)]
        self.pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take();
        self.input
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take();
        // The child must be stopped before joining the potentially blocking stdout reader.
        self.child.stop()?;
        if let Some(reader) = self
            .reader
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take()
        {
            reader.join_after_child_stop()?;
        }
        self.tracker
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .cancel();
        Ok(())
    }
}
impl Drop for GatewaySession {
    fn drop(&mut self) {
        let _ = self.stop_inner();
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires staged Windows resources"]
    fn packaged_gateway_initializes_and_stops() {
        let root = std::env::var_os("LAZY_GATEWAY_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway"));
        let root = root.canonicalize().unwrap();
        let gateway = GatewaySession::default();
        gateway.probe_packaged(&root).unwrap();
        let pid = gateway.child.pid().unwrap().unwrap();
        gateway.probe_packaged(&root).unwrap();
        assert_eq!(gateway.child.pid(), Ok(Some(pid)));
        gateway.stop().unwrap();
        assert_eq!(gateway.child.pid(), Ok(None));
    }

    #[test]
    #[ignore = "requires staged Windows resources and a signed-in Codex executable"]
    fn packaged_codex_recovers_turn_after_gateway_restart() {
        let executable = std::env::var("LAZY_CODEX_TEST_EXE").unwrap();
        let mut nonce = [0; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let dir = std::env::temp_dir().join(format!(
            "lazyprompting-codex-{}",
            crate::native_ipc_pipe::hex(&nonce)
        ));
        std::fs::create_dir(&dir).unwrap();
        let root = std::env::var_os("LAZY_GATEWAY_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway"));
        let gateway = GatewaySession::default();
        let result = std::panic::catch_unwind(|| {
            let mut dispatch = json!({
                "action":"dispatch","workspaceId":"workspace-01",
                "dataDir":dir.join("state"),"executable":executable,"cwd":dir,
                "prompt":"Reply LAZYPROMPTING_DESKTOP_OK only. Do not use tools.",
                "expectedResponse":"LAZYPROMPTING_DESKTOP_OK",
                "followUp":"Reply LAZYPROMPTING_FOLLOW_UP_OK only. Do not use tools."
            });
            gateway.probe_packaged(&root).unwrap();
            assert_eq!(
                gateway.request_codex(dispatch.clone()).unwrap()["status"],
                "SENT"
            );
            // Wait for the actual App Server turn to be visible in stored history
            // without reconciling the host outbox before restart.
            let mut status_request = dispatch.clone();
            status_request["action"] = json!("status");
            let wait_for_receipt = || {
                let deadline = Instant::now() + Duration::from_secs(45);
                loop {
                    // The App Server may reject a status read for a moment after a
                    // turn starts. Keep polling until the deadline instead of failing.
                    let status = gateway.request_codex(status_request.clone());
                    match status {
                        Ok(status) => {
                            if status["turnStatus"] == "completed" {
                                break status["turnId"].as_str().unwrap().to_owned();
                            }
                        }
                        Err(error) => {
                            assert!(Instant::now() < deadline, "Turn status failed: {error}");
                        }
                    }
                    assert!(Instant::now() < deadline, "Turn did not complete");
                    std::thread::sleep(Duration::from_millis(250));
                }
            };
            let receipt = wait_for_receipt();
            gateway.stop().unwrap();
            gateway.probe_packaged(&root).unwrap();
            assert_eq!(
                gateway.request_codex(dispatch.clone()).unwrap()["reason"],
                "WORKSPACE_PROMPT_PENDING"
            );
            dispatch["action"] = json!("observe");
            let response = gateway.request_codex(dispatch.clone()).unwrap();
            assert_eq!(response["status"], "SENT", "{response}");
            assert_eq!(response["phase"], "FOLLOW_UP");
            assert_eq!(response["responseId"], receipt);
            assert_eq!(
                response["responseText"].as_str().unwrap().trim(),
                "LAZYPROMPTING_DESKTOP_OK"
            );
            let follow_up_receipt = wait_for_receipt();
            assert_ne!(follow_up_receipt, receipt);
            gateway.stop().unwrap();
            gateway.probe_packaged(&root).unwrap();
            let follow_up = gateway.request_codex(dispatch.clone()).unwrap();
            assert_eq!(follow_up["status"], "OBSERVED");
            assert_eq!(follow_up["responseId"], follow_up_receipt);
            assert_eq!(
                follow_up["responseText"].as_str().unwrap().trim(),
                "LAZYPROMPTING_FOLLOW_UP_OK"
            );
            gateway.stop().unwrap();
            gateway.probe_packaged(&root).unwrap();
            assert_eq!(gateway.request_codex(dispatch).unwrap(), follow_up);
            let state: Value =
                serde_json::from_slice(&std::fs::read(dir.join("state/outbox.json")).unwrap())
                    .unwrap();
            assert_eq!(state["items"].as_array().unwrap().len(), 2);
        });
        gateway.stop().unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        if let Err(error) = result {
            std::panic::resume_unwind(error);
        }
    }

    #[test]
    #[ignore = "requires staged gateway, signed-in Codex and pinned Lightpanda in WSL2"]
    fn packaged_codex_invokes_scoped_preview_tools() {
        let executable = std::env::var("LAZY_CODEX_TEST_EXE").unwrap();
        let binary = std::env::var("LAZY_LIGHTPANDA_TEST_BINARY").unwrap();
        let mut nonce = [0; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let dir = std::env::temp_dir().join(format!(
            "lazyprompting-codex-tools-{}",
            crate::native_ipc_pipe::hex(&nonce)
        ));
        std::fs::create_dir(&dir).unwrap();
        let root = std::env::var_os("LAZY_GATEWAY_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway"));
        let gateway = GatewaySession::default();
        let preview = crate::lightpanda_controls::PreviewControls::default();
        let result = std::panic::catch_unwind(|| {
            let mut params = json!({
                "action":"dispatch","workspaceId":"workspace-02",
                "dataDir":dir.join("state"),"executable":executable,"cwd":dir,
                "prompt":"Call lazyprompting_open_preview, then lazyprompting_read_preview, then lazyprompting_close_preview. Wait for each tool result before the next. Reply with just the exact preview title returned by the read tool."
            });
            gateway.probe_packaged(&root).unwrap();
            assert_eq!(
                gateway.request_codex(params.clone()).unwrap()["status"],
                "SENT"
            );
            params["action"] = json!("observe");
            let deadline = Instant::now() + Duration::from_secs(75);
            let mut actions = Vec::new();
            loop {
                let result = gateway.request_codex(params.clone()).unwrap();
                match result["status"].as_str() {
                    Some("TOOL_REQUEST") => {
                        actions.push(result["action"].as_str().unwrap().to_owned());
                        let mut foreign = params.clone();
                        foreign["action"] = json!("claimTool");
                        foreign["workspaceId"] = json!("workspace-01");
                        foreign["toolToken"] = result["token"].clone();
                        foreign["approved"] = json!(true);
                        assert_eq!(gateway.request_codex(foreign).unwrap()["status"], "BLOCKED");
                        let reply = crate::codex_controls::service_preview_tool(
                            &gateway,
                            &preview,
                            params.clone(),
                            result,
                            Some(&binary),
                            |message| {
                                assert!(message.contains("workspace-02"));
                                true
                            },
                        )
                        .unwrap();
                        assert_eq!(reply["status"], "WAITING");
                    }
                    Some("OBSERVED") => {
                        assert_eq!(
                            result["responseText"].as_str().unwrap().trim(),
                            "Browser 01 · Local WebView Proof"
                        );
                        break;
                    }
                    Some("WAITING") => std::thread::sleep(Duration::from_millis(250)),
                    _ => panic!("Unexpected Codex state: {result}"),
                }
                assert!(Instant::now() < deadline, "Codex preview turn timed out");
            }
            assert_eq!(actions, ["open", "snapshot", "close"]);
        });
        preview.stop();
        gateway.stop().unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        if let Err(error) = result {
            std::panic::resume_unwind(error);
        }
    }

    #[test]
    #[ignore = "requires staged gateway and signed-in Codex; sends ten read-only turns"]
    fn packaged_codex_keeps_ten_workspace_receipts_separate() {
        let executable = std::env::var("LAZY_CODEX_TEST_EXE").unwrap();
        let root = std::env::var_os("LAZY_GATEWAY_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway"));
        let mut nonce = [0; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let dir = std::env::temp_dir().join(format!(
            "lazyprompting-codex-slots-{}",
            crate::native_ipc_pipe::hex(&nonce)
        ));
        std::fs::create_dir(&dir).unwrap();
        let gateway = GatewaySession::default();
        let result = std::panic::catch_unwind(|| {
            gateway.probe_packaged(&root).unwrap();
            let mut requests = Vec::new();
            let mut receipts = std::collections::HashSet::new();
            for pair in 0..5 {
                for id in pair * 2 + 1..=pair * 2 + 2 {
                    let workspace = format!("workspace-{id:02}");
                    let cwd = dir.join(&workspace);
                    std::fs::create_dir(&cwd).unwrap();
                    let marker = format!("LAZY_SLOT_{id:02}");
                    let params = json!({
                        "action":"dispatch","workspaceId":workspace,"dataDir":dir.join("state"),
                        "executable":executable,"cwd":cwd,
                        "prompt":format!("Reply with {marker} only. Do not use tools.")
                    });
                    let dispatch = gateway.request_codex(params.clone()).unwrap();
                    assert_eq!(dispatch["status"], "SENT", "{dispatch}");
                    requests.push((params, marker));
                }
                for (params, marker) in &requests[pair * 2..pair * 2 + 2] {
                    let mut observe = params.clone();
                    observe["action"] = json!("observe");
                    let deadline = Instant::now() + Duration::from_secs(60);
                    loop {
                        let result = gateway.request_codex(observe.clone()).unwrap();
                        if result["status"] == "OBSERVED" {
                            assert_eq!(result["workspaceId"], params["workspaceId"]);
                            assert_eq!(result["responseText"].as_str().unwrap().trim(), marker);
                            assert!(
                                receipts.insert(result["responseId"].as_str().unwrap().to_owned())
                            );
                            break;
                        }
                        assert_eq!(result["status"], "WAITING", "{result}");
                        assert!(Instant::now() < deadline, "Timed out waiting for {marker}");
                        std::thread::sleep(Duration::from_millis(300));
                    }
                }
            }
            gateway.stop().unwrap();
            gateway.probe_packaged(&root).unwrap();
            for (mut params, marker) in requests {
                params["action"] = json!("observe");
                let result = gateway.request_codex(params.clone()).unwrap();
                assert_eq!(result["workspaceId"], params["workspaceId"]);
                assert_eq!(result["responseText"].as_str().unwrap().trim(), marker);
                assert!(receipts.remove(result["responseId"].as_str().unwrap()));
            }
            assert!(receipts.is_empty());
            let state: Value =
                serde_json::from_slice(&std::fs::read(dir.join("state/outbox.json")).unwrap())
                    .unwrap();
            let items = state["items"].as_array().unwrap();
            assert_eq!(items.len(), 10);
            assert_eq!(
                items
                    .iter()
                    .map(|item| item["sessionId"].as_str().unwrap())
                    .collect::<std::collections::HashSet<_>>()
                    .len(),
                10
            );
            assert!(items
                .iter()
                .all(|item| item["state"] == "RESPONSE_VERIFIED"));
        });
        gateway.stop().unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        if let Err(error) = result {
            std::panic::resume_unwind(error);
        }
    }
}
