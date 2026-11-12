# LazyPrompting — Stable Product Context

## Mission

LazyPrompting is an operator-controlled desktop and MCP supervisor for **any verified compatible AI client**, with **ordinary persistent ChatGPT Chat as the fixed conversational target**. It uses host-approved goals and independently verified evidence to avoid blind continuation. It is not a model broker, alternate ChatGPT consumer API or unattended web-output scraper.

## Selected product boundaries

- Any authenticated MCP-capable AI may request an approved, scoped goal; deterministic coordination remains native-host owned. ChatGPT ordinary Chat is the only selected conversational destination (no Temporary Chat or Work). The original persistent conversation is preferred after crashes; unverifiable session identity requires manual recovery, not silent replacement. ChatGPT consumer automated transport is **NOT AVAILABLE**. GitHub/source and native checkpoints, not chat history, provide engineering evidence. See [universal chat-first product contract](docs/architecture/universal-chatgpt-workflow.md).
- The installed four-tool MCP facade is client-neutral. Existing `goal_run.*` runs Codex V1 tasks/worktrees; dormant `agent_run.*` V2 permits prepared scope/status but **no worker dispatch**. Proposed `chat_goal.*` is separate and NOT REGISTERED. An OpenCode MCP client is not a running OpenCode worker. The ChatGPT arithmetic probe is diagnostic only.
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
- `docs/architecture/universal-chatgpt-workflow.md`: selected chat-first product and exact role/transport requirements.
- `docs/architecture/codex-chat-workspace-plan.md`: historical Codex-specific design, not the current product authority.
- `docs/operations/current-state.md`: only active status and next action.
- `docs/validation/README.md`: verification and acceptance selection.

