# Architecture Router

Start with the smallest boundary that owns the question. Proposed designs and previous implementation notes are supporting references, **not** live status owners.

| Concern | Canonical entry |
| --- | --- |
| Entire product / platform / selected transport | [System contract](system-contract.md) |
| **Selected proposed Codex -> ChatGPT Temporary Chat workspace cycle** | [Chat workspace control design](codex-chat-workspace-plan.md) (DESIGN / FEASIBILITY ONLY) |
| Browser extension / alternative engine provenance | [Research and source matrix, 2026-11-11](research-browser-control-2026-11-11.md) (reference only) |
| MCP surfaces, protocol owners, legacy and probe separation | [MCP architecture](../../mcp/ARCHITECTURE.md) |
| Native IPC, gateway and UI grants | [MCP UI control](mcp-ui-control-contract.md) and [gateway lifecycle](gateway-lifecycle.md) |
| Multi-session Codex runs and worktrees | [Goal-run MCP](goal-run-mcp.md) |
| **Worker feedback: source, attestation, result and QA separation** | [Trusted worker feedback boundary](worker-feedback-trust-boundary.md) — source-only gate; never ChatGPT Web extraction |
| Continuation decisions and stop logic | [Supervisor state machine](supervisor-state-machine.md) |
| Prompt and checkpoint composition | [Continuation protocol](continuation-protocol.md) |
| Ten desktop workspaces | [Desktop product](desktop-multi-browser-product.md) and [multi-workspace isolation](multi-workspace-isolation.md) |
| WebView2 versus browser automation | [Browser provider selection](browser-provider-selection.md) and [shared native profile](shared-profile-native-contract.md) |
| UX source/design contracts | [Desktop UI design system](desktop-ui-design-system.md) |

## Supporting implementation topics

- **Supervisor, recovery, response:** `adaptive-*`, `durable-*`, `handoff-*`, `prompt-*`, `response-*`, `scheduler-*`, `trusted-*`, `uncertain-*`, `workspace-health-*` and other focused design notes in this directory.
- **Browser and transport:** [Browser/MCP implementation](browser-and-mcp-implementation.md), [native browser lifecycle](native-browser-instance-lifecycle.md), [shared browser preinstall gates](shared-browser-preinstall-gates.md), [tab recovery](shared-browser-tab-recovery.md), [webview verification](webview-preinstall-verification.md), [transport gate](transport-feasibility-gate.md).
- **Legacy proposals / early source-first plans:** [Runtime integration](runtime-integration.md) and [source completion plan](source-completion-plan.md) document historical assumptions; current code and [active checkpoint](../operations/current-state.md) take precedence.

Use [governance](../governance/README.md) for authorization and security, [validation](../validation/README.md) for proof, and [operations](../operations/README.md) for continuation. This router does not install or activate components.
