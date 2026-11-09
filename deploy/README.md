# LazyPrompting deployment contract — not yet deployed

The canonical MCP server is `node src/gateway/mcp-gateway.mjs`. Run it only under an MCP-capable host that controls process launch and environment variables.

Required platform prerequisites:
- Node.js >=20; a filesystem providing appropriate atomic rename and exclusive mkdir semantics.
- A dedicated restricted service identity and trusted storage directory for checkpoints/replay records.
- Outbound egress firewall for browser traffic; allowlist source code is not sufficient to prevent DNS rebinding/SSRF.
- Playwright and its browser binary only if browser capability is enabled.
- Trusted secret injection, authorization grant verification, audited official agent host implementation, and verified test receipts before enabling any external mutation.

Environment:
- `LAZY_CHECKPOINT_FILE`: optional trusted checkpoint path. Gateway exposes read-only checkpoint capability when set.
- `LAZY_BROWSER_ORIGINS`: optional comma-separated public HTTPS origins. Keep unset by default.
- No production API key, cookie, OAuth token or user secret belongs in repository source or sample config.

Example client process configuration:
```json
{"mcpServers":{"lazyprompting":{"command":"node","args":["src/gateway/mcp-gateway.mjs"]}}}
```
This is illustrative only. ChatGPT does not automatically install or run a GitHub repository as an MCP plugin.

Source-only build stage: no actual deployment, live host connection, native Node runner or browser test has occurred.

Release gates: pin official agent protocol and MCP version; run native and integration QA; verify network isolation, authorization, crash/replay and costs; explicitly approve deployment.
