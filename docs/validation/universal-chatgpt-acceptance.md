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

### G0 — approved-goal foundation (source acceptance, 20 November 2026)

- Verify a source-only `test:goal-contract-guardian` fixture with **actual**
  Node execution later, on the same checked-out revision. Until then its
  cases are only `TEST_AUTHORED_NOT_RUN`.
- Reject extra/changed goal fields, duplicate actions, missing acceptance,
  wrong digest, forged renderer approval, wrong repository/branch/HEAD,
  wrong workspace/session/revision, and cross-workspace context capsules.
- New approved goals remain `PAUSED / UNBOUND` after restart and reject
  `RESUME` even when caller supplies `trustedAuthorization:true`.
  No draft, worker, or ChatGPT send occurs.
- Check every canonical PromptOutbox effect family before creating,
  revising or binding a contract. Hold any unresolved send, worker,
  browser action, plugin intent, or corrupted/unknown outbox.
- Require exact native operator approval for creation, revision and registry
  binding, check CAS versions and reject in-flight or terminal goal edits.
  Cross-file partial writes require reconciliation, never automatic retry.
- Guardian rejects wrong goal hashes, stale context, foreign session,
  invalid next action, missing source proof, and false model DONE.
  `IN_SCOPE_CANDIDATE` never grants a next prompt and `DONE_CANDIDATE`
  never marks independent QA or ChatGPT delivery.
- **Installed runtime gate remains open:** independently verify native
  authorization callback identity, actual chat binding, restart races,
  1/2/5/10 goal path isolation and WebView2 account behavior. No cloud CI
  or standalone synthetic test substitutes for this Windows evidence.

### G1 — Native goal intake and Code Mode gate (20 November 2026)

**Source tests authored, not executed.** Before runtime acceptance:

- Installed Rust MCP still advertises exactly **four public tool names**;
  `workspace_goal.prepare/status` are native-routed capabilities with
  explicit schemas. A Code Mode-only `workspace_goal.status` builtin is
  distinct from the hosted ChatGPT plugin.
- Rust generates goal ID and shows **the exact normalized contract** in
  a local OS operator Yes/No dialog. Only Yes may create the checkpoint.
  No model-controlled `approved`, `send`, absolute data path or
  transport choice is accepted.
- The private native-bootstrapped gateway uses one canonical
  `CheckpointStore` per workspace and the already shared
  `PromptOutbox`. Preview is read-only; pending effects, unknown
  commit results and existing goal records fail closed; no retry.
- Restart must recover the *same* `PAUSED / UNBOUND` identity/revision,
  even if an ACK was lost. Foreign workspace, malformed SHA/digest,
  stale lease and corrupted file remain blocked.
- Code Mode `goalWorkspaceId` requires a pre-existing native lease,
  schema-exact status with checkpointVersion, and post-execution recheck. Absent/foreign or
  model-supplied bindings, extra arguments, and false QA / nextPrompt
  flags are rejected. The interpreter has no goal-create/send effects.
- Verify a 1- and 10-workspace workload on the **actual Windows host**
  with exact HEAD, Codex MCP client, modal denial and restart; measure
  RPC count, JSON bytes and *actual token usage if exposed*. No claim of
  savings or live ChatGPT automation from synthetic fixtures alone.

The initial intake's repository SHA is operator-reviewed but
`sourceVerified:false` until an independent source HEAD check and
existing workspace binding are connected. No ChatGPT conversation
identity/turn receipt has been admitted.

### G2 — Event-driven continuation and compact status (source-only, 20 November 2026)

A native-injected `createVerifiedGoalRuntime` composition must show:

- One status call reads only the checkpoint and registry under their
  existing scheduler lease. A repeated status with a matching
  `knownStateKey` returns `trackedStateUnchanged:true`; changed
  registry/context/checkpoint/STOP invalidates the key.
- A missing/foreign/incorrectly bound goal, malformed prior key, or
  changed source/session identity **fails closed**. The key is not a
  valid receipt, permission token, GitHub HEAD proof, or authenticated
  ChatGPT conversation identity.
- No host worker, GitHub or QA provider is consulted for a compact status
  or a Guardian review without a new host receipt event.
  A receipt hint can *request* an inspection but is not independently
  trusted; normal worker/turn/QA checks still decide admission.
