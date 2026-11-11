# Codex App Server terminal-event correlation — 2026-11-11

**Working source baseline:** `OpenITStudios/LazyPrompting:Local` at
`b2893ab3195d3c60b62bfbf93310ffb1fef9045f`.
**Gate:** M2 source integration, **not** installed/native/consumer ChatGPT acceptance.

## First wrong owner

The managed `runReadOnlyGoal` path already starts and queries official Codex
App Server turns, but discarded its `onEvent` notifications. A turn whose
status was later queried as `completed` was indistinguishable from a turn
for which the running process had actually received the documented terminal
notification. This matters for restart, interruption, late status messages
and end-to-end provenance.

## Implemented (no new durable state owner)

- `src/transport/codex-terminal-events.mjs`: bounded process-local recorder
  for **only** the owned child process's `turn/completed` notifications.
  It binds exact `threadId`, `turn.id`, terminal `turn.status`, refuses
  unknown/malformed events, rejects cross-thread and cross-turn evidence,
  handles duplicates idempotently, and treats contradictory terminal
  notifications as `CONFLICT`. It never accepts UI status or model input.
- `src/transport/goal-codex-runner.mjs`: passes a recorder callback to the
  existing `CodexAppServer`, then correlates each completed status-query
  result with the recorded terminal event *before* reconciling the original
  `PromptOutbox`. A failed/interrupted/contradictory notification blocks
  result release with `GOAL_TURN_TERMINAL_EVENT_CONFLICT`.
  The canonical `report.json` task-turn entry records either:
  `EVENT_AND_QUERY_CORRELATED` or `TURN_STATUS_QUERY_ONLY`. If a process
  restarts and the old notification cannot be observed, it must not claim
  the event existed.
- `apps/desktop/src-tauri/src/goal_runs.rs`: the existing
  `goal_run.turn_receipt` read-only capability now validates optional
  persisted `terminalObservation` against the approved task's exact
  thread and turn, rejects a forged `hostAttested=true` or wrong source,
  then returns `processNotificationObserved` and
  `turnObservationKind`. Old reports without the field remain
  `LEGACY_RECORD_ONLY`.
- The returned native fields remain
  `finalTurnHostAttested=false`, `qa=NOT_EXECUTED`,
  `acceptancePassed=false`, `nextPromptAllowed=false`.
  Process notification + status query is **not** cryptographic host
  attestation or a verified QA result. This does not authorize further
  prompts, ChatGPT Web automation, or writes to other repositories.

## Executed verification

- Linux x64 Node v22.16.0:
  `node tests/run-codex-terminal-events.mjs` — **29/29 PASS** on the
  exact staged new module and test blobs. Includes duplicate, early,
  ambiguous, overflow, failed/interrupted, cross-thread and cross-turn.
- Static source inspection of staged runner and Rust blobs:
  **18/18 source assertions PASS** for event callback, correlation,
  fail-closed status, canonical report and native proof limits.
- Reproducible `tests/run-codex-terminal-wiring-source.mjs` added to manual
  `preflight:localtest`. Exact checkout command not independently executed
  in the full repository; its static predicates were checked against staged
  source blobs.
- `tests/goal-run-terminal-events.test.mjs` authored for the **actual**
  `runReadOnlyGoal` with injected fake Codex App Server: matching event,
  no event/query fallback, cross-thread event, and conflicting terminal
  event with retained pending outbox. This full integration runner is
  **TEST_AUTHORED_NOT_RUN** on the combined repository (no full local
  checkout in the isolated runner).
- Rust unit tests extended for observation provenance/mismatch, but
  **Cargo fmt/check/test, installed Windows MCP and live Codex App Server
  remain NOT_EXECUTED**. GitHub CI run on this commit is not implied.

## Required next gate (M2)

1. Execute the three new Node tests plus whole repository regression suite
   and Windows `cargo fmt --check`, `cargo check`, `cargo test`
   on one exact source SHA. Do not confuse static checks with compilation.
2. In the installed desktop, verify that the app-server notification
   actually supplies `params.threadId` and a final `turn.id/status`,
   matching the pinned Codex CLI version. A missing field must fall back
   safely; do not invent completion events.
3. Bind the observed terminal metadata to authenticated native host process
   identity, original operator approval, source scope and independent QA
   receipt. Reuse canonical registry/outbox/checkpoint owners.
4. Prove restart/uncertain send, wrong session, event reordering, duplicate
   notifications, STOP and two active workspaces.
5. Ordinary ChatGPT consumer Chat remains a **separate gated product
   target**: no unsupported unattended send, DOM output extraction,
   session impersonation or arbitrary plugin auto-rebinding.

**Official protocol reference:** https://learn.chatgpt.com/docs/app-server
(`turn/completed` with final statuses `completed`, `failed`,
`interrupted`). See
[active checkpoint](../operations/current-state.md) and
[MCP boundaries](../../mcp/ARCHITECTURE.md).

## Follow-up: unknown-status, capacity and restart conflict hardening

This section **supersedes the historical unexecuted Node integration claim
above for the limited isolated Node runner**. It does not supersede the
Windows/Rust/native/real Codex acceptance blockers.

- `CodexTerminalEvents.observe` now records a malformed
  `turn/completed` status **when thread and turn IDs are valid** as a
  conflicting event, instead of treating it as an unseen event. A subsequent
  valid event does not repair poisoned evidence. When the bounded event
  capacity is exceeded, an unseen turn returns `CONFLICT` rather than
  silently falling back to query-only evidence. Previously recorded event
  identities remain distinguishable.
- `runReadOnlyGoal` persists
  `GOAL_TURN_TERMINAL_EVENT_CONFLICT` as `RECONCILE_REQUIRED` and, on
  a later `resume`, **does not replay or query that conflicted turn**.
  This closes a restart gap: process-local conflict evidence must not
  disappear merely because the next process receives no old event.
  Separate operator-authorized reconciliation is required to release
  this state. The original ACKed prompt remains pending.
- Added targeted negative and two-workspace concurrency cases to the
  already-registered Node test files.

### Executed on the exact reconstructed source

**Linux, Node v22.16.0, sandboxed temporary files; no network or model:**

| Command | Evidence |
| --- | --- |
| `node tests/run-codex-terminal-events.mjs` | **34/34 assertions PASS**; unknown terminal status, poisoned identity, capacity conflict, existing tests |
| `node --test tests/goal-run-terminal-events.test.mjs tests/goal-run-recovery.test.mjs` | **8/8 subtests PASS**; includes restart-after-conflict hold, unknown/failed event, parallel thread isolation, legacy ACK recovery |
| Four unchanged supervisor/storage contract runners | **202 assertions PASS** (32+68+69+33); independent injected-host and real-file storage fixtures |

**Source provenance:** `goal-codex-runner.mjs`, `codex-terminal-events.mjs`,
`PromptOutbox`, `publishStateFile`, both integration test files, and the
terminal-event assertions were matched byte-for-byte to Git object blob
hashes, then executed in an isolated Node source fixture. The production
`CodexAppServer` and coding-worktree imports were replaced by
**throw-only test stubs**; only injected mock Codex event/status methods
were called, with `coding=null`. Therefore this is exact-source
read-only runner integration evidence, **not** a full production checkout,
Codex CLI login, native event attestation or Windows acceptance.

**Not executed:** full repository npm preflight, actual official Codex
process, Cargo build/tests, installed native MCP, authenticated host
approval and live consumer ChatGPT Chat transport. No automatic next
prompt was enabled.
