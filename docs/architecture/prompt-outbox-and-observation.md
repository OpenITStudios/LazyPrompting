# Durable Prompt Outbox and Response Observation

The approved product boundary is prompt-only: LazyPrompting sends contextual prompts to ChatGPT and observes replies; ChatGPT owns GitHub work.

`PromptOutbox` stores one pending prompt per workspace with an immutable prompt hash and durable reservation. The dispatch gate records the reservation before external send and requires a host response handle. `ResponseObserver` checks authenticated session identity, exact host response handle and trusted completion before closing the outbox entry. A response's text is not proof of GitHub activity or authorization.

Unknown delivery stays reserved and is never resent automatically. No ChatGPT Web scraping, undocumented chat endpoint, or direct GitHub mutation is used.

Remaining: host-supported conversation send/observe API, secure session binding, durable transport receipts, prompt budgeting, per-workspace cleanup and live concurrency QA. Tests authored but not executed.

## Browser AI action-intent hold (16 November 2026)

This same `PromptOutbox` state file now optionally contains
`browserActions`: bounded, strictly validated offline-preview
**RESERVED** action intents. It shares the original file of its PromptOutbox instance,
transaction lock and atomic publication. No second storage
implementation exists; Codex has per-task files, so native
cross-file workspace binding remains a separate gate.
A pending browser action blocks new prompt or agent intents
for the same workspace; the goal runner checks it before
creating a Codex thread. Existing prompt-only `pending()`
remains compatible. On uncertain outcomes a one-way
`holdPreviewActionUncertain` transition sets RECONCILE_REQUIRED;
the RESERVED, DISPATCH_PENDING and RECONCILE_REQUIRED
states survive restart and forbid automatic retry.
`sealPreviewActionDispatch` moves one exact reservation
to DISPATCH_PENDING before any effect and rejects a second
seal. The Rust host now has a read-only persisted-record
verifier, but no positive grant issuer is connected.

The browser row stores a random action ID and nonce, workspace,
fixed local preview origin, document epoch, opaque target and
snapshot hashes, action type and optional text hash; no raw
backend IDs, text or selector. An exact read-side match is
**not** a native grant, nor is a status field an attested
after-action receipt. No production browser-action issuance,
dispatch, acknowledgement or auto-retry is enabled by this
source increment. Test fixtures are authored, not executed.

## Offline result receipt — source update (16 November 2026)

The earlier section records the initial intent-only stage. In the
subsequent fixed-fixture source implementation, the native Windows host
can request the existing packaged Node gateway to reserve and seal
one exact local browser-action intent before an effect. The private
request name is `lazyprompting/browserAction`; it is **not** a
public MCP tool and cannot be called from confined Code Mode.

Following one native-granted, fixed-fixture CDP action and independent
readback, `verifyPreviewActionEffect` is the only source-owned
`DISPATCH_PENDING → VERIFIED` transition. It stores a bounded
opaque `resultDigest`; the native host separately checks the exact
stored row and result hash before telling the operator the result
was verified. `RECONCILE_REQUIRED` cannot become `VERIFIED`
through this method, and duplicate/sealed/verified dispatches cannot
be replayed. Historical `VERIFIED` rows are retained without blocking
the next unresolved action in the same file. Unresolved rows still
block same-file prompt/agent/browser reservations after restart.

This is **source-only** and fixed to an offline fixture. No
authenticated production browser action, public-site mutation, model
approval, real PC QA or cross-file outbox exclusion has been proven.

## Operator-only online ChatGPT send replay fence — 16 Nov 2026

The selected ordinary, persistent ChatGPT target remains a
user-operated WebView2 view. An explicit native `Send once` attempt
now first reserves an immutable digest-only entry through
`PromptOutbox.reserveOperatorChatAttempt` in the same app-local
schema-v1 outbox and atomic file lock used by other app-local
operations. The native host chooses the path; the private
packaged gateway accepts an exact, bounded reservation request
only from its authenticated native bootstrap.

The optional `operatorChatAttempts` collection validates each
`attemptId`, workspace, SHA-256 of the operator-bookmarked
conversation URL, SHA-256 of the reviewed prompt and fixed
`ATTEMPT_UNVERIFIED` state. Raw chat URLs, drafts, responses,
cookies and credentials never enter persistent records.
A replay of the exact workspace+conversation+prompt fails,
including after restart; a different reviewed prompt can proceed
through the existing manual continuation. Pending app-local
prompt or offline browser reservations block a new manual
ChatGPT send. This does not assert global cross-file
coordination with separate Codex task outboxes.

A durable attempt record deliberately does not prove that
WebView2 executed its queued script, that ChatGPT accepted a
message or that a reply exists. There is no verified ChatGPT
response observer, automatic reconciliation/promotion or
unattended consumer Web transport here. Failure to persist
a reservation is a hard failure before any page action.
Source fixtures are authored and NOT_EXECUTED.