- A canonical supervisor `decision.action:"CONTINUE"` paired with a
  separately approved domain `workerReport.nextAction.action` can
  produce `IN_SCOPE_CANDIDATE`; `VERIFY`, an out-of-scope next
  action and unsupported model DONE remain held.
- Each returned summary remains read-only and contains no prompt,
  transcript, new dispatch authority, or invented `qa:PASS`.
- Run the **existing** `test:verified-goal-runtime` and
  `test:goal-contract-guardian` source regression scripts.
  The fixture's host evidence and verified turn are synthetic;
  it does not demonstrate a live ChatGPT handoff or native runtime.

The source-only continuation method is **not** a new installed MCP
capability. Exact-HEAD Windows and real Codex model-call/token measurements
remain `NOT_EXECUTED`. Do not remove native approval, checkpoint,
outbox, STOP, receipt or source validation to claim efficiency.

### G3 — Prompt Construction, Quality and Continuation (source-only)

- Optional `promptType` and `promptDepth` are presentation only. Invalid
  strategy, blank goal/step, malformed acceptance/constraints and oversized
  UTF-8 text fail closed, without calling an additional model.
- Model/client text containing newlines stays quoted as data, not a host
  permission grant. The workspace's existing transport, status, receipt
  identity, budget and STOP gates are unchanged.
- Exact duplicate criteria/constraints are not repeated. Duplicate
  decision entries within the bounded context scan do not cause false
  `contextLimited` HOLD, but unique overflow, truncated items and
  unexamined older history still require review. Foreign workspace/session
  context remains blocked.
- Native Rust `prepare` returns the existing manual `DRAFT_ONLY`
  unverified fields and schema, with goal, acceptance, reported source,
  proposed task, output/evidence and STOP. Desktop JavaScript validates
  operator input only; Rust is the sole final draft formatter. Explicit
  reviewed next steps must not re-quote a prior prompt or full reply in
  the same chat. Without a reviewed step, the native draft carries a
  labelled 1,200-byte unverified excerpt for clarification. No path
  automatically sends, retries or grants implementation permission.
- Later, run `test:prompt-supervisor`, `test:prompt-budget-context` and
  native `chat_manual_handoff` Rust regressions. Real MCP-client and
  Windows/ChatGPT checks require separate PC-local evidence.

This is a prompt format/validation contract, NOT an implemented external
ChatGPT send/answer transport or independently verified model quality.

### G4 — Contextual two-way reply (source-only)

`test:conversation-reply` verifies:
- Strict first repository turn rejects missing GitHub URL, task,
  goal, unsafe URL or malformed branch. Missing acceptance is marked
  unspecified, never invented or treated as completion proof.
- An authorized-host reasoning callback receives one bounded brief with
  the original goal, locked decisions and operator-pasted reply.
  Missing host, unchanged input and failure produce a hold.
- Assessment binds to the exact input fingerprint AND an actual quote
  from that reply. Foreign workspace, stale context, extra authority
  fields, generic "continue" and ungrounded revisions fail closed.
- A question may be answered; weak proposal requests revision; accepted
  design is not commit approval; completion/implementation claims require
  independent evidence; HOLD/STOP candidates do not create messages.
- Contextual source output remains `DRAFT_ONLY` and
  `nextPromptAllowed:false`. Native manual nextStep/approval/outbox/STOP
  and existing public MCP schema remain distinct.

- The reasoning callback requires the complete session/task/response/
  revision tuple. An identical reply in a different turn must reject
  a prior assessment; the fingerprint is not host authorization.
- A full answer/context that exceeds the brief budget must return
  `FULL_REPLY_REVIEW_REQUIRED` with no silently shortened assessment
  or model call. The original message remains for operator review.
- Mixed responses must not hide an implementation/COMPLETION claim or
  blocker behind a QUESTION or PROPOSAL label. Claim → evidence/hold.
- A design-fit suggestion cannot silently turn into operator approval;
  an implementation proposal cannot become a source write.
- A multi-turn scenario must carry goal decisions forward without
  repeatedly demanding cosmetic revisions. Missing reviewed next step
  in the native/desktop manual UI asks for clarification, not blind work.

