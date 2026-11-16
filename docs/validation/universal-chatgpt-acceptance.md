# Universal AI → Ordinary ChatGPT — Acceptance Gates

**Status:** product acceptance specification, **NOT_EXECUTED** on the new design. **Authority:** [universal chat-first contract](../architecture/universal-chatgpt-workflow.md). The older [Codex chat-workspace gates](codex-chat-workspace-gates.md) remain a *historical provider-specific fixture design*; [Universal Agent migration gates](universal-agent-migration-gates.md) test execution workers, not consumer ChatGPT sessions.

## Evidence classes

`SOURCE_REVIEWED`, `SOURCE_COMMITTED`, `EXECUTED_TEST_PASS/FAIL`, `LIVE_INTEGRATION_VERIFIED`, `PRODUCT_ACCEPTED` are distinct. An old Windows smoke, a passed synthetic DOM test, a connected MCP client, a ChatGPT webpage, and a verified provider worker are different kinds of evidence.

| Gate | Exact condition | Failure disposition |
| --- | --- | --- |
| U0 — source baseline | HEAD pinned; `npm run test:repository`, browser-address guard test, Node/desktop checks and Windows Cargo/NSIS preflight executed on **same** revision | `NOT_EXECUTED` or `BLOCKED` |
| U1 — universal client | Codex and OpenCode receive the same four public tools and `workspace_chat.prepare_handoff` schema; both use an authenticated native client lease; reject second-client workspace takeover. Other clients remain future gates | Client-specific `UNSUPPORTED`; do not weaken trust |
| U2 — role isolation | MCP client identity != worker profile != browser tab != ChatGPT conversation; no model flag changes native scope, STOP, provider or permissions | `BLOCKED`; no dispatch |
| U3 — ordinary persistent chat | User explicitly bookmarks a canonical `/c/<uuid>` conversation URL, restarts, and requests reopening it; deny foreign/temporary URLs, corrupt bookmarks, cross-workspace duplicates and active-tab overwrite. URL navigation alone is **not** account/session verification | `PAUSED_NEEDS_USER` until account/chat is confirmed |
| U4 — supported in-thread app | In a manually hosted ChatGPT chat, supported plugin/tool invocation and `ui/message` follow-up are measured per turn and permission; app selection/rebinding not assumed persistent | `HOST_UNSUPPORTED` or manual continuation |
| U5 — unattended external transport | Documented service authorization, official host capabilities, exact session/turn IDs, authenticated send/observe/lookup and no scrape/private cookie API; **must pass before any live automatic send** | `BLOCKED_COMPLIANCE / HOST_UNSUPPORTED` |
| U6 — evidence & recovery | No double sends, no false DONE, exact SHA/QA receipts, durable outbox, stale/unknown outcome held, original ordinary chat preferred after crash | `RECONCILE_REQUIRED` |
| U7 — scale | 1, 2, 5, 10 workspace tests: RAM/CPU, sign-in shared profile, focus, profile isolation assumptions, mixed clients, STOP, restart and no cross-workspace data leakage | `NOT_ACCEPTED` |

### Adversarial regression matrix

1. A different MCP client claims an existing live workspace or goal; ownership/lease must deny the second caller.
2. An OpenCode MCP client is incorrectly advertised as an executable OpenCode worker; reject without side effects. Do not enable other providers during the Codex/OpenCode pilot.
3. A provider changes mid-goal or an adapter claims unsupported pause/cancel/turn ID; reject, never silently substitute.
4. A WebView ChatGPT URL has `temporary-chat` or similar query; navigation denied. Account-side mode must still be checked independently.
5. App restarts with a pending turn and missing host receipt; explicitly reopening a saved URL does not create a chat or replay a prompt. Do not treat navigation as output/identity attestation.
6. A ChatGPT-hosted plugin `ui/message` returns but a separate tab is targeted; treat as unsupported, not as a cross-chat guarantee.
7. Model text claims "tests passed" with no host QA; acceptance stays unverified.
8. GitHub HEAD advances, branch changes or source diff is outside scope; pause until pinned comparison and authorization.
9. Ten browser views share account cookies; ensure UI does not claim security isolation between them.
10. Worker V2 read-only AppContainer fails OS denial probe; keep execution disabled.
11. A quota/rate limit occurs; wait for quota rather than silently creating replacement chat.
12. No compatible ChatGPT consumer final-turn channel is found; manual in-chat workflow remains usable, automation remains disabled.

## Codex/OpenCode manual-handoff source increment (12 November)

