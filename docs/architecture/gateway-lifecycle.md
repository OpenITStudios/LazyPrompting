# Gateway Lifecycle and Result Projection

## Source
- `src/gateway/backend-lifecycle.mjs`: explicit-demand connection lifecycle with generation signature, reused handle, invalidation and bounded exponential backoff. It does not poll, run a daemon, or retry uncertain mutations.
- `src/gateway/result-projection.mjs`: bounded structured result projection with fail-closed overflow; full payload is not duplicated into text.
- `src/gateway/mcp-gateway.mjs`: now uses the canonical result projector.
- Source test scripts: `tests/run-backend-lifecycle.mjs`, `tests/run-result-projection.mjs`.

## Source provenance
Architecture adapted from `OpenITStudios/M-LazyDesigner` `Local` at `4015a05518b17f978adf10d29e0374183b2a283d`, especially `mcp/gateway/ARCHITECTURE.md` blob `b95f4807bcdbaf43f2132e715a7ac87375d9b705` and `mcp/AGENTS.md` blob `fdf85aff90519a453a50a42a5dd8bdc222e8f1e4`.

## Integration limits
The lifecycle class is authored but **not yet wired to a real official agent backend**. It cannot prove a persistent backend connection. The MCP Gateway's process-level stdio session is not equivalent to validated reconnectable runtime transport. Result projection is wired into MCP output, but has not been tested with a real client.

The user requested source-first work; no native Node or integration tests were executed. Current proof is SOURCE_COMMITTED only for this iteration.

## Next
Implement a backend interface with explicit health signature and reconnection semantics, then integrate the lifecycle with an official supported agent transport. Keep mutation retry disabled until the authoritative result is reconciled.
