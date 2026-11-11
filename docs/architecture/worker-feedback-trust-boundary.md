# Trusted worker feedback and supported host boundary

**Owner:** Codex-supervised chat-workspace architecture.
**Source state:** implemented source contract, not installed or live accepted.
**Active product status:** [current-state.md](../operations/current-state.md).

## The problem this contract solves

A worker may complete a conversational analysis, report a blocker, or request an
approval **without creating a Git commit**. GitHub HEAD and a browser's idle
indicator cannot tell a supervisor what the worker concluded. Conversely a
worker's claim about a successful test cannot become a trusted QA receipt.

Earlier source accepted an optional `proposal` from an MCP call for read-only
preview. That preview must not become a durable `READY` or `DONE` transition.
This contract separates **host-attested worker result**, **verified source
progress**, **independently verified QA**, **deterministic decision**, and
**native authorization**.

## Explicit trust graph

```text
Official supported agent host / authorized structured callback
  -> host-owned final-turn receipt, exact identity, authorized transport
  -> StructuredWorkerFeedback (bounded result + host attestation)
  -> TrustedGoalReview (ignore caller-supplied proposal)
  -> GitHubGoalReview (turn + immutable HEAD/commits + verified QA receipt)
  -> GoalReviewReconciliation (host lease + durable checkpoint/outbox)
  -> REVIEWED / READY / DONE checkpoint; nextPromptAllowed=false
  -> separate, future, explicitly authorized dispatch gate (NOT INSTALLED)
```

An observed WebView2 `UI_COMPLETED_OBSERVED` is **not** a final turn receipt.
The browser extension must not extract assistant output or provide QA authority.
A GitHub commit is source evidence, not necessarily evidence that a worker's
last conversational turn ended. A model-supplied trust flag, result ID,
approval, QA field or prompt proposal is not host authority.

## Structured result — exact bounded schema v1

`src/prompt/structured-worker-feedback.mjs` accepts a *host-returned* value:

- Identity: `goalId`, `workspaceId` (01–10), `sessionId`, `taskId`,
  `promptId`, `responseHandle`, `responseId`, `contextRevision`,
  `repository`, `branch`, `baseSha`.
- `schemaVersion=1`, `provider=CODEX_APP_SERVER` or
  `AUTHORIZED_STRUCTURED_CALLBACK`, `outcome=CONTINUE|DONE|WAIT|BLOCKED|NEEDS_APPROVAL`.
  Provider strings are classifications, **not transport permission**.
- `summary` is a compact, sanitized result (up to 600 characters); optional
  `blocker` is at most 300 characters. No full transcript, secrets,
  browser DOM, cookies, arbitrary user-content exports, or undocumented API.
- A `CONTINUE` result requires one bounded `nextAction`
  (`action`, `owner`, `proof`, optional `requiresApproval`). Its action
  must appear in the operator-approved goal's allowed actions.
- `evidenceRefs` is at most eight bounded pointers with types
  `COMMIT`, `QA_RECEIPT`, `ARTIFACT` or `DOCUMENT`. These references
  are claims/pointers; they are **not** proof of QA or source correctness.
- Unknown fields and identities are rejected; WAIT/BLOCKED/NEEDS_APPROVAL are
  surfaced as review/approval requests without advancing a prompt.

The host receives a SHA-256 fingerprint of a normalized, stable-field-order
result. The host `verifyResult` callback **MUST independently resolve the
canonical source record** and recompute/attest the fingerprint; merely echoing
a hash supplied by the model or caller is not verification. The verifier must
attest `TRUSTED_HOST`, exact identity, `TURN_COMPLETED`,
`transportVerified=true`, and `operatorScopeApproved=true`.
The trusted native host, not the model, implements those checks.

## Review-to-checkpoint boundary

`src/prompt/trusted-goal-review.mjs` reads authoritative identity and
allowed actions from a trusted host callback. It resolves and attests worker
feedback *before* passing a derived proposal to the original
`GitHubGoalReview`. It **ignores** caller-supplied `proposal` fields.
It rechecks goal, workspace, session, prompt, response, context, project,
branch and `baseSha` against the result of the GitHub review.

