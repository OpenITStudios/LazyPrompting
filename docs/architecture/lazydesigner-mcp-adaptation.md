# LazyDesigner MCP Architecture Adaptation

## Pinned reference
`OpenITStudios/M-LazyDesigner` branch `Local` HEAD `4015a05518b17f978adf10d29e0374183b2a283d`.

Reviewed:
- `mcp/AGENTS.md` blob `fdf85aff90519a453a50a42a5dd8bdc222e8f1e4`
- `mcp/gateway/ARCHITECTURE.md` blob `b95f4807bcdbaf43f2132e715a7ac87375d9b705`
- `mcp/gateway/README.md` blob `d9fe70ad90a468bcd099c31dc2125d823bd680c7`
- `mcp/gateway/capabilities/README.md` blob `49d5c323d5fe58451cf220c5ae2301244789123b`
- `.agents/skills/lazydesigner-mcp-development/SKILL.md` blob `52049f740c9e4410bf57c54d30002dc9fa8f8da7`

## Adapted contracts
1. Four stable public MCP tools, backed by a declarative capability registry.
2. Compact search-first discovery, deferred schema detail and exact-name invoke.
3. Persistent client-facing gateway; runtime/backend is disposable.
4. No background heartbeat or polling. Recovery occurs on explicit demand.
5. Unknown capability and missing readiness fail closed.
6. No automatic retry of uncertain mutations; require evidence reconciliation.
7. Structured results are authoritative; avoid duplicating full payloads in text.
8. Distinct owners for Gateway protocol, capability registry, runtime adapter, and control.

## Product-specific differences
LazyDesigner connects to a Blockbench runtime with project UUID and authoring phase affinity. LazyPrompting connects to a supervisor, checkpoint, evidence, approved browser and future official agent transport. There is no Blockbench project affinity or Geometry/Texturing/Animation stage. LazyPrompting's immutable goal ID, branch, source SHA and task ID replace those concepts.

## Source implementation
`src/gateway/capability-registry.mjs`, `capability-router.mjs`, `mcp-gateway.mjs`. Four public tools. Existing initial `src/mcp/server.mjs` is superseded, not deleted. No live MCP host, browser or agent transport is connected.

## Proof ceiling
SOURCE_COMMITTED only. No native Node tests, MCP protocol conformance, browser execution or live host integration performed per user code-first instruction.
