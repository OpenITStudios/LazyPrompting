# Codex App Server process/stdio integration — 2026-11-11

**Scope:** M2 deterministic process-boundary QA for `OpenITStudios/LazyPrompting:Local`.
**Tested base:** `03b03391bd61a2e122d7c3bb4a2eae7e410533c7`.
**Evidence class:** `EXECUTED_TEST_PASS`, Linux Node v22.16.0, local synthetic App Server child. This is **not** `LIVE_INTEGRATION_VERIFIED` for Codex CLI or Windows.

## Why this test matters

Previous M2 suites injected a JavaScript `newServer` test double into
`runReadOnlyGoal`. That proved decision, outbox, and recovery handling but
did not exercise the real `CodexAppServer` spawning/stdio protocol:
JSON-RPC framing, `initialize/initialized`, `thread/start`, `turn/start`,
event notification delivery, status query and `thread/items/list`.

`tests/goal-run-process-transport.test.mjs` now launches a disposable
Node subprocess using `process.execPath` with a script named
`app-server` inside an isolated temporary working directory. This
produces the same `app-server --listen stdio://` argv shape as the
production `CodexAppServer` transport. The fake process responds to a
strictly synthetic protocol only. It creates no network connections and
never launches Codex, a model, a browser, WebView2 or a coding worktree.

The real code under test is `CodexAppServer` plus
`runReadOnlyGoal`, `CodexTerminalEvents`, `PromptOutbox` and
`publishStateFile`. Only `resolveOptions` is replaced (to bypass
actual Codex CLI version discovery). The unused `goal-worktrees.mjs`
import in the isolated read-only fixture is a test stub.

## Executed test cases

| Case | Observed result |
| --- | --- |
| Early terminal notification before turn/start response | `EVENT_AND_QUERY_CORRELATED` |
| Late terminal notification before status query response | `EVENT_AND_QUERY_CORRELATED` |
| No terminal notification, completed turn query | `TURN_STATUS_QUERY_ONLY`, not fabricated event |
| Terminal notification from wrong thread | Query-only; no cross-thread attribution |
| Failed + completed notification for one turn | `RECONCILE_REQUIRED`, retained after restart |
| Unknown terminal status for one turn | `RECONCILE_REQUIRED`, retained after restart |
| Two tasks concurrently using separate threads | Both are correctly bound to their original thread/turn |
| Child disconnect during `turn/start` | Pending original outbox entry preserved; no false completion |
| Restart after unknown `turn/start` delivery | Original `RESERVED` entry unchanged; no blind resend |

**Observed execution (Node 22.16.0, Linux):**

```sh
node --test tests/goal-run-process-transport.test.mjs
# 9 tests, 9 pass, 0 fail

node --test tests/goal-run-process-transport.test.mjs tests/goal-run-terminal-events.test.mjs tests/goal-run-recovery.test.mjs
# 17 tests, 17 pass, 0 fail

node tests/run-codex-terminal-events.mjs
# 34 assertions PASS
```

The previously completed real-store and structured worker feedback
contract runner suite was also rerun independently:
`verified-goal-runtime` (32), `goal-review-real-storage` (68),
`structured-worker-feedback` (69) and `trusted-goal-review` (33):
**202 assertions PASS**, on their documented injected fake external hosts.

## Exact source provenance

Files used in the subprocess tests were locally reconstructed and checked
byte-for-byte against Git blob SHA identifiers for the selected branch:

| Source | Git blob SHA |
| --- | --- |
| `src/transport/codex-app-server.mjs` | `2e696b1d76f5f6d1958a89513a5fcfda5f8fedfd` |
| `src/transport/goal-codex-runner.mjs` | `648587ee7d6771e399f85160f39c0181832dc29b` |
| `src/transport/codex-terminal-events.mjs` | `3bc9f6b2e1e265db80d9aedca440cdae716a9cf0` |
| `src/prompt/prompt-outbox.mjs` | `811323e6ee5c092faff11c2340a00c2a0f78c3ce` |
| `src/runtime/publish-state-file.mjs` | `82738c44985487d9f55237c5444ff28b44432e54` |
| New `tests/goal-run-process-transport.test.mjs` | `7e87ff12868fb05e90b428bf0fcb063ff3d989b2` |
| Previous `tests/goal-run-terminal-events.test.mjs` | `3324f9b3a5c018281f0c290e2ec3583bbdece4be` |
| Previous `tests/goal-run-recovery.test.mjs` | `eabaf0df7a93a3345cb459c53fcd8065a1da3bef` |

The new test is registered as `test:goal-run-process-transport` in
`package.json` and included in the existing **manual-only**
`preflight:localtest` sequence. No CI workflow was dispatched.

## Important boundaries

This verifies the process framing and state handling against a locally
controlled synthetic App Server, **not** the authenticity of the signed-in
Codex CLI, the actual live schema/version of the installed executable,
Windows process identity, native pipe, trusted QA receipt, or terminal
host attestation. A JavaScript subprocess can imitate the same protocol;
only the native owner may establish process identity and approval.

The existing native `goal_run.turn_receipt` still exposes recorded
correlation only, without turning it into `qa=PASS`,
`finalTurnHostAttested=true`, or a dispatch grant. No ChatGPT consumer
website automation/output extraction is enabled.

## Next acceptance

Run exact-SHA `npm run preflight:localtest` (full Node, desktop build,
Cargo fmt/check/test) on a supported Windows build; test a real
operator-approved Codex App Server turn and native
`goal_run.turn_receipt`, including STOP, process disconnect and restart.
Bind native identity, operator approval and independently verified QA
to the **existing** `createVerifiedGoalRuntime` without adding a second
source of truth.

Official protocol: https://learn.chatgpt.com/docs/app-server
