# Current State — Single Active Continuation Owner

**State:** FOUNDATION_ARCHITECTURE
**Branch:** `Local`
**Implementation:** GOVERNANCE_PREFLIGHT_SOURCE_AUTHORED
**Browser runtime:** NOT_CONNECTED / NOT_EXECUTED
**Codex model/control integration:** NOT_IMPLEMENTED
**QA:** PERMISSION_FUNCTION_HARNESS_13_OF_13_PASS; NATIVE_NODE_RUNNER_NOT_EXECUTED

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
Complete 1:1 agent-skill and provenance audit, extend adversarial permission cases, and establish trusted tool-broker enforcement requirements. Browser implementation remains deferred.

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
