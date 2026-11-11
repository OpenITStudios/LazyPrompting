# Native approved Codex goal-turn receipt — 2026-11-11

**Repository / branch:** `OpenITStudios/LazyPrompting:Local`.
**Pinned prior HEAD:** `f864413eab34da0bc80cbd8b9b0b1668fe8eac57`.
**Purpose:** M2 first native integration step, scoped to a **read-only persisted
Codex goal-run turn receipt**, not an autonomous ChatGPT transport.

## Source change

The installed Windows MCP facade continues to expose precisely four
public tools. It now advertises one deferred read-only capability
`goal_run.turn_receipt` with `runId`, `taskId`, and `turnId` input.
It uses the existing `goal_run.*` dispatch through the authenticated
named-pipe path into the native `goal_runs.rs` owner.

The native Rust handler reads the approved run record from the existing
per-user app-local `goal-runs` folder; rejects unapproved and stopped
runs, validates task ID **before** forming a file path, and correlates:

- Exact approved run ID, project branch, base SHA and mode.
- The exact task slot/acceptance criterion, thread ID and recorded turn ID
  from the durable `report.json` written by the controlled Node gateway.
- A uniquely matching `RESPONSE_VERIFIED` row in the **existing**
  per-task `PromptOutbox`: workspace, session/thread, task-turn index,
  response handle, response ID, and prompt ID.

Only metadata are returned. The receipt includes
`kind=CODEX_TURN_RECORD`, `source=NATIVE_APPROVED_GOAL_RECORD`,
`recordedCompleted=true`, `finalTurnHostAttested=false`,
`qa=NOT_EXECUTED`, `acceptancePassed=false` and
`nextPromptAllowed=false`.

**Meaning:** this proves, once native code runs successfully, that two
persisted records agree on the particular Codex turn. It does **not**
independently attest a live `turn/completed` event, success of a
verification command, goal acceptance, or permission to dispatch. The
report and outbox are native-owned paths but originate from the same
Node executor; source correlation is not cryptographic provenance
from the Codex service.

This read-only capability does not add a new outbox/checkpoint owner,
new MCP public tool, or any ChatGPT Web send/response feature.

## Test evidence — carefully bounded

- V8 source audit against exact staged Rust file blobs:
  **29/29 static source assertions PASS**, covering native route,
  explicit input identity, path validation before file reads, approval,
  STOP, project SHA, mode, task/thread/turn/response correlation,
  and false-success-prevention flags.
- Reproducible source-contract runner
  `tests/run-native-goal-turn-receipt-source.mjs` added to manual
  preflight. Its **exact committed Node execution** is not yet recorded.
- Rust `goal_turn_receipt_requires_matching_approved_source_records`
  unit test authored with valid record, wrong session, missing verified
  outbox status, wrong response ID, wrong base SHA, invalid task ID,
  path traversal and unknown turn. It has **NOT been executed**.
- Existing Linux Node v22.16.0 regression runners rerun and PASS:
  real storage 68, verified goal composition 32, structured feedback
  69, trusted review 33 (202 assertions total, unchanged Node source).
- `cargo fmt --check`, `cargo check`, `cargo test`, installed
  Windows MCP named-pipe round-trip and real Codex App Server turn
  observations remain **NOT_EXECUTED/NOT_VERIFIED**. CI has not been
  dispatched.

## Acceptance gate to finish M2

1. Windows Cargo build/test and direct MCP call:
   `search_capabilities` -> `describe_capability` ->
   `invoke_capability(goal_run.turn_receipt)`. Confirm one approved
   real Codex turn produces exact correlation; wrong IDs, STOP or
   conflicting files fail closed.
2. Host must independently attest the real official Codex App Server
   terminal turn, process/session identity and permitted scope. The
   persisted correlation receipt itself must never be promoted into
   a `TRUSTED_HOST` live result by the model or MCP caller.
3. Bind the native host to the existing
   `createVerifiedGoalRuntime` without adding a second source of truth.
   Exact workspace/goal/source/QA receipts, native approval and STOP
   remain separate gates.
4. Repeat restart, uncertain outcome, multi-workspace and branch movement
   tests on the installed Windows app. Keep consumer ChatGPT Classic
   automation OFF until its own permitted transport is established.

See [goal-run architecture](../architecture/goal-run-mcp.md),
[MCP boundaries](../../mcp/ARCHITECTURE.md) and
[active state](../operations/current-state.md).