Both priority clients use the **same installed native MCP capability**, `workspace_chat.prepare_handoff`. It must validate exact workspace, bounded goal/acceptance, consistent project references and reject caller-provided `approved`/`send` flags. Host PID+workspace lease admission occurs **before** draft generation, with no browser navigation or ChatGPT network calls. A returned manual draft is *not* an authenticated ChatGPT turn or evidence of output completion.

Cargo unit tests cover formatter and client-independent schema discovery, but source inclusion alone does not prove installed Windows admission; exercise two real clients on disjoint workspaces, then test an attempted cross-client takeover. Acceptance remains **NOT_EXECUTED** for the new SHA until those native tests run.

## Manual Code Mode continuation source acceptance — 16 November 2026

This source increment shares one native `PendingManualHandoffs`
inbox between the UI and Code Mode. The bounded Code Mode
`handoff.prepare` and `handoff.continue` effects remain terminal,
host-lease scoped and reviewable; neither invokes ChatGPT Web.

Required independent cases on the **same checked-out SHA**:

1. Client A prepares a draft via Code Mode; its leased Browser 01 UI receives the original native fingerprint.
2. Operator manually copies or invokes Send once, then pastes a response. The native CAS advances only the matching fingerprint; the previous pending draft cannot be replayed.
3. Code Mode continuation against an absent, stale, foreign-workspace or already replaced fingerprint must be rejected **before** a second effect.
4. Unknown native callback or lost response must leave the canonical inbox inspectable; no implicit retry, double prompt, QA PASS, authenticated ChatGPT result or automatic follow-up.
5. Closing a manual draft, restarting desktop, switching workspaces and an invalid/oversized UTF-8 reply must not promote a pending draft into DONE or falsely preserve an authenticated ChatGPT turn.

Rust and Node negative fixtures have been **authored, not executed**
at this SHA. User-PC Tauri build, installed Code Mode/MCP lease,
operator send/copy, a real persistent ChatGPT chat and UI recovery
acceptance remain `NOT_EXECUTED`. The separate external ChatGPT
transport gate U5 remains blocked and is not satisfied by a manual cycle.

## Required proof sequence

First keep the **existing** four public tools and Codex V1 behavior unchanged; fix any deterministic repository preflight blocker and register the browser-address regression. Then execute Node, desktop build, Rust and installed Windows tests on one pinned SHA. Independently exercise multi-client MCP and one ordinary ChatGPT chat in user-visible manual mode. Evaluate user-initiated in-thread app capabilities only when supported. Never run automatic ChatGPT Web prompts, session extraction or hidden DOM scraping as an acceptance shortcut.

Worker execution acceptance belongs to [Universal Agent migration gates](universal-agent-migration-gates.md) and must not be counted as ChatGPT consumer acceptance. The [11 November Gate 0 decision](chatgpt-consumer-transport-gate0-2026-11-11.md) remains in force until a different documented authorized path is established.

**Exit:** publish the pinned SHA, exact commands/OS, observed test results, independent host receipts and explicit unresolved gates. A proposal or commit alone does not mean `PRODUCT_ACCEPTED`.

## Exact-chat binding for online operator prompting (16 Nov 2026)

The native `operator_send_once` must fail before its attempt ledger
or WebView script when the selected workspace has no saved canonical
ordinary ChatGPT `/c/<uuid>` URL, is displaying the homepage or
Temporary Chat, or points at a different existing conversation.
The queued send script compares the full current `location.href`
with the saved exact URL again at execution time; it cannot silently
send into a second chat after a navigation race. The Svelte button
is unavailable until a saved bookmark exists.

Rust negative tests are **authored, NOT_EXECUTED**. Future Windows
acceptance must check the exact sent/unsent behavior after bookmark
change, URL redirects, tab switches, restart and user-written drafts.
A WebView URL is not a verified signed-in identity or ChatGPT response.

## Adaptive, no-token control-status monitoring — 16 November 2026

Source acceptance adds one pure timing policy with these safety
and efficiency expectations:

- No active watched workspace => no scheduled timer and zero
  native status calls. A hidden/minimized desktop pauses polling
  until visible again. Frontend unmount cancels its timeout.
- The watch runs only after an explicit operator send or Monitor
  request and calls the existing native WebView2 control-only
  observation, **not** a model/LLM/API or browser page-text read.
- WAITING backoff: 3/6/12/20/30 seconds. GENERATING backoff:
  5/10/18/30 seconds. Global minimum spacing is 2 seconds after
  each completed native read, and only one read is in flight.
