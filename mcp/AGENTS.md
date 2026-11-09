# LazyPrompting MCP package rules

Inherit root `AGENTS.md` and `GITHUB_RULES.md`. MCP-specific canonical ownership:
- `src/gateway/capability-registry.mjs`: capability metadata and discovery.
- `src/gateway/capability-router.mjs`: exact-name execution routing.
- `src/gateway/mcp-gateway.mjs`: stable MCP public tool surface and stdio framing.
- `src/browser/`: browser execution adapters, not policy/authorization owners.
- `src/supervisor/`: decision/checkpoint/scheduling, not MCP protocol owners.
- `src/governance/`: authorization/replay, not MCP tool schema owners.

Public gateway tools remain `status`, `search_capabilities`, `describe_capability`, `invoke_capability`. Add capability entries rather than new public tools unless explicitly authorized. Discovery is compact, schema is deferred, unknown capability fails closed. Gateway is persistent; backend is replaceable. Do not retry uncertain mutations. No model-supplied approvals.

The current gateway is source-authored only; no host interoperability proof exists. The existing `src/mcp/server.mjs` is legacy initial implementation, not a second canonical public tool contract.
