# Durable Prompt Outbox and Response Observation

The approved product boundary is prompt-only: LazyPrompting sends contextual prompts to ChatGPT and observes replies; ChatGPT owns GitHub work.

`PromptOutbox` stores one pending prompt per workspace with an immutable prompt hash and durable reservation. The dispatch gate records the reservation before external send and requires a host response handle. `ResponseObserver` checks authenticated session identity, exact host response handle and trusted completion before closing the outbox entry. A response's text is not proof of GitHub activity or authorization.

Unknown delivery stays reserved and is never resent automatically. No ChatGPT Web scraping, undocumented chat endpoint, or direct GitHub mutation is used.

Remaining: host-supported conversation send/observe API, secure session binding, durable transport receipts, prompt budgeting, per-workspace cleanup and live concurrency QA. Tests authored but not executed.

## Browser AI action-intent hold (16 November 2026)

This same `PromptOutbox` state file now optionally contains
`browserActions`: bounded, strictly validated offline-preview
**RESERVED** action intents. It shares the original file,
transaction lock, fsync/atomic publication and workspace
collision policy. There is no second persistent ledger.
A pending browser action blocks new prompt or agent intents
for the same workspace; the goal runner checks it before
creating a Codex thread. Existing prompt-only `pending()`
remains compatible. On uncertain outcomes a one-way
`holdPreviewActionUncertain` transition sets RECONCILE_REQUIRED;
both pending states survive restart and forbid automatic retry.

The browser row stores a random action ID and nonce, workspace,
fixed local preview origin, document epoch, opaque target and
snapshot hashes, action type and optional text hash; no raw
backend IDs, text or selector. An exact read-side match is
**not** a native grant, nor is a status field an attested
after-action receipt. No production browser-action issuance,
dispatch, acknowledgement or auto-retry is enabled by this
source increment. Test fixtures are authored, not executed.