- Max watch duration: 15 minutes. Expired, cancelled, unmounted,
  possibly completed, errored and unknown states stop without
  auto-retry or automatic follow-up. Missing/forged status is not
  a completion receipt.
- Round-robin/fairness for multiple workspaces is approximated by
  earliest next-due selection; stale results after a closed view
  must not restore that workspace's status.
- The exact source-level negative fixtures are in
  `tests/run-desktop-ui-controller.mjs`. They are
  TEST_AUTHORED_NOT_RUN. Real model token cost from polling is
  structurally zero (no model request); actual CPU/RAM and UI
  latency in 1/2/5/10 workspaces require independent Windows
  measurements, not an inferred savings percentage.

This is not authenticated ChatGPT completion or a supported
unattended consumer transport; the existing U5 hold remains.

## Native online Send once replay acceptance — source-stage P0

At the same pinned Windows SHA, verify the installed native
`operator_send_once` path durably reserves its app-local
`PromptOutbox.operatorChatAttempts` record **before**
`WebView2.eval` is even queued. It must reject a second
identical workspace+saved-chat+prompt request after process
restart, concurrent duplicate requests, a missing/corrupted
outbox, denied native gateway bootstrap, unknown RPC result,
and any pending app-local browser/prompt action.

The source fixture `tests/run-prompt-outbox.mjs` now covers
exact replay, restart, changed conversation, different reviewed
next prompt, invalid workspace/digest/forged field, persisted
duplicates/corruption, privacy and collisions. Earlier
schema-v1 outboxes without `operatorChatAttempts` remain
readable. Never interpret a reservation, a WebView eval result
or `POSSIBLY_COMPLETED` as a ChatGPT delivery/final-answer
receipt. Preserve manual review, operator-pasted answer,
existing prompt budget/STOP and no automatic resend.

Node and Windows/Rust/Svelte/installed ChatGPT acceptance:
TEST_AUTHORED_NOT_RUN / NOT_EXECUTED on this SHA.

## Operator-review transition and crash recovery — 16 Nov 2026

Required source/native invariants for the current app-local
ChatGPT send path:

- Only one unresolved operator-chat attempt per workspace;
  a second different prompt, browser action or same-file
  prompt/agent reservation cannot overlap it.
- An operator-pasted reply with a stale/mismatched native
  draft fingerprint, changed saved chat, wrong pending prompt
  digest or unavailable gateway cannot replace the old draft
  or release the held attempt. A subsequent explicit native
  review may record `REVIEWED_UNVERIFIED` but never
  `RESPONSE_VERIFIED`, `sent:true` or `nextPromptAllowed:true`.
- Repeating the same literal prompt after a *separately
  operator-reviewed* earlier turn is allowed as a new,
  user-clicked send, while replay within the pending turn
  remains denied. No implicit retry after an unknown result.
- After restart, the operator must reopen/check the same
  bookmarked chat, inspect the answer, and pass a native
  confirmation dialog before the source-only recovery command
  can release the pending attempt. Denial, wrong workspace,
  changed URL during the modal, duplicate/ambiguous pending
  rows and gate errors must not release anything.
- No response-body scraping, model token/API polling,
  private ChatGPT endpoint or auto-next-prompt mechanism
  is introduced. No account-side chat receipt is asserted.

Source fixture coverage: `tests/run-prompt-outbox.mjs`,
`tests/run-desktop-ui-controller.mjs`, and Rust
`chat_manual_handoff.rs` unit tests (including a failing
durable-review callback that must preserve the original draft).
All are TEST_AUTHORED_NOT_RUN on this GitHub source
surface. Actual Windows, installed gateway, WebView2,
crash/lock and 1/2/5/10 workspace acceptance are
NOT_EXECUTED until a separately selected local-PC phase.

## Source lock ownership and explicit crash recovery

When a Node PromptOutbox transaction acquires its original
exclusive lock, it must write and fsync an owner record
before writing state. Crash with owner still alive, a
wrong owner token, unreadable/malformed/ownerless lock,
symlink, unexpected directory entries, or ambiguous
process liveness must block recovery. There must be
**no age-based stale lock auto-delete** and no
implicit retry of a ChatGPT prompt.

After a known owner process exits and leaves the lock,
the main-window Tauri command
`recover_interrupted_operator_outbox` may request
recovery only with operator confirmation and a second
same-token/process-state check. The private gateway
`operatorChatLock` RPC does not appear as a public
MCP tool or Code Mode capability, and raw lock token
must never reach Svelte or logs. The operation must
leave every `ATTEMPT_UNVERIFIED`, prompt reservation,
browser action and checkpoint unchanged.

