# LazyPrompting MCP — initial implementation

`src/mcp/server.mjs` implements a minimal **stdio JSON-RPC MCP** endpoint using Node.js built-ins. The initial tool surface is deliberately read-only: `supervisor_status`, `supervisor_evaluate`, `checkpoint_read`.

No browser dispatch, GitHub mutation, session scraping, model invocation, or autonomous loop is exposed through MCP. No authentication is built into stdio; the invoking host must control process access and tool admission.

This implementation handles newline-delimited JSON on stdin/stdout. It does not implement HTTP transport, resumable streams, resource subscriptions, prompts, or OAuth. Protocol conformance and interoperability with a real MCP host are not yet verified.

Example host configuration (illustrative; adapt to actual host):
```json
{"mcpServers":{"lazyprompting":{"command":"node","args":["src/mcp/server.mjs"]}}}
```
Run from the repository root. Set `LAZY_CHECKPOINT_FILE` only to a trusted local checkpoint path. No automatic browser access is enabled.
