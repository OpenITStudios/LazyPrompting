# LazyPrompting — Stable Project Goal

## Product mission

LazyPrompting is a desktop-oriented, context-aware **Codex continuation supervisor**. An operator supplies an authorized engineering goal; the system observes verified progress, decides the next useful action, and coordinates work through **official Codex interfaces only**. The product is not a replacement AI agent, a multi-model router, or a ChatGPT Web scraping bot.

**Primary success criterion:** move an approved task toward completion without unnecessary AI calls, repeated generic prompts, duplicated context, unsafe browser actions or unsupported progress claims.

## Locked product choices

- **Human workspace:** ChatGPT for planning, approvals and handoff; GitHub for canonical source and exact evidence.
- **Execution AI:** Codex only. No AI candidates, secondary model, or fallback inference model requirement.
- **Desktop:** Tauri + Svelte; approved UI/UX design with 10 workspace slots.
- **Embedded viewer:** WebView2.
- **Automation browser:** Lightpanda via CDP, separate from WebView2; no assumed shared browser session.
- **Integration:** MCP gateway and an authenticated native host authorization channel; use official Codex interfaces.
- **Cost control:** deterministic rules first; bounded context, retries, concurrency, cancellation and STOP.
- **Security:** native host owns approvals and process identity; browser capabilities fail closed until authenticated and scoped.

## Intended execution loop

Goal and constraints → observe verified Codex/GitHub evidence → deterministic decision → minimal authorized Codex task → verify result → checkpoint → continue or stop.

Decision states include CONTINUE, FIX_FAILURE, VERIFY, WAIT, BLOCKED, NO_PROGRESS and DONE. Every claim must identify its proof level.

## Present implementation boundary

The UI and backend foundations exist in source, including MCP routing, Rust gateway session/stdio, resource integrity checks, Windows named-pipe framing/listener and HMAC challenge primitives. **They are not a completed, authenticated or runtime-verified end-to-end system.** Native startup was deliberately left disabled at handoff to prevent launching an unauthenticated gateway.

Still outstanding: trusted packaged gateway dependency closure; authenticated native pipe and grant wiring; official Codex runtime connection; Lightpanda CDP compatibility and scoped browser operations; 10-workspace runtime acceptance.

The operator ended ChatGPT-side development and moved to local engineering. Do not restart implementation, run CI or claim readiness without a new instruction and actual evidence.

## Canonical ownership

- `README.md`: public project overview, goal, architecture and honest readiness.
- `CONTEXT.md`: stable mission and locked decisions (this file).
- `AGENTS.md` / `GITHUB_RULES.md`: execution, permission, branch and evidence policy.
- `docs/architecture/system-contract.md`: technical architecture and IPC requirements.
- `docs/operations/current-state.md`: **only** live continuation/handoff checkpoint.
- `docs/validation/localtest-readiness.md`: acceptance criteria, not proof of execution.
