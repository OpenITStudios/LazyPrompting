use serde_json::{json, Value};
use std::io::{self, BufRead, Read, Write};

const CAPABILITIES: [(&str, &str); 13] = [
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
    ("workspace_chat.fixture_send", "Debug-only Send to owned localhost synthetic chat (not ChatGPT)"),
    ("workspace_chat.fixture_status", "Read debug-only synthetic chat observation; not a verified reply"),
];

pub(crate) fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();
    let mut line = Vec::new();
    loop {
        line.clear();
        if (&mut stdin)
            .take(1024 * 1024 + 1)
            .read_until(b'\n', &mut line)?
            == 0
        {
            break;
        }
        if line.len() > 1024 * 1024 {
            return Err("MCP message too large".into());
        }
        let request = match serde_json::from_slice::<Value>(&line) {
            Ok(request) => request,
            Err(_) => {
                send(
                    &mut stdout,
                    json!({"jsonrpc":"2.0","id":null,
                    "error":{"code":-32700,"message":"Parse error"}}),
                )?;
                continue;
            }
        };
        let method = request["method"].as_str();
        let id = request.get("id");
        if request["jsonrpc"] != "2.0" || method.is_none() {
            send(
                &mut stdout,
                json!({"jsonrpc":"2.0","id":id,
                "error":{"code":-32600,"message":"Invalid Request"}}),
            )?;
            continue;
        }
        let Some(id) = id else { continue };
        let params = request["params"].clone();
        let mut reply = match method {
            Some("initialize") if params["protocolVersion"].is_string() => {
                json!({"result":{"protocolVersion":"2025-03-26","capabilities":{"tools":{"listChanged":false}},
                    "serverInfo":{"name":"lazyprompting","version":env!("CARGO_PKG_VERSION")}}})
            }
            Some("initialize") => json!({"error":{"code":-32602,"message":"Invalid initialize"}}),
            Some("ping") => json!({"result":{}}),
            Some("tools/list") => json!({"result":{"tools":tools()}}),
            Some("tools/call") => json!({"result":match call(&params) {
                Ok(value) => json!({"structuredContent":value,"content":[{"type":"text","text":value.to_string()}]}),
                Err(code) => json!({"isError":true,"content":[{"type":"text","text":code}]}),
            }}),
            _ => json!({"error":{"code":-32601,"message":"Method not found"}}),
        };
        reply["jsonrpc"] = json!("2.0");
        reply["id"] = id.clone();
        send(&mut stdout, reply)?;
    }
    Ok(())
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

fn call(params: &Value) -> Result<Value, String> {
    let input = &params["arguments"];
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
                return crate::browser_mcp_pipe::request(
                    json!({"goalAction":action,"arguments":input["arguments"]}),
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
                let args = input["arguments"].clone();
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
            let args = input["arguments"].as_object().ok_or("INVALID_ARGUMENTS")?;
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
