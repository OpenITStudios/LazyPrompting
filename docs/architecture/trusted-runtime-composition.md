# Trusted Runtime Composition — Code-first Integration

`src/runtime/trusted-runtime.mjs` is the canonical composition root for the trusted host side. It constructs a single-host checkpoint store, durable replay ledger, authorization broker, receipt reconciler, official-host callback adapter, orchestrator and bounded scheduler.

## Trusted dependencies
The host must supply source HEAD lookup, grant verification, QA receipt verification, authenticated submit, result lookup and independent dispatch-receipt verification. The repository does not create grants, obtain credentials, connect to ChatGPT Web or invent a Codex API protocol.

## One-tick flow
1. Scheduler checks persisted checkpoint and pending-task state.
2. On pending work, it observes and independently verifies task/receipt before reconciling.
3. On ready work, orchestrator checks source evidence and deterministic continuation.
4. Broker verifies trusted grant and exact HEAD, then consumes durable replay reservation.
5. Checkpoint reserves task; agent adapter rechecks authorization receipt at tool boundary.
6. Host submit returns receipt or uncertain delivery; checkpoint records ACK or reconciliation required.

## Critical remaining gaps
- Grant receipt is presently an internal broker return value, not a cryptographically verifiable authorization token. The host's `verifyAuthorizationReceipt` must validate the underlying grant and consumed ledger entry independently. This callback must not accept a model-supplied `authorized:true` flag.
- Cross-store reservation and checkpoint are not one atomic transaction; a crash between them can consume a grant without a task reservation. Fail closed, require reconciliation and new authorized identity.
- QA receipt verifier must check runner provenance, task, goal, branch, SHA and freshness, not just a `trusted` field.
- Current scheduler is one-tick only and requires explicit invocation. No background daemon or official Codex transport is connected.
- Source-only test authored in `tests/run-trusted-runtime.mjs`; no native tests executed.

## Security
No default host implementation is supplied; no arbitrary browser interaction or cross-repository write is authorized. Do not promote to OPERATE until a trusted host binding and end-to-end proof exist.
