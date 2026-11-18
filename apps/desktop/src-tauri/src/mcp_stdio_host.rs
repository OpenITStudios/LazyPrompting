use serde_json::{json, Value};
use std::io::{self, BufRead, Read, Write};

const CAPABILITIES: [(&str, &str); 22] = [
    ("code_mode.catalog", "Discover the bounded read-only Code Mode SDK and available tools"),
    ("code_mode.execute", "Compose bounded reads and, with native owner lease, stage one operator-reviewed manual draft; no ChatGPT send"),
    ("goal_run.start", "Review and persist a goal run scope in the Windows host"),
    ("goal_run.turn_receipt", "Read an approved Codex goal turn's correlated durable receipt (no QA or dispatch authority)"),
    ("goal_run.status", "Read the current status of a goal run"),
    ("goal_run.report", "Read the verified results of a goal run"),
    ("goal_run.control", "Control a goal run"),
    ("agent_run.prepare", "Ask the native operator to approve one provider-specific read-only v2 scope; does not dispatch"),
    ("agent_run.status", "Read the native v2 scope and approval state, not worker execution results"),
    ("agent_run.review_execution", "Record separate operator intent for future read-only execution; does not launch a worker"),
    ("agent_run.stop", "Permanently STOP a prepared v2 goal before provider dispatch"),
    (
        "workspace_browser.open",
        "Open the protected ChatGPT workspace; an external HTTP(S) address is offered to the operator for a supporting tab (not automatically loaded)",
    ),
    (
        "workspace_browser.navigate",
        "Navigate the operator-selected supporting browser tab; cannot navigate the protected ChatGPT main tab",
    ),
    (
        "workspace_browser.location",
        "Read the address of the native selected browser tab (query and fragment omitted)",
    ),
    ("workspace_browser.back", "Go back in the selected supporting tab; MCP cannot change ChatGPT main navigation"),
    (
        "workspace_browser.forward",
        "Go forward in the selected supporting tab; MCP cannot change ChatGPT main navigation",
    ),
    ("workspace_browser.reload", "Reload the selected supporting tab; MCP cannot reload ChatGPT main"),
    ("workspace_browser.release", "Release this MCP client's ownership of one workspace without closing its tab"),
    ("workspace_browser.observe", "Read one manually approved, token-bounded compact or delta accessibility snapshot from an active HTTPS supporting tab; never ChatGPT main"),
    ("workspace_chat.prepare_handoff", "Prepare an operator-reviewed ordinary ChatGPT prompt; manual copy only, no send or reply access"),
    ("workspace_chat.fixture_send", "Debug-only Send to owned localhost synthetic chat (not ChatGPT)"),
    ("workspace_chat.fixture_status", "Read debug-only synthetic chat observation; not a verified reply"),
];

pub(crate) fn run() -> Result<(), Box<dyn std::error::Error>> {
    // MCP initialize/discovery must respond without waiting for GUI startup.
    // The native host starts lazily on the first browser or goal operation.
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();
    run_with(&mut stdin, &mut stdout).map_err(Into::into)
}

