# LazyPrompting — Stable Product Context

## Mission

LazyPrompting is an operator-controlled desktop supervisor that advances approved engineering goals through **official Codex interfaces**, reuses verified evidence, and avoids repeated generic prompts and wasted AI work. It is not a replacement reasoning model, an unattended ChatGPT Web scraper, or a multi-model routing product.

## Selected product boundaries

- Human discussion and operator approval remain in ChatGPT. For the **proposed Codex-supervised chat-workspace product**, the user sends one scoped goal to Codex; Codex supervises while ordinary, persistent ChatGPT Chat (non-temporary) is the sole intended conversational worker. Temporary Chat is explicitly withdrawn by the operator on 12 November 2026. Reuse and reattach the same conversation after app/browser crashes rather than creating a replacement; if the original conversation cannot be verified, pause for operator recovery. GitHub is canonical for code and exact evidence; even persistent chat history is not a substitute for an authenticated project checkpoint. This target is DESIGN ONLY until compliance, transport and installed Windows gates pass.
- Current implementation includes managed Codex task execution via `goal_run.*` and experimental ChatGPT probe. These are distinct from the **proposed** Codex-controlled `chat_goal.*` workflow; do not equate a source module or fixture with live autonomous ChatGPT operation. No additional browser reasoning model is intended.
- Tauri/Rust hosts the Windows desktop; Svelte renders the UI. The operator has ten workspace slots in a WebView2 profile shared among workspace views, separate from the application shell profile.
- The installed Windows MCP facade and desktop-owned Node gateway are distinct trust/process paths; see [MCP ownership](mcp/ARCHITECTURE.md). Lightpanda is a separate private preview backend, **not** a WebView2 tab.
- Native host owns process identity, approvals, scope, grants, cancellation and durable recovery. Neither renderer state, model output nor MCP initialization constitutes authorization.
- Deterministic decisions come before model inference; per-goal context, concurrency, tokens, retries and STOP conditions are bounded.

## Source and evidence boundaries

Source contains desktop browser controls, Rust MCP/IPC host, Node gateway, supervised Codex goal runs, preview integration and tests. The former source-only handoff description is historical: selected native Windows and staged-gateway checks are recorded in the [archived checkpoint](docs/operations/history/2026-11-10-full-checkpoint.md). This statement **does not** certify the current revision or full installed ten-workspace end-to-end acceptance.

Use [current state](docs/operations/current-state.md) for the single live continuation and proof limitations. Keep stable rules here; do not append task-by-task progress. This project's active authority is user-selected `Local`; `main` is stable and `Harness` remains preserved.

## Canonical owners

- `AGENTS.md`, `GITHUB_RULES.md`: agent, branch, security and proof discipline.
- `README.md`: product-facing overview and development entry.
- `mcp/ARCHITECTURE.md`: MCP surface and source ownership.
- `docs/architecture/system-contract.md`: intended trust and transport gates.
- `docs/architecture/codex-chat-workspace-plan.md`: selected **proposed** chat-workspace design and P0 feasibility boundaries, not a functioning transport.
- `docs/operations/current-state.md`: only active status and next action.
- `docs/validation/README.md`: verification and acceptance selection.

