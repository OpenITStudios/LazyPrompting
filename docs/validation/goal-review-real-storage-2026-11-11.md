# Real file-backed Goal Review integration — 2026-11-11

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Base SHA:** `7785c2b68694b5c42ca3c9bdacc731ceddb63c3d`.
**Evidence:** `EXECUTED_TEST_PASS` for Linux x64, Node v22.16.0, exact source blobs with real local file-backed owners. Synthetic/host-injected review, native admission and GitHub HEAD. NOT native Windows, installed MCP, network GitHub API, authorized ChatGPT Chat transport or production integration.

## Problem

Earlier durable review tests provided an in-memory registry/outbox and a simulated checkpoint. They could not demonstrate that the actual repository `WorkspaceRegistry`, `PromptOutbox` and `CheckpointStore` write compatible durable records, release only the verified prompt and recover from interrupted multi-file updates.

## Implemented, reproducible fixture

`tests/run-goal-review-real-storage.mjs` imports **actual repository classes**:

- `src/runtime/workspace-registry.mjs`
- `src/prompt/prompt-outbox.mjs`
- `src/supervisor/checkpoint-store.mjs` and `checkpoint-transition.mjs`
- `src/prompt/scheduler-file-lease.mjs`
- `src/prompt/goal-review-reconciliation.mjs`

For each isolated temporary directory it initializes a canonical workspace, reserves/ACKs one prompt, calls `RESERVE` and `DISPATCH_ACK` on the actual checkpoint, and invokes the production reconciliation class. It verifies checkpoint phase/version, matching review ID and source HEAD, feedback fingerprint, outbox `RESPONSE_VERIFIED`, and zero pending prompts. A restarted instance must not review or send twice.

Three crash cases inject an error **after a real durable write succeeds**: registry mutation, outbox reconciliation and checkpoint mutation. The next instance must resume the already recorded intent. One normal path must be idempotent on repeated recovery. Synthetic host authorization and HEAD callbacks are deliberate: the fixture never sends prompts, authenticates users or accesses the network.

## Executed evidence

- `node tests/run-goal-review-real-storage.mjs`: **68/68 assertions PASS** on Linux x64, Node.js 22.16.0.
- The exact new test blob, byte checked using `git hash-object`, was `bc3e88103fb51e213a38e51583563a1df4f0a5c3`.
- Existing reconstructed dependency sources were also Git-blob-identical to the `Local` revision, including `WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`, `CheckpointTransition`, `publishStateFile`, scheduler lease and `GoalReviewReconciliation`.
- Additional **local exploratory**, noncommitted runners passed 163 and 207 assertions; the latter covered both shared-store workspace isolation and scheduler lock denial. These are supplementary results, **not** substitutes for a committed repeatable runner.
- Prior structured-feedback and trusted-review contract runners were rerun on the same Node environment (69 and 33 PASS).
- `npm run test:goal-review-real-storage` is added to manual `preflight:localtest`. The full checkout preflight, Windows Cargo build and CI were **not executed** by this change.

## What this proves and does not prove

**Proved:** correct file-format compatibility and durable prepare/commit/recovery of one approved, already-reviewed goal against the actual local persistence owners on Linux, without a duplicate next send.

**Not proved:** external result provenance; real Codex App Server `turn/completed` binding; native Windows named pipe/MCP provider injection; native operator grants; live GitHub HTTP; ChatGPT ordinary Chat final-turn callback; full 10-workspace interleaving, performance, packaged installer or release acceptance.

All new review paths remain `nextPromptAllowed=false`. This test does not grant dispatch, create a transport or write another repository.

## Next

1. Add a trusted host composition using the **existing** file-backed owners, verified source adapters and official Codex App Server events, with host-owned operator approval. Do not add another canonical store.
2. Run the full current Node suite and exact-SHA Windows Node/Cargo manual preflight when runner capabilities are available; retain the recorded execution boundary.
3. Validate cross-workspace scheduler admission and authenticated native provider identity before exposing any new production MCP capability.
4. Keep consumer ChatGPT Web automation off until separately permitted and supported final-turn and session binding are proven. If unavailable, use `REVIEW_REQUIRED`/manual handoff.

See [active checkpoint](../operations/current-state.md), [feedback boundary](../architecture/worker-feedback-trust-boundary.md), and [durable review proof](goal-review-durable-reconciliation-2026-11-11.md).
