# LazyPrompting MCP — Nearest-Owner Rules

Inherit root `AGENTS.md` and `GITHUB_RULES.md`. The authoritative [surface and trust map](ARCHITECTURE.md) defines four distinct roles; no MCP name alone grants a capability.

- Installed Windows stdio MCP: `apps/desktop/src-tauri/src/mcp_stdio_host.rs` and native pipe/host in `apps/desktop/src-tauri/src/`. This is the normal installed local stdio MCP surface for any conforming client, including Codex and OpenCode. **Worker execution remains Codex-only** until the versioned [universal agent design](../docs/architecture/universal-agent-orchestrator.md) passes its gates.
- Packaged internal Node gateway: `src/gateway/mcp-gateway.mjs` for protocol framing, `capability-registry.mjs` for metadata, and `capability-router.mjs` for exact-name execution.
- `src/mcp/server.mjs` is legacy opt-in compatibility, not a second supported production catalog.
- `src/mcp/chatgpt-probe.mjs` and its widget are experimental arithmetic probes only, not a ChatGPT Web scraping/continuation engine.
- `src/browser/` owns adapters, `src/transport/` owns Codex bridges, `src/supervisor/` owns scheduling/checkpoints and `src/governance/` owns authorization/replay; no layer may grant itself host authority.

Keep `status`, `search_capabilities`, `describe_capability`, `invoke_capability` fixed on both current MCP facades, while acknowledging their **different capability catalogs**. New capabilities belong to their exact native or gateway owner; no gratuitous entrypoint relocation, duplicate public tool or automatic retry of uncertain mutations.

A GitHub commit is `SOURCE_COMMITTED`, not a passed Windows integration, an authenticated live connection or production acceptance.
