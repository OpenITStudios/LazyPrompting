# Cooperative Goal Run pause/resume — 11 November 2026

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Starting SHA:** `6ff0645395db97aa5ac70858502ff8c16d5b374e`.
**Scope:** existing native-controlled `goal_run.*` Codex runs, not the
planned ChatGPT consumer-Web automation.

## Implemented

The old `goal_run.control.pause` placeholder returned
`GOAL_PAUSE_UNAVAILABLE`. The source now implements cooperative pause
through the **existing** native operator-approved run and the same canonical
`report.json` / `PromptOutbox` owners:

1. **Native request:** after checking the existing decision,
   `scopeFingerprintVersion`, host epoch and running state, the Rust
   `goal_runs.rs` owner creates an exclusive
   `<stopFile>.pause` file by its existing atomic write helper.
   Status displays `PAUSE_REQUESTED` while the runner has not reached
   a safe checkpoint. A duplicate pause is idempotent.
2. **Node runner:** before a new Codex turn it checks STOP, deadline and
   pause (in that order). A pause does **not** interrupt an already
   acknowledged in-flight turn: the runner observes/reconciles that
   exact turn, persists the checkpoint and stops dispatching new ones.
   The canonical report transitions to `PAUSED`. STOP still overrides
   pause and requests interruption of an in-flight turn.
3. **Resume:** the native host requires a persisted `PAUSED` report,
   matching durable scope, original operator approval, no STOP, and
   the original pause marker. It clears the marker only before the
   existing `gateway.request_codex` launch, restoring the marker if
   launch fails. A requested but nonquiescent pause cannot resume.
   Startup **never** automatically resumes a paused run.
4. **Inconsistent state:** a `PAUSED` report with no marker, an
   incomplete legacy scope or stale host epoch cannot be silently
   upgraded to a runnable state. Marker inconsistency is reported as
   `RECONCILE_REQUIRED` or a stable error requiring operator review.

Pausing **does not extend** the original wall-time deadline or grant
new permissions. If a pause arrives in the narrow interval between a
durable reservation and transport send, the outbox may remain reserved
and require explicit reconciliation rather than being resent. This
fail-closed condition is intentional.

No additional MCP public tool names, separate state store, GitHub
writing authorization, browser adapter, or ChatGPT Web automation
were added.

## Executed, reproducible Node tests

Linux x64 / Node.js v22.16.0, exact source and test Git blob matches:

```sh
node --test tests/*.test.mjs
# 27 subtests, 27 PASS, 0 fail

node tests/run-codex-terminal-events.mjs
# 34 assertions PASS
```

The 27 tests comprise the existing 22 M2 scope/process/event/recovery
cases plus **five** new `goal-run-pause.test.mjs` cases:

- Pause after one ACKed result: first turn reconciled, second turn
  blocked; removing the marker and resuming yields exactly one next
  turn, no duplicate response.
- Pause marker before worker startup: no Codex process created;
  explicit resume continues.
- STOP and pause marker already present: STOP wins, no execution.
- Pause during in-progress response polling: original turn finishes
  and is verified in the outbox, without interruption or a second send.
- STOP during in-progress response while pause is pending: STOP wins,
  native-style interrupt is requested, original outbox remains pending.

Four independently isolated pre-existing supervisor/storage contract
runners were also re-executed with their documented synthetic
external-host providers: **32 + 68 + 69 + 33 = 202 assertions PASS**.

### Native Rust source evidence

The staged Rust blob was checked for **22/22 static source invariants**
using V8: native pause/resume routing, approval and scope gates, epoch
binding, marker creation/restoration, STOP priority, startup exclusion,
PAUSE_REQUESTED/PAUSED status, and stale marker reconciliation.
An additional `goal_pause_marker_is_derived_from_the_native_stop_file`
Rust unit test and a reproducible Node source-check script were authored.

**NOT EXECUTED:** `cargo fmt --check`, `cargo check`, `cargo test`,
actual installed Windows MCP `goal_run.control` call, signed-in
Codex process, native host credential/permission flow, and source
acceptance on a Windows installer. Static verification does not
certify that the new Rust source compiles.

## Remaining gate

Execute full pinned Windows `npm run preflight:localtest`, including
the two new scripts `test:goal-run-pause` and
`test:native-goal-pause-source`. Verify pause request with one
live approved Codex turn, check in-flight completion, restart and manual
resume, STOP and original deadline, and idempotent native RPC handling.
Then continue authentic native host binding and independent QA receipts
for `createVerifiedGoalRuntime`.

The desired ordinary/Personalized Temporary Chat worker remains
blocked on separately verified, permitted transport; this patch does
not make the consumer ChatGPT loop operational.
