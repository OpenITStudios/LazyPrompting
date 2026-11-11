# Immutable Codex goal-run scope binding — 11 November 2026

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Pinned base:** `8bbe485b08afac3d420090f21d817bd94e360c3b`.
**Purpose:** close a verified recovery authorization gap in the existing
native-controlled `goal_run.*` Codex path. No new public MCP tool,
UI redesign, browser automation, or source-of-truth state store.

## Reproduced defect (before patch)

The previous `runReadOnlyGoal` read an existing `report.json` and
compared base SHA, mode, acceptance criteria and task count, but not the
original objective, allowed coding paths, STOP file or resource limits.
An adversarial variant of the existing recovery fixture changed
`objective="Review both tasks"` to a different objective while keeping
the rest of the checkpoint unchanged. The old resume test **still
passed**, showing the source had no stable goal-text binding on restart.

## Implemented changes

1. `src/transport/goal-run-scope.mjs` constructs a bounded
   version-1 scope fingerprint (SHA-256) from exact runner configuration:
   executable path, repository `cwd`, `dataDir`, `stopFile`, immutable
   `objective`, ordered `acceptance[]`, base SHA, all three limits,
   and `coding` Git/worktree locations, write scopes and verifier
   command arrays. It rejects unknown coding fields and invalid shapes.
2. `runReadOnlyGoal` stores `scopeFingerprintVersion=1` and
   `scopeFingerprint` in the **existing** canonical `report.json`
   before any worker turn. On resume, it recomputes the fingerprint
   and rejects absence/version mismatch/scope drift with
   `GOAL_SCOPE_RECONCILE_REQUIRED`, **before launching a Codex worker**.
   It does not delete, migrate, reauthorize or resend a pending turn.
3. Native `goal_runs.rs` now checks fingerprint **presence/format**
   before `goal_run.control.resume`, suppresses unattended recovery of
   a legacy running checkpoint, and returns a clear
   `RECONCILE_REQUIRED` / `GOAL_SCOPE_RECONCILE_REQUIRED` status for
   an incomplete legacy report. Native presence checks do not claim a
   signed source or validate digest equality; the Node runner compares
   the original scope. One Rust helper unit test is authored.
4. The existing `goal-run-recovery.test.mjs` fixture now uses the
   same versioned scope contract; additional tests exercise unchanged
   scope, modified goal, limits, path and coding scopes, legacy states,
   copied checkpoints, and no duplicate dispatch.

## Executed proof

**Linux x64, Node.js v22.16.0, exact production Node source and test
Git blobs, fake external Codex process / read-only mode:**

| Executed command | Result |
| --- | --- |
| `node --test tests/goal-run-scope-fingerprint.test.mjs tests/goal-run-recovery.test.mjs tests/goal-run-process-transport.test.mjs tests/goal-run-terminal-events.test.mjs` | **22 tests, 22 pass, 0 fail** |
| `node tests/run-codex-terminal-events.mjs` | 34 assertions PASS |
| `node tests/run-verified-goal-runtime.mjs` | 32 assertions PASS |
| `node tests/run-goal-review-real-storage.mjs` | 68 assertions PASS |
| `node tests/run-structured-worker-feedback-contract.mjs` | 69 assertions PASS |
| `node tests/run-trusted-goal-review-contract.mjs` | 33 assertions PASS |

Node test files for M2 use the real
`goal-codex-runner.mjs`, `CodexTerminalEvents`,
`CodexAppServer` (for subprocess tests), `PromptOutbox` and
`publishStateFile`, with a locally owned synthetic App Server rather
than an authenticated Codex model account. No network connection is
required. Source and tests were checked byte-for-byte against Git blob
IDs before commit. The new scope test uses platform-relative absolute
paths, rather than Linux-only `/tmp` paths, so it is suitable for
a future Windows preflight.

**Rust status:** 10 source-level assertions on the staged Rust blob
verified presence of the native helper, manual/automatic resume gates,
STOP-aware legacy status reporting and conservative QA flags.
Rust unit test authored **NOT_EXECUTED**; Cargo and Windows toolchain
unavailable in this environment. No installed MCP/runtime, real Codex
App Server, native host identity or ChatGPT Classic acceptance.

## Migration and trust boundary

Existing in-progress checkpoints created before this fingerprint was
introduced **cannot auto-resume**. Their files remain intact for
manual reconciliation by an authorized operator; the system must not
guess a matching goal or generate a new fingerprint from untrusted
model/tool inputs. Previously completed historical reports remain
readable. An operator-approved *new* goal run may be started separately,
without replaying uncertain prior effects.

The fingerprint is a deterministic integrity check, **not a MAC or
signature** and does not establish native permission. If an attacker
can arbitrarily rewrite all same-user state files, a hash alone is not
independent provenance. Original native approved run records and
separately verified QA/source receipts still control execution.

## Remaining acceptance

Run exact-commit Windows `npm run preflight:localtest`, including
`cargo fmt --check`, `cargo check` and `cargo test`; verify native
`goal_run.status/control.resume` and that old checkpoints stay
`RECONCILE_REQUIRED` without automatic worker process creation.
Connect the real pinned Codex App Server final-turn evidence and
independent QA/operator grants to `createVerifiedGoalRuntime`.
Consumer ChatGPT Web auto-loop remains disabled unless a separately
supported transport is approved.

See [goal-run contract](../architecture/goal-run-mcp.md) and
[active checkpoint](../operations/current-state.md).