Existing Node and Rust regression suites also cover native repository
URL/work-instruction output, legacy non-repository compatibility,
claim of model DONE, and no automatic delivery. This is **NOT**
live Codex reasoner, model semantic QA, real ChatGPT final-turn receipt,
Windows test PASS or measured token optimization.

### G5 — Code Mode contextual review and native manual draft composition

The existing `test:code-mode` suite now includes synthetic source
fixtures for the reviewed reply within the authenticated native Code
Mode interpreter, alongside `test:conversation-reply` and the native
manual handoff Rust regression cases.

- An unbound public Node call, absent/empty/stale native inbox,
  foreign workspace, unrelated pending fingerprint or unreviewed
  proposal cannot produce an accepted contextual reply.
- The read-only `handoff.review` builtin must return a review
  candidate with `nativeDraftChanged:false`, `sent:false`,
  `qa:"NOT_EXECUTED"`, `chatTurnVerified:false` and
  `nextPromptAllowed:false`. A held review must have no next step.
- When supplied, native goal STOP/DONE, foreign workspace or
  reconciliation must take priority over an advisory proposal.
- A validated review may precede exactly one terminal
  `handoff.continue` using the *same nextStep*. Substitution of a
  different command or use of a rejected assessment must be denied
  **before** native-effect invocation.
- The source tests also reject an oversized suggested nextStep rather
  than truncate it to native input size. Native result still requires
  the original matching pending draft fingerprint and operator review.
- No fifth public MCP tool, no copied ChatGPT transcript, automatic
  consumer-Web polling, source write, independent QA or model DONE
  is admitted by the Code Mode review projection.

All these checks are `TEST_AUTHORED_NOT_RUN` on this source revision;
real Codex interpretation, native Rust IPC, current Windows installer,
browser and ChatGPT are not execution evidence.

### G6 — Decision Intelligence, goal identity and anti-loop controls (source only)

The current `test:conversation-reply`, `test:code-mode`,
`test:prompt-supervisor` and `test:prompt-budget-context` suites
include authored (not executed) synthetic regressions:

- Missing/malformed quality rubrics are held at the host-facing review.
  An advisory PASS of coverage is **not** independent QA.
- CRITICAL -> no next prompt, MAJOR -> justified specific revision,
  MINOR alone -> no repeat revision. Unknown/missing coverage must
  not become accepted design or source-write permission.
- A new response/session/task/revision/goal identity or conflicting
  active/superseded decision invalidates an older review fingerprint.
  Progress notes remain source-unverified.
- The context packet distinguishes active vs superseded decisions and
  marks truncation/omission. A supplied true `contextLimited` flag
  holds semantic review (`PARTIAL_CONTEXT_REVIEW_REQUIRED`);
  malformed limit flags fail closed. Long replies are not silently
  summarized into asserted progress.
- Code Mode's optional native approved-goal projection must match
  goal ID/revision and scope before review, without claiming it
  authenticated the full goal objective.
- After a review in the same Code Mode execution, **both** the exact
  reviewed reply and reviewed nextStep must match the terminal
  `handoff.continue` inputs. A substituted reply must be denied
  before the native callback. A review followed by a new
  `handoff.prepare` is likewise denied. The original 3000-byte
  reply and 800-byte nextStep limits must fail closed.
- ChatGPT goals without a reply/semantic assessment cannot fall back
  to a blind generic "continue". Separate localCodex read-only
  planning remains unchanged.
- Preserve the four installed public MCP tools, native STOP,
  operator approval, inbox/outbox/replay and terminal-effect rules.

This gate evaluates code behavior and internal consistency only;
actual Codex decision quality, independent evidence, Windows runtime,
source QA and real consumer ChatGPT turns remain `NOT_EXECUTED`.

### G9 — Previous Chat Cleanup (source only)

- Saving Chat A then Chat B in the same owned workspace retains an
  exact previous URL in the **existing** native bookmark. Same-URL
  saves are idempotent; another switch and Forget are held until
  cleanup candidate is explicitly settled.
- Cross-workspace aliasing, wrong/temporary URLs, stale old/new pairs,
  mismatched live Chat B URL and corrupted candidate records fail
  closed. `rollover_status` exposes only `cleanupState`, never
  the raw old URL to a generic MCP read.