Source fixtures in `tests/run-prompt-outbox.mjs` cover
the live/unknown/exited process cases and no automatic
replay; UI wiring fixtures in
`tests/run-desktop-ui-controller.mjs` cover the
native-only route and manual button.
All are TEST_AUTHORED_NOT_RUN here; actual Windows
PID and filesystem behavior require later matched
local-PC evidence. Unknown legacy lock ownership is
a deliberate `LOCK_UNVERIFIED` hold, not
a source-certified recovery.

## Pre-localtest source contract, status visibility and crash ambiguity

- Historical `REVIEWED_UNVERIFIED` operator attempts can repeat a
  literal prompt hash in a later separately approved turn. Two
  `ATTEMPT_UNVERIFIED` attempts in one workspace remain invalid.
  Tests must model both cases; a failing test must not be fixed by
  silently weakening the persistent schema validator.
- Concurrent `reserveOperatorChatAttempt` calls against one
  canonical outbox must admit **at most one**. A losing writer
  receives a held-state receipt or `OUTBOX_LOCK_BUSY`, neither of
  which may trigger another WebView2 send automatically.
- If an operator review was persisted but the gateway response or
  subsequent native draft CAS was lost, the hold may already be
  cleared while the old session-memory draft remains. Reconcile
  the exact original chat and native fingerprint manually.
  An outbox review is not an authenticated answer receipt.
- On operator-opened AI Activity, the native
  `operator_chat_attempt_status` command must expose a
  digest-free projection only: `NO_PENDING`,
  `REVIEW_REQUIRED`, `AMBIGUOUS_HOLD` or a frontend unknown
  state. `deliveryVerified`, `resultVerified` and
  `nextPromptAllowed` remain false. Only
  `REVIEW_REQUIRED` shows the **I reviewed this chat** action,
  which retains its separate native permission dialog.
- No new timer/LLM calls accompany this on-demand display.
  Existing adaptive, control-only ChatGPT generation observation
  is unchanged. No raw prompt, answer, token, URL or internal
  digest leaves the trusted host via this projection.
- Codex `task-N` outboxes and ChatGPT `workspace-NN`
  identities are not equivalent. Any future cross-file
  exclusivity must be proven with a trusted host mapping and
  matching actual consumers, not a heuristic file-name alias.

**Evidence:** `tests/run-prompt-outbox.mjs`,
`tests/run-desktop-ui-controller.mjs` and the native
`chat_manual_handoff.rs` unit fixture are updated in source.
They have **not** run on the current revision. Windows/browser
E2E, user experience, latency and CPU/RAM measurements remain
a separate local-PC acceptance gate.

## Goal Codex task / ordinary ChatGPT boundary

The goal-run task-N outbox must refuse foreign
workspace-NN items, any browser or operatorChat collection,
and malformed task IDs, even if the foreign record is
historical/verified. `tests/goal-run-recovery.test.mjs`
exercises positive and negative cases. The host must never
equate task-1 with workspace-01 or promote a Codex output
to an authenticated ChatGPT consumer response.
SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN; real Windows
Codex/ChatGPT acceptance NOT_EXECUTED at this SHA.

## Official product transport separation (source acceptance)

An otherwise positive synthetic host manifest must be
rejected when tagged `WORKSPACE_AGENT` or `RESPONSES_API`
rather than `ORDINARY_CONSUMER_CHAT`.
The pure source tests assert that Workspace Agent beta
run status is **not final answer text**, and Responses
API answer retrieval is **not** an existing consumer
ChatGPT chat. A ChatGPT `/c/` URL alone never grants
either API identity, authenticated output or a
next-prompt authorization.

These source cases do not execute network calls or
prove any real Workspace Agent or platform API access.
The ordinary consumer ChatGPT transport U5 remains
BLOCKED_COMPLIANCE / HOST_UNSUPPORTED.

## Optional Responses API mode acceptance, independently scoped

This section is **not** a demand to start localtest and does
not change ordinary ChatGPT acceptance U5. Before a distinct
Responses API mode is installed or enabled, require:

1. Explicit user selection of `EXPLICIT_OPENAI_API`,
   separate API conversation, API billing/retention and
   model. Require authenticated native per-turn consent
   and workspace-specific spend/output/turn budgets.
2. Inject official SDK client and native-owned
   `PromptOutbox`. An untrusted caller field
   `approved:true` is never sufficient. The exact
   native host callback must independently attest
   workspace, conversation, prompt hash, turn ID,
   revision, model and max output tokens.
