# Structured worker feedback gate — 2026-11-11

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Scope:** bounded host-attested worker result; independent GitHub/QA evidence;
source-only reconciliation gate. This proof does **not** certify
ChatGPT consumer-Web communication, Windows native IPC or installed MCP.

## Changed owners

- `src/prompt/structured-worker-feedback.mjs`: strict result identity
  and envelope, bounded text/pointers, exact host attestation, verified
  supported transport and operator scope, allowed-action validation.
- `src/prompt/trusted-goal-review.mjs`: the GitHub reviewer receives
  *only* a host-attested next-action proposal. Untrusted MCP
  `proposal` inputs are discarded. Without QA or commit progress, a
  verified short worker summary remains available for targeted human/Codex
  review, but there is no automatic continuation.
- `src/prompt/goal-review-reconciliation.mjs`: refuses to prepare
  or commit a review without verified worker feedback and SHA-256 result
  fingerprint; binds that fingerprint into the same durable checkpoint.
- `src/supervisor/checkpoint-transition.mjs`: validates the worker
  feedback hash in `REVIEW_PREPARE`, and records it in `lastReview`.
- Existing untrusted direct `GitHubGoalReview` can still provide
  **read-only preview** through the currently host-injected internal
  capability; its proposal does not authorize a durable transition.

## Exact executed tests

Local isolated Linux x64 runtime with **Node v22.16.0**, no new AI calls,
no browser, no Windows runtime and no real GitHub HTTP. Git blob hashes
of the four new code/test files were checked against locally executed bytes.

| Command | Result | Scope |
| --- | ---: | --- |
| `node tests/run-structured-worker-feedback-contract.mjs` | **69 assertions PASS** | Host attestation, schema limits, identity binding, transport/operator approval gates, result absence, WAIT/BLOCKED/NEEDS_APPROVAL, forged result rejection |
| `node tests/run-trusted-goal-review-contract.mjs` | **33 assertions PASS** | Host worker proposal replaces caller input, exact GitHub reviewer binding, no-commit/missing-QA summary, no dispatch |
| Node syntax checks for new modules | PASS | JavaScript parser on exact source |
| Additional local exploratory suites | 143 + 47 assertions PASS (not committed) | Expanded negative cases, simulated host and reviewer |

The source modifications to the older `GoalReviewReconciliation` and
`checkpoint-transition` and edits to their fixture have been staged as
Git blobs, but their **full existing suite has NOT been rerun against the
combined new tree**. Therefore the combined runtime is still
`NOT_EXECUTED`, not a regression-free certification.

## Adversarial and fail-closed cases

Invalid goal/workspace/session/task/prompt/response handle/response ID/context
revision; changed repository/branch/base SHA; unknown provider; injected
`trusted` field; oversized or transcript-bearing result; arbitrary next
action; expired or absent transport permission; mismatched fingerprint;
browser `UI_COMPLETED_OBSERVED`; missing result; missing QA receipt; WAIT,
BLOCKED, approval-required. No case grants `nextPromptAllowed=true`.

The trusted host must independently authenticate the final turn and compute
the same fingerprint from its canonical record. Test fixtures returning
`trusted:true` are controlled inputs, not a production attestation.

## Remaining P0

- Bind wrapper and feedback source to installed native Rust MCP using a
  supported host event transport; do not rely on JS test seams.
- Run exact-SHA full Node and Cargo tests with actual repository-backed
  stores, Windows WebView2 and authenticated IPC.
- Prove separately a permitted ChatGPT Classic final-turn + structured
  result transport or retain manual handoff; no output scraping.
- Validate five sequential turns, STOP, restart, no-commit milestone,
  multi-workspace isolation, source receipts and actual acceptance criteria.

See [canonical design](../architecture/worker-feedback-trust-boundary.md) and
[active status](../operations/current-state.md).
