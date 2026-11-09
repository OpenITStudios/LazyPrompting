# Current State — Single Active Continuation Owner

**State:** FOUNDATION_ARCHITECTURE
**Branch:** `Local`
**Implementation:** MCP_BROWSER_EVIDENCE_ORCHESTRATOR_BROKER_SCHEDULER_SOURCE_AUTHORED
**Browser runtime:** PUBLIC_HTTPS_ALLOWLIST_ADAPTER_AUTHORED_NOT_EXECUTED
**Codex model/control integration:** OFFICIAL_HOST_CALLBACK_INTERFACE_ONLY; NO_REAL_CODEX_TRANSPORT
**QA:** PERMISSION_FUNCTION_28_OF_28_PASS; SUPERVISOR_FUNCTION_30_OF_30_PASS; CHECKPOINT_FUNCTION_22_OF_22_PASS; NATIVE_NODE_RUNNERS_NOT_EXECUTED

## Approved focus
Align all relevant OpenITStudios governance and agent rules 1:1 in engineering discipline, then build an independent LazyPrompting foundation with OpenITStudios-aligned governance, source provenance, bounded/context-aware continuation, cost-efficient deterministic decisions and Harness² evaluation design.

## Durable decisions
- ChatGPT stays the primary human-facing workspace; GitHub is canonical source.
- Follow the latest actual work context rather than sending blind "ya lanjutkan".
- Minimize controller usage: rules first, small model fallback only for uncertainty.
- Lightpanda is of interest but its ability to operate ChatGPT Web is unverified.
- Complete foundation architecture and gates before implementing any autonomous browser code.

## Unresolved
- Exact supported external supervisor-to-Codex/ChatGPT transport for the desired workflow.
- Lightpanda login, UI and streaming compatibility if independently pursued.
- Runtime language, official API credentials, isolation and cost budgets.
- Real quality and usage numbers.

## Next
Next: implement durable authorization replay tracking and trusted evidence receipts, then official Codex transport, strict MCP schemas and deployment packaging. User deferred local tests; do not claim operational completion.

## Latest bounded change
- Added source-only permission evaluator, 13 positive/negative cases, and skill admission guidance.
- Permission cases have NOT been executed against the GitHub revision; this is not runtime authorization.

## Current security correction
- Write preflight now returns ASK, not ALLOW, for a claimed approval token. Only trusted host evidence can grant a real write.
- OPERATE lane is disabled even for source reads.
- 13 cases authored; runtime results remain NOT_EXECUTED. No claim of PASS.

## Permission evidence — 2026-11-10
- Pinned source revision `d2ccfecc21b11816eaa2311315b9d853ec50da69`: 13/13 expected decisions matched in an isolated JavaScript function-level harness with exact GitHub source and config.
- See `docs/validation/permission-evaluation-2026-11-10.md` for method and limitations.
- This is NOT the native Node runner on an exact checkout and NOT a live permission broker test.

## Latest governance QA — 2026-11-10
- 28/28 permission decision cases matched expected outcomes at source ref `e7fd6cb5b6b505ae7618469fe638f73184f7f196` in isolated JavaScript function execution with exact fetched configuration.
- Added `docs/governance/trusted-tool-broker.md` as an architecture contract only; no broker implementation or native Node runner was executed.
- Current permission test scope does not establish race-condition safety or actual enforcement.

## Latest architecture/provenance iteration
- Added `docs/architecture/supervisor-state-machine.md` with context-aware decision priority, duplicate/retry safety, STOP guards and zero-model-first policy.
- Extended `docs/governance/provenance-matrix.md` with pinned skill registry, permission owner, eight-lens and Blockbench root evidence.
- No new skill or autonomous browser runtime has been installed. State machine is design only; no runtime PASS claimed.

## Latest supervisor implementation
- Pure deterministic engine committed at `src/supervisor/decision-engine.mjs` with 24 frozen scenarios and Node runner source.
- At exact source ref `0c10187c844d32f97f875618c89ebf6346cf9510`, 24/24 expected decisions passed function-level JavaScript execution; see `docs/validation/supervisor-evaluation-2026-11-10.md`.
- Native Node runner, official transport, evidence reconciler and browser runtime remain NOT_EXECUTED / NOT_IMPLEMENTED.

## Latest hardening iteration
- Source at `543af59cfd39fa46d3594cb2a4858ed922d51c56`: 30/30 decision cases passed isolated JavaScript function execution after a failed-first control-character regex correction.
- Added `docs/architecture/evidence-reconciler.md` as an unimplemented trust-boundary contract.
- See `docs/validation/supervisor-hardening-2026-11-10.md`. Native runner, broker, checkpoint persistence and transport remain NOT_EXECUTED / NOT_IMPLEMENTED.

## Checkpoint iteration — 2026-11-10
- Added `src/supervisor/checkpoint-transition.mjs` and 22 frozen replay/recovery scenarios.
- At exact source commit `ec8a1265d33bdd892a21c4a120e25e4a6dd3b77f`, 22/22 passed isolated JavaScript function execution; see `docs/validation/checkpoint-evaluation-2026-11-10.md`.
- No persistent storage, native Node runner, trusted evidence broker or browser/Codex transport was executed.

## Durable checkpoint store iteration — 2026-11-10
- Added `src/supervisor/checkpoint-store.mjs` with exclusive single-host lock directory, CAS version transitions, synced temporary file + atomic rename and restart reconciliation state.
- Authored 11 Node filesystem scenarios in `tests/run-checkpoint-store.mjs` and documented limitations in `docs/validation/checkpoint-store-proof.md`.
- This store and its filesystem tests have NOT been executed; no crash-durability or end-to-end recovery PASS is claimed.

## MCP/browser implementation — 2026-11-10
- User explicitly requested beginning MCP and browser source implementation while remaining in ChatGPT/GitHub workflow.
- Added read-only stdio MCP server with status/evaluate/checkpoint-read tools; optional Playwright adapter restricted to localhost test origins.
- Authored MCP smoke and browser origin contract tests, but neither Node runner nor real Playwright/browser session has been executed.
- MCP server is not connected to ChatGPT, Codex or an installed host; browser adapter is not exposed as an MCP tool.
- No ChatGPT-Web scraping or automatic prompting is implemented.

## Source-first implementation expansion — 2026-11-10
- User explicitly deferred local testing and requested building all system code first in ChatGPT/GitHub.
- Added remote public HTTPS allowlist browser source and optional MCP read-only browser tools, GitHub HEAD evidence adapter, official-host callback adapter, and one-step orchestrator with reserve-before-dispatch.
- Added package manifest and runtime integration documentation.
- No native execution, MCP host connection, browser session, real Codex API, trusted broker or end-to-end unattended operation has been verified.
- Browser DNS rebinding/SSRF requires host egress enforcement; source restrictions are insufficient alone.

## Source-first broker/scheduler iteration
- Added `src/governance/authorization-broker.mjs` with trusted-host grant callback, Local-only branch, exact SHA and process-local replay guard; durable replay protection is still missing.
- Added `src/supervisor/scheduler.mjs` as an explicitly invoked bounded tick controller, not a background autonomous daemon.
- Reconciliation now requires an independent `verifyResult` callback instead of accepting worker-provided `trustedEvidence` as authority.
- Added source-only broker tests and `docs/architecture/source-completion-plan.md`; no native execution or real host integration performed.
