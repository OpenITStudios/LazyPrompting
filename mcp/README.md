# LazyPrompting MCP — Persistent Gateway

Canonical MCP entrypoint: `node src/gateway/mcp-gateway.mjs`.

Inspired by the pinned LazyDesigner MCP architecture, this Gateway exposes **four stable public tools**:
- `status`
- `search_capabilities`
- `describe_capability`
- `invoke_capability`

Internal capabilities are registered in `src/gateway/capability-registry.mjs`; schema is requested on demand. The legacy `src/mcp/server.mjs` remains temporarily for compatibility, not as the canonical public contract.

Default capability surface: supervisor status/evaluate. `checkpoint.read` requires `LAZY_CHECKPOINT_FILE`. Browser capabilities require an explicit `LAZY_BROWSER_ORIGINS` HTTPS allowlist and Playwright; a host-level egress firewall is required for safe deployment.

No ChatGPT-Web scraping, automatic dispatch, GitHub mutation, credential exposure, or background worker is enabled through this MCP Gateway. Current source is not connected to this ChatGPT session and has not passed live MCP conformance.

See `docs/architecture/lazydesigner-mcp-adaptation.md` for exact reference provenance and `docs/architecture/runtime-integration.md` for deployment limitations.
