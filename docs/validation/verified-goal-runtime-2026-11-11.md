# Verified Goal Runtime composition — 2026-11-11

**Branch:** `OpenITStudios/LazyPrompting:Local`.
**Parent:** `78c2f608d60aa3d49bdc19c9b3f87642130cb342`.
**Evidence:** `EXECUTED_TEST_PASS` for full source composition with actual repository persistence modules on Linux Node v22.16.0, injected *synthetic* worker/GitHub/native-host receipts. Windows native/runtime, real GitHub HTTP and ChatGPT Chat remain `NOT_EXECUTED/NOT_VERIFIED`.

## Source increment

`src/prompt/verified-goal-runtime.mjs` provides a single, host-only
`createVerifiedGoalRuntime({paths,host})` entrypoint. It creates **no new
canonical stores**; it instantiates the existing
`WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore` and scheduler
lease from explicitly provided, absolute, non-colliding paths, then
composes:

```text
Host.readIdentity/readResult/verifyResult
  -> StructuredWorkerFeedback
  -> TrustedGoalReview
  -> GitHubGoalReview (readGoal, verifyTurn, scoped source/QA providers)
  -> GoalReviewReconciliation (native authorize, exact HEAD)
  -> existing durable registry/outbox/checkpoint, one scheduler lease
```

The returned public-to-host methods are `reconcile({workspaceId,receipt,
maxCommits})` and `recover({workspaceId})`. The factory does **not** allow
the caller to choose a new source branch, send a prompt, inject a
`proposal`, set a trusted flag or change state file paths per invocation.

All nine callbacks are required at construction, must be implemented by a
trusted host, and remain uninstalled in the default Rust MCP/Node gateway.
A test callback echoing `trusted:true` is **not proof of real native
authorization**. Inputs are still validated by each existing owner.
Results retain `nextPromptAllowed=false`.

## Executed regression

`node tests/run-verified-goal-runtime.mjs`: **32/32 assertions PASS**.

- Runs all real source owners and durable local files through a full synthetic
  worker-feedback -> GitHub review -> decision -> registry/outbox/checkpoint
  cycle.
- Checks exact HEAD, feedback digest, expected `READY` (not fabricated
  `DONE`), idempotent restart and only one result/source read.
- Missing independent QA receipt yields `REVIEW_REQUIRED`, but retains
  the authenticated worker summary; the checkpoint is not modified.
- Untrusted worker attestation prevents GitHub progression and durable
  state changes.
- Wrong workspace IDs, relative data paths, colliding storage paths and
  missing host dependencies fail closed.
- An untrusted `proposal` argument is ignored rather than promoting a
  purported `DONE` claim.
- Full source and new runner were verified as exact Git blobs in an isolated
  Linux Node 22.16.0 environment. The test uses no network, ChatGPT account,
  browser automation, or external model.

## Limitations and next source owner

The factory is **not injected into the installed Windows native host**.
It does not implement transport or replace existing official Codex App Server
execution, nor does it grant new MCP capabilities. A native owner must supply
independently authenticated callbacks, per-goal checkpoint path, shared
registry/outbox/scheduler paths, actual GitHub read-only sources, operator
approval and authoritative final turn receipts. Before activation, test
restart, STOP, and multi-workspace source/head races on the installed build.

The desired ordinary/Personalized Temporary Chat worker still requires
independently verified, permitted final-turn/result transport; never
substitute browser idle or output scraping.

**Next:** integrate host callback ownership in the native Rust/official Codex
path with exact identity and verified receipts; run full Node + Windows Cargo
preflight and installed application acceptance. See [active state](../operations/current-state.md)
and [worker-feedback trust boundary](../architecture/worker-feedback-trust-boundary.md).