- Switching bookmarks checks all canonical unresolved PromptOutbox
  effects **and** the existing native pending-manual-draft inbox;
  a staged draft or contended mutex holds the switch without deadlock.
  Review and reported-deletion settlement check again,
  including after the OS dialog. Pending/ambiguous holds are denied;
  no new database, model or permission owner is created.
- The operator manually verifies the new Chat B, canonical GitHub
  checkpoint and any remaining work. The native Yes/No review is
  **operator attestation**, not authenticated GitHub proof.
- One Work summary derived from existing sources shows
  Bind/Monitor/Recover/Reconcile/Cleanup; an in-flight refresh is
  coalesced so a post-switch update is not silently lost.
- The saved Chat B URL is rechecked after outbox preflight to detect
  an intervening page navigation.
- Chat A can open only as an existing supporting tab and cannot
  replace protected Chat B. A rejected tab operation must not
  be displayed as an opened chat; copy URL remains available.
  After a reported deletion, closing the local review tab requires
  matching native registry tab ID and active ChatGPT location. Deletion occurs only through ChatGPT
  UI's own menu and final confirmation. A second explicit local
  report `OPERATOR_REPORTED_DELETED` clears the candidate but
  `serverDeletionVerified` remains **false**.
- Keep does not require a deletion preflight or perform account
  deletion. Cancelled, failed or unknown outcomes do not falsely
  mark ChatGPT deletion complete.
- Regression Rust fixtures and source-only UI/Node wiring checks
  are `TEST_AUTHORED_NOT_RUN`. Native Windows, installed
  WebView2, 1/2/10-workspace, React/ChatGPT UI and race
  acceptance: `NOT_EXECUTED`.

### G8 — Single LazyPrompting Companion integration (source only)

- The only normal-profile extension is the byte-pinned
  `chatgpt-composer` directory, now branded LazyPrompting Companion.
  Two JavaScript files and one stylesheet load in manifest order; old
  popup-based independent send is no longer registered.
- The toolbar is absent on other origins and Temporary Chat. SPA route
  changes, missing composer, virtualized turns, large chat DOM, keyboard
  navigation and reduced motion must not break native chat usage.
- Turn Navigator reads structural markers only; the displayed loaded
  count is never labelled as total ChatGPT messages or tokens.
- Bookmarks store only bounded operator-authored notes, keyed by exact
  ChatGPT conversation ID. Switching chat cannot show another chat's notes;
  absent virtualized anchors are review-only, not invented links.
- Copy invokes the browser's native selection operation **after** a human
  selection; Export downloads only user-authored notes; source review opens
  only an explicitly entered HTTPS URL and never asserts verification.
- No private ChatGPT APIs, session cookie reads, response/body parsing,
  arbitrary network permissions, hidden output storage, automatic send,
  generic browser-agent/LLM, second persistent checkpoint, or independent
  MCP facade is introduced.
- Native `workspace_chat.rollover_status` needs verified MCP client
  identity and workspace lease; mismatched or missing bookmark yields
  UNBOUND/hold. A status value cannot authorize send/release or promote QA.
- Test 1,130,000 reported tokens and corrupt/stale bookmark metadata.
  1M is an advisory threshold, not a ChatGPT hard stop.
- Exact-HEAD Windows WebView2, native MCP, 1/2/10 workspaces,
  accessibility, CPU/RAM and actual ChatGPT functionality remain
  `NOT_EXECUTED` until separately approved local acceptance.

### G7 — Preventive rollover operator control (source only)

The new native bookmark regression fixture and existing desktop
source-wiring fixture must cover:

- A reported 99,999-token estimate stays advisory-inactive, while
  1,000,000+ reports a **voluntary** long-chat recommendation. Neither
  observation implies a verified hard thread limit or grants sending.
- Marking an exact ordinary chat FULL is idempotent, survives a
  same-chat bookmark save and app restart via the native bookmark
  record, and denies native `operator_send_once` both before
  reservation and at final UI enqueue.
- Saving a **different** ordinary chat resets its estimate, but keeps
  bounded digests of earlier FULL chats; reselecting one of them stays
  blocked. A foreign workspace, wrong URL, corrupted record, unbound
  chat, unexpected estimate and oversized input are denied.
- A new-chat request for Codex contains the known repository/branch
  or explicitly requests unknown goal context. It never treats a
  model assessment as approval or QA, and it does not directly
  send/create ChatGPT conversations.
