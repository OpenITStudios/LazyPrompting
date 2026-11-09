# Context-Aware Supervisor — Deterministic State Machine v0

**Status:** architecture contract, NOT_IMPLEMENTED. **Authority:** user-approved goal and exact repository evidence; never browser text or model self-report.

## Objective
Given one immutable goal and the last completed verified work, decide whether to continue and generate exactly one context-specific instruction. Never send blind `lanjutkan`. Prefer zero additional model calls when evidence is unambiguous.

## Inputs (typed boundaries)
- **Goal:** `goal_id`, immutable target repo/branch, accepted scope, must-preserve, acceptance criteria, approved action classes, max iterations/time/model budget, STOP conditions.
- **Observation:** unique `result_id`, `run_id`, `iteration`, source SHA, agent completion status, timestamp, outcome, reported progress, proposed next action.
- **Verified evidence:** exact GitHub HEAD, changed paths/commit, real test receipt and proof tier, trusted permission state.
- **Checkpoint:** last acknowledged result ID, last dispatched task ID, no-progress counter, remaining budget, current state, immutable goal hash.

Observation is untrusted until reconciled. Missing fields or conflicting SHA never become implied success.

## States
`READY` → `DISPATCHING` → `WAITING` → `OBSERVING` → `RECONCILING` → `DECIDING` → `READY` (next task).

Terminal or held states: `DONE`, `PAUSED`, `BLOCKED`, `STOPPED`, `FAILED`.

## Decision priority (first matching rule wins)
1. User STOP/PAUSE, revoked approval, prohibited operation or unsupported transport → `PAUSED` / `STOPPED`.
2. Duplicate `result_id` or already-dispatched task ID → no new dispatch; reconcile original result.
3. Missing, partial, stale or contradictory observation → `WAITING` (bounded) or `BLOCKED`; never infer a response finished.
4. Budget/time/iteration limit reached → `STOPPED`.
5. Failed real QA receipt → `FIX_FAILURE` with exact failing owner and evidence.
6. Change exists but required proof missing → `VERIFY`; never call it PASS.
7. `DONE` claimed and acceptance independently satisfied → `DONE`.
8. `DONE` claimed without acceptance → `VERIFY`.
9. Explicit blocker or approval required → `BLOCKED` / `PAUSED`.
10. No measurable progress for 3 distinct completed iterations → `STOPPED` with stagnation report.
11. One authorized, evidence-grounded next action → `CONTINUE`.
12. Ambiguous next action → one bounded small-model suggestion; validate against goal, permissions, evidence and budget before dispatch; otherwise `BLOCKED`.

## Prompt composer
Use one small template with: `goal_id`, verified latest outcome, **one** concrete next action, exact module or scope, must-preserve constraints, proof required, stop boundary. Never include full transcript by default.

Example:
```text
Goal: G-17. Preserve the approved scope and branch Local.
Observed: commit <sha> changes validation module; required tests NOT_EXECUTED.
Next: validate the changed module with the smallest available executable proof.
Do not reopen unrelated architecture. Report exact receipt or blocker, then one next action.
```
The SHA is a placeholder, not a claim of a real commit.

## Idempotency and crash recovery
Persist `task_id` **before** dispatch; after restart reconcile transport state before retry. A timeout after send is UNKNOWN, not permission to send again. Check GitHub HEAD and task ID after uncertain writes. Never retry a destructive operation automatically. Single active task per goal in v0.

## Low-usage policy
- No model for schema validation, deduplication, permission, proof or deterministic status transitions.
- Small-model fallback receives only fixed goal summary, last verified delta, unresolved list and allowed action vocabulary; cap input/output tokens and calls per hour.
- On model invalid output, do not recursively retry. Use one bounded correction or STOP.
- Separate controller token counts from Codex/worker usage; no speculative savings percentage.
- Event completion signals first; capped polling only for missing event delivery.

## Acceptance
Before runtime implementation: frozen fixture cases must show correct STOP/PAUSE, QA repair, stale SHA rejection, duplicate prevention, context preservation, no-progress stop, and zero model calls for deterministic cases. Full integration and ChatGPT-Web compatibility remain unverified.

## Transport boundary
Official supported Codex/API tools are candidates for unattended operation. Lightpanda can be evaluated as a web-navigation adapter independently; it is **not** authorized to scrape ChatGPT Web output or automate unsupported access.
