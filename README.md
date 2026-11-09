# LazyPrompting

Context-aware autonomous continuation supervisor for ChatGPT-centric GitHub development.

## Status

**Foundation planning only — browser automation is NOT implemented, connected, tested, or authorized for unattended ChatGPT Web operation.**

## Goal

The user gives one goal in ChatGPT; the supervisor preserves authorized scope, evaluates the latest verified work/progress, and determines a context-specific next instruction. ChatGPT/Codex remain the primary reasoning and implementation surfaces; GitHub is the source-of-truth for code and evidence.

## Design invariants

- Context-aware continuation, never blind repetition of `lanjutkan`.
- Prefer deterministic rules and structured status; invoke a small model only for ambiguity.
- Maintain an evidence-backed goal/decision/progress ledger with one canonical owner, not duplicate trackers.
- Respect explicit branch selection, permissions, pause/block states, and user approvals; no silent merges, deletion, force-push, or release.
- Separate claimed work from actual source/CI/runtime proof.
- No autonomous website interaction until compliance, authentication, capabilities, and host support are verified.
- No automatic scraping of ChatGPT responses; API/official tool paths are the preferred unattended transport.

## Architecture sequence

1. Governance and evidence contract.
2. Conversation state/continuation protocol.
3. Minimal-cost decision policy and evaluator.
4. Transport abstraction (official API/Codex first; browser adapter as separately tested optional module).
5. Harness² isolated benchmarks and failure recovery.
6. Runtime implementation only after architecture and safety gates pass.

Read [AGENTS.md](AGENTS.md), [GITHUB_RULES.md](GITHUB_RULES.md), [CONTEXT.md](CONTEXT.md), and [docs/README.md](docs/README.md) for the canonical project contracts.
