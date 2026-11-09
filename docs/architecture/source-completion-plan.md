# Code-first Completion Plan

**User directive:** build source in ChatGPT/GitHub first; defer local test runs. This is not authorization to claim runtime completion.

## Source modules
- MCP stdio server and read-only browser tools: authored.
- Playwright remote HTTPS allowlist adapter: authored, unverified.
- Deterministic decision engine and bounded checkpoint transitions: authored, function-level evaluated earlier.
- Durable checkpoint file store: authored, native filesystem QA not run.
- GitHub HEAD evidence adapter: authored, not a full evidence reconciler.
- Official agent callback transport: authored, not a Codex API implementation.
- Trusted authorization broker: source authored, in-memory replay guard only.
- Single-tick scheduler: source authored, not a background autonomous service.
- Orchestrator: source authored, host callback integration not verified.

## Remaining source engineering
1. Durable broker grant/replay storage and actual trusted host grant issuance.
2. Strict schema validation and real evidence/test receipt reconciliation.
3. Official supported Codex API integration with documented request/response schemas.
4. Supervisor run loop, concurrency controls, queue and rate/cost budgets.
5. Browser network isolation and deployment policy; allowlist source alone is insufficient.
6. MCP protocol conformance, packaging, host integration and secrets configuration.
7. Comprehensive tests authored now, executed only when user authorizes QA stage.

## Hard security boundary
No unattended ChatGPT Web automation. Browser adapter may browse expressly allowlisted public HTTPS sites only after host egress policy and authentication checks. The ChatGPT conversation is not the same thing as a detached API worker session.

## Current proof
SOURCE_COMMITTED only for newly authored broker and scheduler. No claim of connected MCP host, browser runtime, durable replay guarantee, official Codex integration or production readiness.