// The stdio transport is the MCP standard, so any conforming client can use
// this facade. Keep the protocol surface predictable for every client instead
// of assuming the Codex request order.
const PROTOCOL_VERSION: &str = "2025-03-26";
// Native catalog is the owner of effects for the installed MCP. Only
// metadata is exposed to the confined Code Mode; no grant or raw arguments.
fn code_mode_native_policy(name: &str) -> (&'static str, &'static str, Option<&'static str>) {
    match name {
        "code_mode.catalog" => ("READ", "HOST_CATALOG_ONLY", None),
        "code_mode.execute" => ("COMPOSITION_OR_HOST_DRAFT", "NATIVE_EFFECT_BROKER", None),
        "goal_run.status" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.status")),
        "goal_run.report" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.report")),
        "goal_run.turn_receipt" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.receipt")),
        "goal_run.start" => ("DISPATCH", "NATIVE_GOAL_SCOPE_APPROVAL", None),
        "goal_run.control" => ("CONTROL", "NATIVE_GOAL_STOP_PAUSE_RESUME", None),
        "agent_run.status" => ("READ", "OWNED_AGENT_SCOPE", Some("agent.status")),
        "agent_run.prepare" => ("APPROVAL", "NATIVE_V2_SOURCE_REVIEW", None),
        "agent_run.review_execution" => ("APPROVAL", "NATIVE_V2_EXECUTION_REVIEW", None),
        "agent_run.stop" => ("CONTROL", "NATIVE_STOP", None),
        "workspace_browser.location" => ("READ", "OWNED_WORKSPACE", Some("workspace.location")),
        "workspace_browser.observe" => ("SENSITIVE_READ", "NATIVE_ONE_SHOT_OPERATOR_GRANT", None),
        "workspace_browser.open"
        | "workspace_browser.navigate"
        | "workspace_browser.back"
        | "workspace_browser.forward"
        | "workspace_browser.reload" => ("NAVIGATION", "OWNED_SUPPORTING_TAB", None),
        "workspace_browser.release" => ("CONTROL", "OWNED_WORKSPACE", None),
        "workspace_chat.prepare_handoff" => {
            ("DRAFT", "OWNED_MANUAL_HANDOFF", Some("handoff.prepare"))
        }
        "workspace_chat.fixture_send" => ("DEBUG", "NATIVE_DEBUG_TEST_ONLY", None),
        "workspace_chat.fixture_status" => ("DEBUG", "NATIVE_DEBUG_TEST_ONLY", None),
        _ => ("UNCLASSIFIED", "DENY", None),
    }
}
fn code_mode_native_catalog() -> Value {
    let items: Vec<Value> = CAPABILITIES
        .iter()
        .map(|(name, description)| {
            let (effect, permission, alias) = code_mode_native_policy(name);
            json!({"name":name,"description":description,"effect":effect,
               "permission":permission,"codeModeAlias":alias,
               "invocableFromCode":false})
        })
        .collect();
    json!({"source":"NATIVE_MCP_CATALOG","capabilities":items})
}

const INSTRUCTIONS: &str = "LazyPrompting desktop control. Prefer code_mode.catalog and code_mode.execute for bounded read-only composition. Discovery and invocation remain available through four public MCP tools. Optional owned native V1 goal and V2 agent status, one correlated receipt, workspace origin, and configured checkpoint summary do not grant browser navigation, page contents, writes, ChatGPT send, or worker dispatch. All existing native permissions and STOP gates remain authoritative.";

fn run_with(input: &mut impl BufRead, output: &mut impl Write) -> io::Result<()> {
    let mut line = Vec::new();
    loop {
        line.clear();
        if (&mut *input)
            .take(1024 * 1024 + 1)
            .read_until(b'\n', &mut line)?
            == 0
        {
            break;
        }
        if line.len() > 1024 * 1024 {
            return Err(io::Error::other("MCP message too large"));
        }
        let request = match serde_json::from_slice::<Value>(&line) {
            Ok(request) => request,
            Err(_) => {
                send(
                    output,
                    json!({"jsonrpc":"2.0","id":null,
                    "error":{"code":-32700,"message":"Parse error"}}),
                )?;
                continue;
            }
        };
        if request["jsonrpc"] != "2.0" || request["method"].as_str().is_none() {
            send(
                output,
                json!({"jsonrpc":"2.0","id":request.get("id"),
                "error":{"code":-32600,"message":"Invalid Request"}}),
            )?;
            continue;
        }
        // A notification has no id and never receives a reply.
        let Some(id) = request.get("id").cloned() else {
            continue;
        };
        let mut reply = handle(&request);
        reply["jsonrpc"] = json!("2.0");
        reply["id"] = id;
        send(output, reply)?;
    }
    Ok(())
}