3. A `api-workspace-NN` cannot refer to a consumer
   `workspace-NN` or `https://chatgpt.com/c/...`.
   Never copy WebView cookies, assume shared history
   or silently switch the selected chat engine.
4. Reserve before `responses.create`, send once and
   never automatically retry after timeout, crash
   or a mismatched/incomplete response. Preserve
   `RESERVED/ACKNOWLEDGED` holds until independently
   reconciled; do not promote ambiguous output.
5. Match provider response ID, `conv_...` identity,
   model, completed status, typed assistant text
   and bounded usage. Provider-completed output is
   not QA acceptance or permission for another
   prompt. No raw answer or prompt is persisted
   in original outbox.
6. Validate positive/malformed/refusal/wrong-ID/
   untrusted-approval/duplicate/transport-loss/usage
   cases with `node tests/run-optional-openai-responses.mjs`.
   Record exact SHA and native host evidence in an
   independently approved phase. No cloud CI substitute.

Current evidence: TEST_AUTHORED_NOT_RUN; API client,
native authorization, signed Windows package and
actual model/billing integration NOT_EXECUTED.

## Bounded optional API goal: end-to-end source and native acceptance

This is a **separately selected OpenAI Platform mode**, not a
consumer ChatGPT U5 bypass. The source path is now wired:
`ApiGoalPanel.svelte`, `api_goal_controls.rs`,
`GatewaySession.request_api_goal`, private
`lazyprompting/apiGoal`, `ApiGoalRuntime`,
`OptionalOpenAIResponsesTurn`, native Node HTTPS client,
and the SAME original PromptOutbox.

Acceptance requires the following under one pinned Windows SHA:
1. Default ChatGPT browser mode creates NO API key access,
   API conversation, paid call or model polling. Ordinary
   ChatGPT history/bookmarks and four MCP tools are unchanged.
2. With absent key, wrong main window, malformed model/
   goal/turn/token scope, denied OS dialog or missing
   gateway, no API conversations/reservations/generations
   occur. Do not log/expose the key, full prompt or reply.
3. An approved API run creates at most ONE separate official
   `conv_...` and uses `api-workspace-01`, never
   consumer `workspace-01`. Verify first reservation
   precedes each `responses.create`, with no
   automatic retry after timeout, process crash, STOP
   or an ambiguous response.
4. Test a true two- or three-turn API goal: output is
   parsed using strict structured JSON, distinct next
   prompts are generated from the same API conversation,
   and both output and input token usage are accounted.
   Hard max turns and per-turn output cap must apply.
   Token threshold is evaluated post-response, not
   a guaranteed price cap.
5. `DONE_PROPOSED`, BLOCKED, bad schema, refusal,
   response ID/model/conversation mismatch, high usage,
   duplicate next prompt, malformed outbox, and
   cancel/STOP produce honest REVIEW_REQUIRED or
   RECONCILE_REQUIRED without false QA PASS or another
   automatic prompt. After gateway restart an
   orphaned RUNNING/PREPARING run must be shown as
   RECONCILE_REQUIRED rather than resumed.
6. The API goal panel is opt-in/collapsed and shows the
   real active run, summary, token counts and STOP.
   Its read-only in-app status polling must stop
   when the panel's run ends or desktop is hidden.
   No hidden streaming LLM/model-token usage.
7. Source-only fixtures:
   `tests/run-optional-openai-responses.mjs`,
   `tests/run-api-goal-runtime.mjs` and
   `tests/run-api-goal-source.mjs`.
   Source checking is not Windows/real-API acceptance.

Key and spending approval must be configured locally
by the operator; no credential should be stored in a
GitHub file. Official project **hard spend limit**
(not only notifications) should be set separately.
Do not authorize paid API calls by this source
development or old approval dialogue alone.

Proof: SOURCE_COMMITTED, TEST_AUTHORED_NOT_RUN,
native Windows/API/actual billing tests NOT_EXECUTED.

### API credential loading boundary

The packaged Node gateway is launched with
`env_clear()`; it never automatically inherits
`OPENAI_API_KEY`. After a main-window Windows
approval, Tauri reads the locally configured
key and sends it in exactly one authenticated,
private gateway RPC. Negative source assertions
must reject any API credential in the Svelte
renderer, logs, public MCP arguments or persisted
outbox. Real OS/IPC secret isolation is
NOT_EXECUTED on this GitHub source revision.