- ChatGPT Web manual typing remains outside this control; pending
  PromptOutbox attempts and STOP remain separate holds and are not
  automatically released merely because the active bookmark changed.
- No third-party meter is installed or queried and there are no
  internal ChatGPT API calls, response scraping, extra token model,
  service, scheduler or state file.

These tests are `TEST_AUTHORED_NOT_RUN`. Actual Windows/WebView2,
native command serialization, multi-workspace isolation and ChatGPT
compatibility are `NOT_EXECUTED` on this source.

### Browser 01 — private read-only plugin pilot (source gate, 19 November 2026)

**Status:** `NOT_EXECUTED` at the current source revision. This
matrix is an acceptance contract, not evidence that Secure MCP Tunnel
or the hosted goal plugin is installed. The existing arithmetic
probe is a separate synthetic fixture, not the new goal server.

| Gate | Minimum independent evidence | Denial or STOP |
| --- | --- | --- |
| B01-0 — transport eligibility | Confirm target Platform organization, ChatGPT workspace, permissions for **Tunnels Read + Use**, and installed `tunnel-client`; document exact MCP transport and pinned version. Public HTTPS is a separately approved alternative. | `HOST_UNSUPPORTED` or `NOT_CONNECTED`; no bypass or fake tunnel |
| B01-1 — MCP discovery | Inspector and ChatGPT list `goal.status` with **zero input fields**, read-only hint, explicit structured output schema and **no widget template**; installed Rust facade still has its separate four tools | `SCHEMA_UNSUPPORTED`; do not expose new native public tools |
| B01-2 — OAuth and subject | Actual OAuth resource server checks issuer, audience, expiry, scope, token revocation and denies anonymous/foreign accounts. Tunnel transport permission does not replace OAuth or operator consent | `AUTHENTICATION_REQUIRED`; no source data or goal IDs returned |
| B01-3 — native scope | On Browser 01, an approved native owner attests exact workspace, goal, conversation, principal and epoch; a native STOP is readable only to the same approved and bound principal, never executable. Foreign/stale/revoked binding is denied | `NATIVE_SCOPE_UNVERIFIED`; no cross-workspace status or STOP bypass |
| B01-4 — one status read | One `goal.status` call returns an exact source-labelled native snapshot; STOP outranks stale RUNNING. Success conforms to `outputSchema`; tool failures are text-only `isError:true` with no `structuredContent`. No outbox write, Codex dispatch, ChatGPT send or widget remount | `STATUS_SNAPSHOT_INVALID` or `STATUS_UNAVAILABLE`; no retry |
| B01-5 — recovery / concurrency | Restart, lost status callback, changed Git HEAD, STOP, switched chat tab, second client and stale epoch fail closed; no leaking hashes, prompt text, cookies or tokens | `REVIEW_REQUIRED` or `RECONCILE_REQUIRED`; inspect original native state |
| B01-6 — usage measurement | Record actual status RPC count, response bytes, host latency and widget mount count at same pinned revision. Token consumption is `UNKNOWN` unless measured by the host | Do not assert an efficiency gain without comparative data |

**Proof order:** first inspect source-only `test:chat-goal-bridge`;
later, in an explicitly selected `LOCAL_PC_AGENT` phase, use
MCP Inspector, the installed Windows gateway, and one manually
hosted persistent ChatGPT conversation. Secure MCP Tunnel requires
`tunnel_id`, a restricted runtime key and appropriate Platform
and ChatGPT workspace permissions; it is **not** a general ChatGPT
consumer-chat send/result API. Do not store tunnel secrets, OAuth
tokens or private ChatGPT content in GitHub or test fixtures.

**Exit:** only mark B01 complete after exact SHA, test records,
account/workspace identity checks, rejected negative cases and
observed on-demand `goal.status` are captured. This does not
satisfy unattended consumer-web transport Gate U5 or permit
Codex dispatch, model polling, claim consumption or a second scheduler.

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

## Codex authentication regression

The subprocess fixture in `test:goal-run-process-transport` checks ChatGPT
sign-in before dispatch and rejects API-key and logged-out accounts. It also
checks loss of ChatGPT login before a new turn. Installed operator acceptance
remains governed by the [Windows scenarios](windows-localtest-scenarios-2026-11-19.md).