fn handle(request: &Value) -> Value {
    let method = request["method"].as_str().unwrap_or_default();
    let params = request["params"].clone();
    match method {
        "initialize" => {
            // Accept a missing version and answer with the supported one.
            if !params["protocolVersion"].is_null() && !params["protocolVersion"].is_string() {
                return json!({"error":{"code":-32602,"message":"Invalid initialize"}});
            }
            json!({"result":{"protocolVersion":PROTOCOL_VERSION,
                "capabilities":{"tools":{"listChanged":false}},
                "serverInfo":{"name":"lazyprompting","version":env!("CARGO_PKG_VERSION")},
                "instructions":INSTRUCTIONS}})
        }
        "ping" => json!({"result":{}}),
        "tools/list" => json!({"result":{"tools":tools()}}),
        "tools/call" => json!({"result":match call(&params) {
            Ok(value) => json!({"structuredContent":value,"content":[{"type":"text","text":value.to_string()}]}),
            Err(code) => json!({"isError":true,"content":[{"type":"text","text":code}]}),
        }}),
        // Clients probe these before deciding what to show. An empty list is a
        // truthful answer for a facade that owns no resources or prompts.
        "resources/list" => json!({"result":{"resources":[]}}),
        "resources/templates/list" => json!({"result":{"resourceTemplates":[]}}),
        "prompts/list" => json!({"result":{"prompts":[]}}),
        _ => json!({"error":{"code":-32601,"message":"Method not found"}}),
    }
}

fn send(stdout: &mut impl Write, message: Value) -> io::Result<()> {
    serde_json::to_writer(&mut *stdout, &message)?;
    stdout.write_all(b"\n")?;
    stdout.flush()
}

fn tools() -> Value {
    json!([
        {"name":"status","description":"Report what the LazyPrompting MCP controls",
            "inputSchema":{"type":"object","properties":{},"additionalProperties":false}},
        {"name":"search_capabilities","description":"Find LazyPrompting browser and goal run capabilities",
            "inputSchema":{"type":"object","properties":{"query":{"type":"string","maxLength":256}},"required":["query"],"additionalProperties":false}},
        {"name":"describe_capability","description":"Get arguments for one LazyPrompting capability",
            "inputSchema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"],"additionalProperties":false}},
        {"name":"invoke_capability","description":"Invoke a LazyPrompting browser or goal run capability.",
            "inputSchema":{"type":"object","properties":{"name":{"type":"string"},"arguments":{"type":"object"}},"required":["name","arguments"],"additionalProperties":false}}
    ])
}

// Some clients pass a nested object as a JSON string. Accept both shapes; the
// parsed object still goes through the same native validation and admission.
fn object_or_parsed(value: &Value) -> Result<Value, String> {
    let parsed = match value {
        Value::Object(_) => value.clone(),
        Value::String(text) => {
            serde_json::from_str::<Value>(text).map_err(|_| "INVALID_ARGUMENTS".to_owned())?
        }
        Value::Null => Value::Object(Default::default()),
        _ => return Err("INVALID_ARGUMENTS".into()),
    };
    if parsed.is_object() {
        Ok(parsed)
    } else {
        Err("INVALID_ARGUMENTS".into())
    }
}