If GitHub has not moved or QA evidence is missing, the **verified bounded
worker summary** can still be returned to the operator/Codex alongside
`REVIEW_REQUIRED`; it cannot make the task `DONE`. This covers
non-commit work and conversational blockers without inventing progress.

`GoalReviewReconciliation` now refuses any `REVIEWED` proposal unless
`feedbackVerified=true` and a valid `workerFeedbackHash` are present.
The hash is included in the existing durable `REVIEW_PREPARE` record and
last-review checkpoint; a prepared intent cannot be completed by bypassing
this binding. All results remain `nextPromptAllowed=false`.

No new state store or public MCP tool is created. The previously exposed
`chat_goal.progress_review` is still read-only and provider-injected.
Default Node gateway and installed Rust MCP do not instantiate this wrapper
or reconciler, so this milestone is source-only.

## Transport admission: supported versus blocked

**Supported candidate:** the documented Codex App Server provides
`thread/start`, `turn/start`, `turn/completed`, and final turn statuses.
A native wrapper may produce host-attested structured results from that
supported process after real integration proof, with operator-controlled
scope and exact thread/turn identity.

**Unproven target:** ordinary/Personalized Temporary Chat in the consumer
ChatGPT website does not currently provide this project with a verified
external final-result callback usable by Codex. MCP Apps `ui/message`
supports requesting a message within its *host conversation*, but does not
establish an external universal ChatGPT conversation controller or result
export. Do not treat a WebView2 extension's ability to click Send or observe
idle as license for unattended consumer ChatGPT automation or output
extraction. Use `REVIEW_REQUIRED` and a user-visible, supported handoff
if no authorized worker-result transport exists.

Upstream evidence:
- [Codex App Server events](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)
- [MCP Apps UI bridge](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)

## Mandatory acceptance before runtime activation

1. Same-source Node contract tests for trusted worker feedback and review
   composition; reject injected trust, wrong identity, stale source and no QA.
2. Integrate `readIdentity`, `readResult`, `verifyResult`, `readHead`,
   `verifyTurn`, and `authorize` with independently trusted native owners,
   **not** MCP arguments or browser-page callbacks.
3. Re-run actual file-backed `WorkspaceRegistry`, `PromptOutbox`,
   `CheckpointStore` recovery and multi-process races on exact SHA.
4. Complete Windows Cargo/Node/desktop preflight and an installed app test.
5. Prove one supported-host turn produces a legitimate result, matching
   GitHub/QA receipts and a durable decision. Repeat after a crash, no
   duplicate side effect, and cross-workspace isolation.
6. For the separately desired ChatGPT consumer Chat path, independently
   resolve compliance, host support, final-turn signal and session binding.
   If unsupported, stop/pause; do not silently switch to Work/API or scrape.

**Release invariant:** Source tests and an agent's completion claim do not
make this product operational. No host capability, web automation, production
release, cross-repository write or unsupervised dispatch is authorized here.

## Single source-level composition entrypoint

`src/prompt/verified-goal-runtime.mjs` composes the existing
`WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`,
`GitHubGoalReview`, `StructuredWorkerFeedback`, `TrustedGoalReview`
and `GoalReviewReconciliation` using one exclusive scheduler lease.
The host supplies absolute paths, the same shared storage owners,
authoritative goal/turn/worker verification, source/QA providers and
native approval callbacks. There are **no new durable state owners** and no
additional public MCP names. Caller-provided proposed actions are ignored;
only the host-authenticated worker result can reach the decision engine.

This source composition passed a 32-assertion real-store, fake-host
integration runner on Node 22.16.0. The existing Windows/Rust MCP entrypoint
still does **not** instantiate or authorize the composition. See
[verified runtime validation](../validation/verified-goal-runtime-2026-11-11.md).
