# LazyPrompting MCP server

Node stdio MCP server: `node src/mcp/server.mjs`. This repository contains source only; it is not connected to the current ChatGPT session.

Default tools: `supervisor_status`, `supervisor_evaluate`, `checkpoint_read`. All are read-only or pure computation.

Optional browser tools: `browser_open`, `browser_snapshot`, `browser_close` when `LAZY_BROWSER_ORIGINS` contains a comma-separated list of explicitly approved public HTTPS origins. Playwright must be installed in the host environment. Browser interaction is read-only; ChatGPT Web and authentication origins are prohibited.

Set `LAZY_CHECKPOINT_FILE` to a trusted local path to enable checkpoint reading. MCP does not expose checkpoint mutation, GitHub writes, Codex dispatch or background looping.

The remote browser must run behind an egress firewall to mitigate DNS rebinding, redirects, and SSRF. Do not treat the source allowlist alone as a production security boundary.

Illustrative host configuration:
```json
{"mcpServers":{"lazyprompting":{"command":"node","args":["src/mcp/server.mjs"],"env":{"LAZY_BROWSER_ORIGINS":"https://approved-public-site.example"}}}}
```

This is a sample configuration, not a claim of installed MCP host or supported ChatGPT connection. Do not put credentials in source files. See `docs/architecture/runtime-integration.md`.