fn call(params: &Value) -> Result<Value, String> {
    let input = object_or_parsed(&params["arguments"])?;
    match params["name"].as_str() {
        Some("status") => Ok(json!({"backend":"WEBVIEW2","openBrowserIn":"LazyPrompting",
                   "goalRun":"CODEX_V1_WORKTREE_WRITE_OR_READ_ONLY",
                   "agentV2":"SOURCE_ONLY_PREPARE_STATUS_STOP_NO_DISPATCH",
                   "chatgptTransport":"MANUAL_HANDOFF_ONLY_NO_AUTHENTICATED_SESSION"})),
        Some("search_capabilities") => {
            let query = input["query"]
                .as_str()
                .ok_or("INVALID_ARGUMENTS")?
                .to_lowercase();
            let results: Vec<_> = CAPABILITIES
                .iter()
                .filter(|(name, description)| {
                    query.split_whitespace().all(|term| {
                        name.contains(term) || description.to_lowercase().contains(term)
                    })
                })
                .map(|(name, description)| json!({"name":name,"description":description}))
                .collect();
            Ok(json!({"results":results}))
        }
        Some("describe_capability" | "invoke_capability") => {
            let name = input["name"].as_str().ok_or("INVALID_ARGUMENTS")?;
            let (_, description) = CAPABILITIES
                .iter()
                .find(|(candidate, _)| *candidate == name)
                .ok_or("UNKNOWN_CAPABILITY")?;
            if let Some(action) = name.strip_prefix("code_mode.") {
                if !matches!(action, "catalog" | "execute") {
                    return Err("UNKNOWN_CAPABILITY".into());
                }
                if params["name"] == "describe_capability" {
                    let schema = if action == "catalog" {
                        json!({"type":"object","properties":{},"additionalProperties":false})
                    } else {
                        json!({"type":"object","properties":{
                            "code":{"type":"string","minLength":1,"maxLength":4096},
                            "runId":{"type":"string","minLength":69,"maxLength":69,
                                "description":"Existing Codex V1 goal lease owned by this MCP client; optional"},
                            "workspaceId":{"type":"string",
                                "pattern":"^workspace-(0[1-9]|10)$",
                                "description":"Existing workspace lease for a selected HTTPS supporting tab"},
                            "agentRunId":{"type":"string","minLength":69,"maxLength":69,
                                "description":"Existing Agent V2 source-only run lease; never worker dispatch"},
                            "effectPolicy":{"type":"boolean","const":true,
                                "description":"Owner-leased native Agent V2 effect-denial reasons; no reservation or dispatch"},
                            "receipt":{"type":"object","required":["taskId","turnId"],
                                "additionalProperties":false,
                                "properties":{
                                  "taskId":{"type":"string","pattern":"^task-[1-8]$"},
                                  "turnId":{"type":"string","minLength":1,"maxLength":128}}},
                            "repositoryStatus":{"type":"boolean","const":true,
                                "description":"Read only Git status counts in existing owner-leased approved Agent V2 source scope"},
                            "handoffWorkspaceId":{"type":"string",
                                "pattern":"^workspace-(0[1-9]|10)$",
                                "description":"Existing workspace lease for one host-reviewed manual draft; no send"}},
                            "required":["code"],"additionalProperties":false})
                    };
                    return Ok(json!({"name":name,"description":description,
                        "inputSchema":schema,
                        "effect":if action=="execute" {
                            "READ_OR_HOST_MANUAL_DRAFT"
                        }else{"READ_ONLY"}}));
                }
                let arguments = object_or_parsed(&input["arguments"])?;
                let object = arguments.as_object().ok_or("INVALID_ARGUMENTS")?;
                if action == "catalog" && !object.is_empty() {
                    return Err("INVALID_ARGUMENTS".into());
                }
                if action == "execute" {
                    let allowed = |key: &str| {
                        matches!(
                            key,
                            "code"
                                | "runId"
                                | "workspaceId"
                                | "agentRunId"
                                | "receipt"
                                | "repositoryStatus"
                                | "handoffWorkspaceId"
                                | "effectPolicy"
                        )
                    };
                    let receipt_ok = if let Some(receipt) = object.get("receipt") {
                        let fields = receipt.as_object().ok_or("INVALID_ARGUMENTS")?;
                        object.contains_key("runId")
                            && fields.len() == 2
                            && fields.contains_key("taskId")
                            && fields.contains_key("turnId")
                            && fields["taskId"].as_str().is_some_and(|id| {
                                matches!(
                                    id,
                                    "task-1"
                                        | "task-2"
                                        | "task-3"
                                        | "task-4"
                                        | "task-5"
                                        | "task-6"
                                        | "task-7"
                                        | "task-8"
                                )
                            })
                            && fields["turnId"].as_str().is_some_and(|id| {
                                !id.is_empty()
                                    && id.len() <= 128
                                    && id
                                        .bytes()
                                        .all(|c| c.is_ascii_alphanumeric() || b"_:-".contains(&c))
                            })
                    } else {
                        true
                    };
                    if object.is_empty()
                        || object.len() > 8
                        || object.keys().any(|key| !allowed(key))
                        || (object.contains_key("repositoryStatus")
                            && (!object.contains_key("agentRunId")
                                || arguments["repositoryStatus"] != true))
                        || (object.contains_key("effectPolicy")
                            && (!object.contains_key("agentRunId")
                                || arguments["effectPolicy"] != true))
                        || !arguments["code"]
                            .as_str()
                            .is_some_and(|code| !code.trim().is_empty() && code.len() <= 4096)
                        || ["runId", "agentRunId"].iter().any(|key| {
                            object.contains_key(*key)
                                && !arguments[*key].as_str().is_some_and(|id| id.len() == 69)
                        })
                        || (object.contains_key("workspaceId")
                            && !arguments["workspaceId"]
                                .as_str()
                                .is_some_and(|id| crate::embedded_webview::label_for(id).is_ok()))
                        || (object.contains_key("handoffWorkspaceId")
                            && !arguments["handoffWorkspaceId"]
                                .as_str()
                                .is_some_and(|id| crate::embedded_webview::label_for(id).is_ok()))
                        || !receipt_ok
                    {
                        return Err("INVALID_ARGUMENTS".into());
                    }
                }
                return crate::browser_mcp_pipe::request(
                    json!({"codeModeAction":action,"arguments":arguments,
                           "nativeCatalog":code_mode_native_catalog()}),
                );
            }
            if let Some(action) = name.strip_prefix("agent_run.") {
                if params["name"] == "describe_capability" {
                    return Ok(json!({"name":name,"description":description,
                        "inputSchema":crate::agent_goal_authority::schema(action)}));
                }
                if !matches!(action, "prepare" | "status" | "stop" | "review_execution") {
                    return Err("UNKNOWN_CAPABILITY".into());
                }
                let arguments = object_or_parsed(&input["arguments"])?;
                return crate::browser_mcp_pipe::request(
                    json!({"agentRunAction":action,"arguments":arguments}),
                );
            }
            if let Some(action) = name.strip_prefix("goal_run.") {
                if params["name"] == "describe_capability" {
                    return Ok(
                        json!({"name":name,"description":description,"inputSchema":crate::goal_runs::schema(action)}),
                    );
                }
                let capability_arguments = object_or_parsed(&input["arguments"])?;
                return crate::browser_mcp_pipe::request(
                    json!({"goalAction":action,"arguments":capability_arguments}),
                );
            }
            // A client-neutral, read-only handoff; every invocation goes via
            // the installed native host's process identity and workspace lease.
            // No prompt is sent to ChatGPT or recorded as an authenticated turn.
            if name == "workspace_chat.prepare_handoff" {
                if params["name"] == "describe_capability" {
                    return Ok(json!({"name":name,"description":description,
                        "inputSchema":crate::chat_manual_handoff::schema()}));
                }
                let arguments = object_or_parsed(&input["arguments"])?;
                return crate::browser_mcp_pipe::request(
                    json!({"manualChatAction":"prepare_handoff","arguments":arguments}),
                );
            }
            // Debug-only path. An ordinary client cannot turn on the native
            // feature flag through MCP arguments; the Windows host owns it.
            if let Some(action) = name.strip_prefix("workspace_chat.fixture_") {
                if params["name"] == "describe_capability" {
                    return Ok(json!({"name":name,"description":description,
                        "inputSchema":crate::chat_fixture_native::schema(action)}));
                }
                if !matches!(action, "send" | "status") {
                    return Err("UNKNOWN_CAPABILITY".into());
                }
                let args = object_or_parsed(&input["arguments"])?;
                return crate::browser_mcp_pipe::request(
                    json!({"fixtureAction":action,"arguments":args}),
                );
            }
            let action = name.trim_start_matches("workspace_browser.");
            if params["name"] == "describe_capability" {
                let mut schema = json!({"type":"object","properties":{"workspaceId":{"type":"string","pattern":"^workspace-(0[1-9]|10)$"}},"required":["workspaceId"],"additionalProperties":false});
                if matches!(action, "open" | "navigate") {
                    schema["properties"]["address"] = json!({"type":"string","maxLength":2048});
                }
                if action == "navigate" {
                    schema["required"] = json!(["workspaceId", "address"]);
                }
                if action == "observe" {
                    schema["properties"]["mode"] = json!({"type":"string",
                       "enum":["compact","delta"],"default":"compact"});
                }
                return Ok(json!({"name":name,"description":description,"inputSchema":schema}));
            }
            let args = object_or_parsed(&input["arguments"])?;
            let args = args.as_object().ok_or("INVALID_ARGUMENTS")?;
            let workspace = args
                .get("workspaceId")
                .and_then(Value::as_str)
                .ok_or("INVALID_WORKSPACE")?;
            let mut request = json!({"workspaceId":workspace,"action":action});
            if action == "observe" {
                if args.len() > 2 {
                    return Err("INVALID_ARGUMENTS".into());
                }
                if let Some(mode) = args.get("mode") {
                    let mode = mode.as_str().ok_or("OBSERVATION_INVALID_MODE")?;
                    if !matches!(mode, "compact" | "delta") {
                        return Err("OBSERVATION_INVALID_MODE".into());
                    }
                    request["mode"] = json!(mode);
                }
                return crate::browser_mcp_pipe::request(request);
            }
            if matches!(action, "open" | "navigate") && args.len() == 2 {
                request["address"] = json!(args
                    .get("address")
                    .and_then(Value::as_str)
                    .ok_or("INVALID_BROWSER_ADDRESS")?);
            } else if action == "navigate" || args.len() != 1 {
                return Err("INVALID_ARGUMENTS".into());
            }
            crate::browser_mcp_pipe::request(request)
        }
        _ => Err("UNKNOWN_TOOL".into()),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn code_mode_contract_requires_no_native_launch_for_discovery() {
        use super::{call, tools};
        use serde_json::json;
        let spec = call(&json!({"name":"describe_capability",
            "arguments":{"name":"code_mode.execute"}}))
        .unwrap();
        assert_eq!(spec["effect"], "READ_OR_HOST_MANUAL_DRAFT");
        assert_eq!(spec["inputSchema"]["properties"]["code"]["maxLength"], 4096);
        assert_eq!(spec["inputSchema"]["properties"]["runId"]["maxLength"], 69);
        assert_eq!(
            spec["inputSchema"]["properties"]["workspaceId"]["pattern"],
            "^workspace-(0[1-9]|10)$"
        );
        assert_eq!(
            spec["inputSchema"]["properties"]["agentRunId"]["maxLength"],
            69
        );
        assert_eq!(
            spec["inputSchema"]["properties"]["receipt"]["additionalProperties"],
            false
        );
        assert_eq!(
            spec["inputSchema"]["properties"]["repositoryStatus"]["const"],
            true
        );
        assert_eq!(
            spec["inputSchema"]["properties"]["effectPolicy"]["const"],
            true
        );
        for invalid in [
            json!({"code":"return 1;","effectPolicy":true}),
            json!({"code":"return 1;","effectPolicy":false,
                "agentRunId":"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef"}),
        ] {
            let answer = call(&json!({"name":"invoke_capability","arguments":{
                "name":"code_mode.execute","arguments":invalid}}));
            assert_eq!(answer.unwrap_err(), "INVALID_ARGUMENTS");
        }
        assert_eq!(
            spec["inputSchema"]["properties"]["handoffWorkspaceId"]["pattern"],
            "^workspace-(0[1-9]|10)$"
        );
        let bad_handoff = call(&json!({"name":"invoke_capability",
            "arguments":{"name":"code_mode.execute","arguments":{
                "code":"return 1;","handoffWorkspaceId":"workspace-11"}}}));
        assert_eq!(bad_handoff.unwrap_err(), "INVALID_ARGUMENTS");
        let no_scope = call(&json!({"name":"invoke_capability","arguments":{
            "name":"code_mode.execute","arguments":{
                "code":"return 1;","repositoryStatus":true}}}));
        assert_eq!(no_scope.unwrap_err(), "INVALID_ARGUMENTS");
        for arguments in [
            json!({"code":"return 1;","agentRunId":"bad"}),
            json!({"code":"return 1;","receipt":{"taskId":"task-1","turnId":"turn-01"}}),
            json!({"code":"return 1;","receipt":{"taskId":"../secret","turnId":"turn-01"},
                "runId":"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef"}),
            json!({"code":"return 1;","receipt":{"taskId":"task-1",
                "turnId":"../private"},"runId":"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef"}),
            json!({"code":"return 1;","receipt":{"taskId":"task-1",
                "turnId":"turn-01","grant":true},"runId":"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef"}),
        ] {
            let result = call(&json!({"name":"invoke_capability",
                "arguments":{"name":"code_mode.execute","arguments":arguments}}));
            assert_eq!(result.unwrap_err(), "INVALID_ARGUMENTS");
        }
        let invalid_workspace = call(&json!({"name":"invoke_capability",
            "arguments":{"name":"code_mode.execute",
                "arguments":{"code":"return 1;","workspaceId":"workspace-11"}}}));
        assert_eq!(invalid_workspace.unwrap_err(), "INVALID_ARGUMENTS");
        let malformed_run = call(&json!({"name":"invoke_capability",
            "arguments":{"name":"code_mode.execute",
                "arguments":{"code":"return 1;","runId":"invalid"}}}));
        assert_eq!(malformed_run.unwrap_err(), "INVALID_ARGUMENTS");
        assert_eq!(tools().as_array().unwrap().len(), 4);
        let native = super::code_mode_native_catalog();
        assert_eq!(native["source"], "NATIVE_MCP_CATALOG");
        assert_eq!(native["capabilities"].as_array().unwrap().len(), 22);
        assert!(native["capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item["invocableFromCode"] == false));
        assert!(native["capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item["effect"] != "UNCLASSIFIED"));
        let navigation = native["capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["name"] == "workspace_browser.navigate")
            .unwrap();
        assert_eq!(navigation["effect"], "NAVIGATION");
        let code = native["capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["name"] == "code_mode.execute")
            .unwrap();
        assert_eq!(code["effect"], "COMPOSITION_OR_HOST_DRAFT");
        assert_eq!(code["permission"], "NATIVE_EFFECT_BROKER");
        assert!(navigation["codeModeAlias"].is_null());
        let read = native["capabilities"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["name"] == "goal_run.status")
            .unwrap();
        assert_eq!(read["codeModeAlias"], "goal.status");
        let invalid = call(&json!({"name":"invoke_capability",
            "arguments":{"name":"code_mode.execute",
                "arguments":{"code":"return 1;","unexpected":true}}}));
        assert_eq!(invalid.unwrap_err(), "INVALID_ARGUMENTS");
    }

    use super::*;

    fn exchange(requests: &[Value]) -> Vec<Value> {
        let mut input = Vec::new();
        for request in requests {
            input.extend_from_slice(&serde_json::to_vec(request).unwrap());
            input.push(b'\n');
        }
        let mut output = Vec::new();
        run_with(&mut input.as_slice(), &mut output).unwrap();
        String::from_utf8(output)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    // A Claude-style client: initialize, initialized notification, list, call.
    #[test]
    fn a_generic_client_sequence_is_answered() {
        let replies = exchange(&[
            json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
                "protocolVersion":"2025-03-26","capabilities":{},
                "clientInfo":{"name":"generic-client","version":"1"}}}),
            json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
            json!({"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}),
            json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
                "name":"status","arguments":{}}}),
        ]);
        // The notification must not produce a reply.
        assert_eq!(replies.len(), 3);
        assert_eq!(replies[0]["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(replies[0]["result"]["serverInfo"]["name"], "lazyprompting");
        let tools = replies[1]["result"]["tools"].as_array().unwrap();
        assert_eq!(tools.len(), 4);
        for tool in tools {
            assert!(tool["inputSchema"]["type"] == "object");
            assert!(tool["description"].as_str().is_some_and(|d| !d.is_empty()));
        }
        assert_eq!(replies[2]["result"]["content"][0]["type"], "text");
    }

    // Both priority MCP clients discover the exact same read-only ChatGPT
    // handoff capability. The discovery path has no host/browser side effect.
    #[test]
    fn codex_and_opencode_have_identical_manual_chat_contract() {
        for client in ["codex", "opencode"] {
            let replies = exchange(&[
                json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
                    "protocolVersion":"2025-03-26","capabilities":{},
                    "clientInfo":{"name":client,"version":"1"}}}),
                json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
                    "name":"describe_capability","arguments":{
                        "name":"workspace_chat.prepare_handoff"}}}),
                json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
                    "name":"status","arguments":{}}}),
            ]);
            assert_eq!(replies.len(), 3);
            let spec = &replies[1]["result"]["structuredContent"];
            assert_eq!(spec["name"], "workspace_chat.prepare_handoff");
            assert_eq!(spec["inputSchema"]["additionalProperties"], false);
            let status = &replies[2]["result"]["structuredContent"];
            assert_eq!(
                status["chatgptTransport"],
                "MANUAL_HANDOFF_ONLY_NO_AUTHENTICATED_SESSION"
            );
        }
    }

    #[test]
    fn codex_and_opencode_discover_the_same_compact_observation_schema() {
        for client in ["codex", "opencode"] {
            let replies = exchange(&[
                json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{
                    "clientInfo":{"name":client,"version":"1"}}}),
                json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
                    "name":"describe_capability","arguments":{
                        "name":"workspace_browser.observe"}}}),
                json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
                    "name":"search_capabilities","arguments":{"query":"workspace_browser.observe"}}}),
            ]);
            let schema = &replies[1]["result"]["structuredContent"]["inputSchema"];
            assert_eq!(schema["additionalProperties"], false);
            assert_eq!(
                schema["properties"]["mode"]["enum"],
                json!(["compact", "delta"])
            );
            assert_eq!(schema["required"], json!(["workspaceId"]));
            let caps = &replies[2]["result"]["structuredContent"]["results"];
            assert_eq!(caps.as_array().unwrap().len(), 1);
            assert_eq!(caps[0]["name"], "workspace_browser.observe");
        }
    }
    // A client may omit the protocol version or probe optional methods.
    #[test]
    fn optional_client_shapes_are_answered() {
        let replies = exchange(&[
            json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}),
            json!({"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}),
            json!({"jsonrpc":"2.0","id":3,"method":"prompts/list","params":{}}),
            json!({"jsonrpc":"2.0","id":4,"method":"ping"}),
        ]);
        assert_eq!(replies[0]["result"]["protocolVersion"], PROTOCOL_VERSION);
        assert_eq!(
            replies[1]["result"]["resources"].as_array().unwrap().len(),
            0
        );
        assert_eq!(replies[2]["result"]["prompts"].as_array().unwrap().len(), 0);
        assert_eq!(replies[3]["result"], json!({}));
    }

    // A client may send a nested object as a JSON string.
    #[test]
    fn a_stringified_object_is_parsed() {
        let parsed = object_or_parsed(&json!("{\"workspaceId\":\"workspace-01\"}")).unwrap();
        assert_eq!(parsed["workspaceId"], "workspace-01");
        assert!(object_or_parsed(&json!("not json")).is_err());
        assert!(object_or_parsed(&json!(5)).is_err());
        assert!(object_or_parsed(&json!([1, 2])).is_err());
    }

    // A stringified capability argument must reach the native host instead of
    // being rejected as malformed input.
    #[test]
    fn a_stringified_capability_argument_reaches_the_host() {
        let replies = exchange(&[
            json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
            "name":"invoke_capability",
            "arguments":{"name":"workspace_browser.location",
                "arguments":"{\"workspaceId\":\"workspace-01\"}"}}}),
        ]);
        let text = replies[0]["result"]["content"][0]["text"]
            .as_str()
            .unwrap_or_default();
        assert_ne!(text, "INVALID_ARGUMENTS");
    }

    // A malformed or unknown request must not end the session.
    #[test]
    fn invalid_requests_do_not_end_the_session() {
        let mut input = Vec::new();
        input.extend_from_slice(b"{not json}\n");
        input.extend_from_slice(
            &serde_json::to_vec(&json!({"jsonrpc":"2.0","id":1,"method":"unknown/method"}))
                .unwrap(),
        );
        input.push(b'\n');
        input.extend_from_slice(
            &serde_json::to_vec(&json!({"jsonrpc":"2.0","id":2,"method":"tools/list"})).unwrap(),
        );
        input.push(b'\n');
        let mut output = Vec::new();
        run_with(&mut input.as_slice(), &mut output).unwrap();
        let replies: Vec<Value> = String::from_utf8(output)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(replies.len(), 3);
        assert_eq!(replies[0]["error"]["code"], -32700);
        assert_eq!(replies[1]["error"]["code"], -32601);
        assert_eq!(replies[2]["result"]["tools"].as_array().unwrap().len(), 4);
    }
}
