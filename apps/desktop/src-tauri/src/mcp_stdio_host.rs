use serde_json::{json, Value};
use std::io::{self, BufRead, Read, Write};

const CAPABILITIES: [(&str, &str); 14] = [
    ("goal_run.start", "Review and persist a goal run scope in the Windows host"),
    ("goal_run.turn_receipt", "Read an approved Codex goal turn's correlated durable receipt (no QA or dispatch authority)"),
    ("goal_run.status", "Read the current status of a goal run"),
    ("goal_run.report", "Read the verified results of a goal run"),
    ("goal_run.control", "Control a goal run"),
    (
        "workspace_browser.open",
        "Open a workspace browser in LazyPrompting, optionally navigating it to an HTTP or HTTPS address",
    ),
    (
        "workspace_browser.navigate",
        "Navigate an open workspace browser to an HTTP or HTTPS address",
    ),
    (
        "workspace_browser.location",
        "Read the current address of an open workspace browser",
    ),
    ("workspace_browser.back", "Go back in the browser's history"),
    (
        "workspace_browser.forward",
        "Go forward in the browser's history",
    ),
    ("workspace_browser.reload", "Reload the current page"),
    ("workspace_browser.release", "Release this MCP client's ownership of one workspace without closing its tab"),
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
const INSTRUCTIONS: &str = "LazyPrompting desktop control. Use search_capabilities to find capabilities, describe_capability for their arguments, and invoke_capability to run one. The native desktop host starts on the first browser or goal operation; host approval remains required for authorized mutations.";

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
        Some("status") => Ok(
            json!({"backend":"WEBVIEW2","openBrowserIn":"LazyPrompting","goalRun":"WORKTREE_WRITE_OR_READ_ONLY"}),
        ),
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
                return Ok(json!({"name":name,"description":description,"inputSchema":schema}));
            }
            let args = object_or_parsed(&input["arguments"])?;
            let args = args.as_object().ok_or("INVALID_ARGUMENTS")?;
            let workspace = args
                .get("workspaceId")
                .and_then(Value::as_str)
                .ok_or("INVALID_WORKSPACE")?;
            let mut request = json!({"workspaceId":workspace,"action":action});
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
