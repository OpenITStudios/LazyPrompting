# Checkpoint Transition Evaluation — 2026-11-10

## Source identity
- Exact evaluated commit: `ec8a1265d33bdd892a21c4a120e25e4a6dd3b77f`
- Source: `src/supervisor/checkpoint-transition.mjs`
- Fixtures: `tests/fixtures/checkpoint-cases.json`
- Native Node runner authored: `tests/run-checkpoint-cases.mjs`

## Method and result
Fetched source and fixture JSON from the pinned GitHub commit. Evaluated the pure transition function body in isolated JavaScript and compared expected decisions, immutable input, and version increments on accepted transitions.

**22/22 PASS**. This is function-level execution, not native Node runner or durable storage/restart testing.

## Verified behaviors
Reserve task before dispatch; reject duplicate reservation and prior task replay; reject wrong goal or stale version; STOP/PAUSE; reject terminal-state mutations; acknowledge dispatch; record uncertain dispatch as reconciliation-required; accept only trusted matching results; reject duplicate/untrusted/wrong-task results; trusted resume from pause; reject unsupported transitions.

## Limits
- In-memory pure function only: no SQLite, atomic transaction, disk fsync, process restart, external transport, or GitHub mutation.
- `trustedEvidence` and `trustedAuthorization` are caller contracts; the pure function does not verify provenance.
- Last-result/last-task checks do not replace durable deduplication across long-running histories.
- Real broker and event store must guarantee atomic compare-and-swap and crash-safe reconciliation before automatic dispatch.
