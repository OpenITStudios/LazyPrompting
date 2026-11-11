# Goal-review checkpoint hardening and durable recovery — 2026-11-11

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Evidence:** executed Node.js v22.16.0 on Linux with fake native host and fake GitHub/source callbacks; **no** installed Windows/Rust/ChatGPT runtime proof.

## Scope

1. `src/prompt/github-goal-review.mjs` now requires the canonical checkpoint to match `goalId`, `WAITING` phase, pending task, HEAD and a nonnegative CAS version before any verified-turn or GitHub read. Optional workspace/session/project/hash bindings are checked when present. `inspectUnderLease` is a read-only hook for a trusted host **already holding** the common scheduler lease; ordinary `inspect` still acquires its own.
2. `src/prompt/goal-review-reconciliation.mjs` introduces a source-level **host-injected** transition. Its dependencies are the existing `WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`, one scheduler lease, an authenticated exact project-head reader, and a native-authorization callback. The review is recomputed in-process; no model-provided review blob or browser UI state grants authority.
3. `src/supervisor/checkpoint-transition.mjs` adds `REVIEW_PREPARE` and `REVIEW_COMMIT`. A verified prepare stores the exact goal/workspace/session/task/prompt/response/head and a deterministic review digest in the **existing** checkpoint, leaving it `RECONCILE_REQUIRED`. Registry head CAS and outbox `RESPONSE_VERIFIED` are reconciled before the final commit can move to `READY` or accepted `DONE`.
4. The existing `RESULT` event refuses to bypass an unresolved prepared review. `STOP` and `PAUSE` continue to override it. No new MCP public tools or any ChatGPT command were added.

## Executed tests

| Runner | Result | Scope |
| --- | ---: | --- |
| `node tests/run-goal-review-scope-hardening.mjs` | 62 assertions PASS | Exact-goal/phase/task/version and optional scope matching; UI-only turn rejection; read-only lease boundary |
| `node tests/run-goal-review-reconciliation.mjs` | 95 assertions PASS | File-backed fake host/registry/outbox/checkpoint, prepared intent, registry/outbox updates, restart after four simulated interruption points, trusted authorization, source HEAD movement, STOP and idempotency |
| Ad hoc `transitionCheckpoint` legacy smoke | PASS | Pre-existing reserve, dispatch acknowledgement, result, STOP and wrong-goal rejection |

**Source matching:** the five implementation and new test blobs for `github-goal-review.mjs`, `goal-review-reconciliation.mjs`, `checkpoint-transition.mjs`, and the two new focused runners were matched byte-for-byte to the locally executed files before branch commit. An existing `run-github-goal-review.mjs` fixture was updated to supply the stronger checkpoint contract but its full old suite was **not** rerun in this isolated environment.

**Limits:** these file-backed test doubles do not substitute for real `CheckpointStore`/`WorkspaceRegistry`/`PromptOutbox` integration tests; no Windows native IPC, installed MCP, provider grant, Rust/Cargo, external GitHub API, official ChatGPT completion, or production browser automation was executed.

## Restart contract

- After `REVIEW_PREPARE` but before registry mutation: retry the prepared intent, **not** the original prompt.
- After registry CAS: verify `lastGoalReviewId`, then reconcile the original outbox acknowledgement exactly once.
- After outbox response verification: verify persisted state, recheck source HEAD and commit checkpoint without replaying the prompt.
- After `REVIEW_COMMIT`: recovery reports `ALREADY_RECONCILED`; no new dispatch is granted.
- Wrong goal/branch/session/response or no native authority, concurrent HEAD movement, STOP or unknown side effects remain `BLOCKED`/`RECONCILE_REQUIRED`. In every result, `nextPromptAllowed=false`.

## Unresolved / next

The default Node gateway still does not inject a goal reviewer; installed Rust desktop MCP has no provider. Source composition is **not yet production-wired**. Before any dispatch capability:

1. Run the new and existing test suites with actual file-backed owners and an exact-SHA Windows Node/Cargo build.
2. Verify native host process identity, scoped source credentials, single-use approval, shared scheduler lease, response provenance and restart operation on the installed application.
3. Resolve authorized ChatGPT Classic/Personalized Temporary Chat transport and reliable final-turn completion independently. Keep consumer ChatGPT Web automation off when unsupported.
4. Benchmark long GitHub reads outside the global scheduler critical section only after a safe snapshot/revalidation design is proven.

See the [active checkpoint](../operations/current-state.md), [architecture](../architecture/codex-chat-workspace-plan.md) and [MCP ownership](../../mcp/ARCHITECTURE.md).
