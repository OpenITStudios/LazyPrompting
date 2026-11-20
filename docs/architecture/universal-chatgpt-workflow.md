# Universal AI Client → Ordinary ChatGPT — Product Contract

**Authority:** operator correction, 19 November 2026. **Stage:** selected product goal; automated ChatGPT browser loop not available. **Development branch:** `Local`. This document owns the chat-first product goal. [Universal Agent Orchestrator](universal-agent-orchestrator.md) owns optional execution-worker contracts, and [MCP architecture](../../mcp/ARCHITECTURE.md) owns the installed surfaces.

## Non-negotiable outcome

LazyPrompting is a Windows app with **ten browser workspaces**, each for an ordinary, persistent ChatGPT chat. The operator sets the goal and when to stop. In the selected workspace, LazyPrompting submits a prompt, waits for ChatGPT to finish answering, interprets the answer in context, and submits the next relevant prompt in the same chat. The loop ends when the goal is reached or the operator's stop condition is met.

Project context is recovered from the project's existing GitHub records using the documented continuation procedure. Keep the prompts tied to the selected chat, project and goal. The product uses the signed-in ChatGPT web chat without a paid model API. The steps below describe the available manual workflow and transport limits until the browser loop is available.

**Universality means compatible clients and optional approved planning/worker adapters — not replacing ChatGPT with another model.** Codex, OpenCode, Claude Code, Gemini CLI or editors can act as clients only when their actual MCP integration is installed and verified. Acting as an MCP client is *not* evidence that a provider can execute `AgentBackend` jobs or control consumer ChatGPT sessions.

## Adaptive ChatGPT prompting — source design, 20 November 2026

The canonical [Prompting Contract v1](prompt-only-supervisor.md#chatgpt-prompting-contract-v1--normative-source-design-20-november-2026)
uses the existing Node prompt supervisor, context projection and native
manual handoff formatter. The structure is goal → unfinished step →
relevant context/acceptance → evidence/output → STOP. Optional task and
depth settings change presentation only. Deterministic checks replace
an extra model-based prompt checker, and repeated identical constraints
are omitted while unique facts remain. The actual handoff stays
`DRAFT_ONLY`; this adds no MCP tool, UI, scheduler, credential access,
ChatGPT consumer send or automatic continuation. Source fixtures are
authored but have not been run on the user PC; benefits are unmeasured.

## Two-way contextual prompting — source contract, 20 November 2026

The [conversation reply contract](prompt-only-supervisor.md#goal-aware-conversation-reply--source-contract-20-november-2026)
requires a literal repository URL, work instruction and goal on the
first repo turn. It then provides a bounded one-shot semantic brief for
Codex, grounded in the exact operator-pasted ChatGPT response and
approved decisions. Typed review candidates may answer, request a
specific revision, accept a design-only direction, request proof of a
claimed commit or hold. They cannot approve writes, automatically
send a ChatGPT message, or declare independent QA PASS.

The current installed-native manual draft/nextStep path is reused;
the reasoner callback and automatic ChatGPT reply transport remain
unbound. The source contract does not turn a client-side response,
reply fingerprint or model assessment into a verified host receipt.

### Conversation reasoning source refinements

The semantic brief now binds the supplied session/turn/revision as well
as the exact reply text. If the full response exceeds a bounded one-shot
brief, it fails closed and asks for complete operator review rather than
pretending to understand a silent excerpt. Mixed claim/question/blocker
responses receive stricter evidence holds. A design-fit assessment remains
a candidate, not a user approval to implement. The manual desktop
continuation with no approved next step requests clarification.
These safeguards do not connect Codex App Server to a consumer ChatGPT
conversation; that requires the separate native admission/receipt gate.

### Existing Codex Code Mode composition for manual follow-ups

The source integration can reuse the authenticated native Code Mode
lease after a first manual draft is pending. An existing Codex client
can interpret a user-pasted reply, supply a structured model assessment,
and call the read-only `handoff.review` builtin. If valid, the
same Code Mode program may stage **exactly that candidate** via the
original `handoff.continue` terminal effect. Native/outbox/STOP and
human send/review still control the result.

This is not a new Codex App Server session, native agent, source
writer or consumer ChatGPT browser output transport. It cannot verify
that the pasted text was sent by ChatGPT or that a model proposal is
correct. Full actual-runtime and real-model testing remain deferred.

### Decision-quality contract and human-review boundary

The existing Codex-facing semantic proposal now includes an advisory
six-dimension quality rubric and per-criterion coverage, keeping
critical blockers, material revision requests and cosmetic polish
separate. The bounded context projection labels superseded decisions
and reported progress notes; missing context cannot be treated as
verified completion. The pure generic prompt fallback cannot continue
a ChatGPT goal without the actual reply and assessment.

The already admitted Code Mode `handoff.review` only validates a model
suggestion as a read-only candidate, tying its reviewed reply and next
instruction to the same pending native manual draft. Host-projected
goal ID/revision (when provided) must agree, but the compact status
does not authenticate the full goal text. Only a separately authorized
native action can stage the reviewed manual draft; no consumer-Web
send/observation or user-PC Codex execution has been proven.

## Preventive rollover from operator-reported chat length — source increment

The optional local token estimate in the existing desktop Work view is
**operator-reported**, not read from ChatGPT. Above 100,000 estimated
tokens it displays a voluntary long-chat advisory; context-window
figures are **not** the documented maximum thread length and never
authorize automatic switching. An operator-confirmed maximum-length
warning records a digest of that bookmarked ChatGPT URL in the same
native local bookmark record. The exact saved URL is rechecked before
each operator `Send once` attempt and again under its native
bookmark lock at UI enqueue time. A confirmed-full chat is held.
An ordinary New Chat stays manual; after a Codex-prepared recovery
prompt is reviewed and sent, the operator explicitly saves its new
conversation URL. The original goal, STOP and unresolved outbox
effects are not silently migrated, deleted or reauthorized.

This source change does not install Usage Meter, use undocumented
ChatGPT endpoints, read a transcript, support automatic new-chat
creation, or verify any actual chat size. The existing Codex reasoner
and canonical project checkpoint remain the recovery owners.

## Operator-approved Goal Contract foundation — 20 November 2026

**Source-only, not installed behavior.** A new bounded canonical Goal Contract
is proposed by a planner but becomes persistent only after an authenticated
native-host callback attests operator approval of the exact goal ID, workspace,
repository, branch, pinned source SHA, revision and content digest. The digest
protects cross-file matching; it is not an authorization token or signature.
The existing per-goal `CheckpointStore` owns the approved contract and revision
history, and the existing `WorkspaceRegistry` holds only the binding
(`goalId`, `goalHash`, `goalRevision`, `contextRevision`). The original standalone source-only checkpoint/registry bridge requires
independently authenticated host callbacks and separate checkpoint paths.
The 20 November native increment now adds `workspace_goal.prepare/status`
to the installed Rust MCP *source*, backed by a private authenticated
Node gateway route and the existing per-workspace checkpoint owner.
It does not connect the source-only `WorkspaceRegistry.bindApprovedGoal`,
prove GitHub HEAD, or create/verify a real ChatGPT conversation.

New approval begins `PAUSED / chatState=UNBOUND / transportApproved=false`.
The existing resume transition rejects a new approved-goal checkpoint while
ordinary ChatGPT identity is unverified. The workspace binding is also paused,
requires a fresh native approval and a no-pending-effects snapshot across all
existing PromptOutbox action families, and increments context revision. There
is **no cross-file atomic transaction**: a partial checkpoint/registry update
remains held until the native host independently reconciles it. Untrusted
model text or a source digest alone cannot activate or revise a goal. Revisions
are restricted to an unbound, paused, quiescent goal with the same repository,
branch and identity; changed scope requires new operator review.

`assessGoalGuardian` checks goal/revision/workspace/turn/source identity and
the exact approved next-action vocabulary on **trusted** feedback. It returns
only read-only `IN_SCOPE_CANDIDATE`, `DONE_CANDIDATE`, or review holds.
Exact action matching does not prove semantic correctness; neither worker
feedback nor a repository commit proves ChatGPT answer delivery or independent
QA. The existing trusted review/reconciliation composition uses this guard
when an approved-goal checkpoint exists, but never grants next-prompt authority.
The older Codex V1/legacy checkpoint flow is unchanged.

**Not implemented:** native entrypoint that attests/creates contracts, reliable
ChatGPT consumer New Chat/final response binding, runtime support for 10
independent approved-goal checkpoint instances, installed Windows behavior, or
unattended continuation. The manual handoff remains the only permitted chat
path. The new synthetic source fixtures are `TEST_AUTHORED_NOT_RUN`;
exact-HEAD Windows/Cargo/installed ChatGPT acceptance is `NOT_EXECUTED`.
See [acceptance gates](../validation/universal-chatgpt-acceptance.md).

## Context reuse and event-driven Guardian — source correction, 20 November 2026

The existing source-only `createVerifiedGoalRuntime` composition now offers
`continuationStatus({workspaceId,knownStateKey?})`. It holds the existing
scheduler lease, reads the original `CheckpointStore` and `WorkspaceRegistry`
once, checks exact goal/workspace/revision/source identity and returns a
**bounded status fingerprint**, phase, checkpoint/context revisions, and one
blocker/next-evidence reason. It never returns a transcript, objective, raw
checkpoint, operator credential or claim of source QA. Supplying a previously
returned `stateKey` yields `trackedStateUnchanged:true` only for the
**locally tracked checkpoint/registry facts**. It is **not** proof that GitHub,
the ChatGPT conversation, or external evidence has not changed. A fingerprint
is a presentation hint, not authentication, an approval or a reason to skip
source/receipt verification before effects.

`guardianReview` now avoids worker/GitHub/QA provider calls when its
preconditions hold but **no host-supplied receipt event** is provided. In
that case it reports `VERIFIED_RECEIPT_EVENT_REQUIRED` and holds; when an
event is supplied, the existing trusted review still validates identity,
evidence and independently admitted decisions. It may not trust a
caller-supplied receipt as proof or cache an unverified review. The Guardian
also recognizes the canonical supervisor action `CONTINUE` separately
from the worker's domain-specific `nextAction.action`, while requiring
that exact next action to appear in the approved Goal Contract.

This changes **only the existing source-only host composition**.
There is no new scheduler, state owner, UI, public MCP capability, native
transport or enabled consumer ChatGPT continuation. The installed
`workspace_goal.status` and Code Mode metadata path remain unchanged;
linking authenticated ChatGPT identity and source HEAD is still a separate
blocked admission gate. The synthetic regression is in
`test:verified-goal-runtime` and `test:goal-contract-guardian`.
Windows/native/provider acceptance: `NOT_EXECUTED`.

## Native Goal Contract intake and Code Mode health — 20 November 2026

`workspace_goal.prepare` accepts a bounded natural-language objective,
explicit acceptance, allowed actions, limits, repository/branch and a
**client-reported** 40-character commit. The exact proposal is normalized
by `src/supervisor/goal-contract.mjs`; native Rust generates the goal ID
and displays the canonical scope in one blocking OS Yes/No review.
No approval flag is accepted from Codex. Only the authenticated Rust
host's exact approval packet is accepted by the private gateway
`lazyprompting/workspaceGoal` commit handler. A declined or busy dialog
does not create a goal. One approved, immutable initial goal is stored per
workspace by the existing `CheckpointStore`; a second intake for the
same workspace is denied rather than overwriting the original.
The shared `PromptOutbox` rejects pending effects before approval/commit.
No new scheduler, durable ledger, interface panel or browser process.

`workspace_goal.status` reads the existing per-workspace checkpoint
and returns only identity/revision, phase, pending/reconciliation flags
and explicit denial of ChatGPT/QA proof. It never returns raw goal text,
tokens or prompt history. `code_mode.execute` may bind this sanitized
status using a **pre-existing native workspace lease** and optional
`goalWorkspaceId`; generated code calls
`tools.workspace_goal.status()` with no arguments. The same lease and
unchanged status are checked after Code Mode runs. One short composition
can combine it with existing read-only supervisor status.

**Deliberate limits:** The new path begins `PAUSED / UNBOUND`, with
`sourceVerified:false`, `chatTurnVerified:false` and
`nextPromptAllowed:false`. It does **not** register an independently
verified source binding in `WorkspaceRegistry`, replace Codex V1
`goal_run.*`, connect the optional ChatGPT-hosted `chat_goal.*`,
attest an ordinary ChatGPT New Chat/final turn, or enable automatic
continuation. A source SHA string and a user approval are not QA or
GitHub provenance. The installed Windows/runtime and provider token
efficiency evidence is `NOT_EXECUTED`.

## Modular goal-bound plugin source boundary — 19 November 2026

The new `src/mcp/chat-goal/` is a **source-only transport adapter**, not a live bridge from Codex to ChatGPT. Its input/receipt contracts and host-injected `bridge.mjs` prevent model text from selecting a workspace, asserting approval, marking QA verified or directly creating prompts. The ChatGPT-hosted widget may use MCP Apps `ui/message` only after the **existing Rust host** authenticates the caller and atomically reserves a single follow-up. A `sendMessage` acceptance is just the host UI request result, not a final authenticated ChatGPT response. Unknown delivery is held without replay.

Role separation is explicit: Codex V1 remains the approved coding worker, native Tauri/Rust remains the scope/STOP authority, existing `PromptOutbox` and checkpoints remain durable owners, and this plugin only transports and reports untrusted model progress. `DONE_PROPOSED` never means DONE. No OAuth server, production plugin endpoint, native callback, source-verifying Codex callback or multi-workspace automatic loop has been implemented; do not promote this module to live ChatGPT transport. The existing four-tool installed MCP facade and synthetic arithmetic probe are preserved. Validation is authored in `tests/chat-goal-bridge.test.mjs` and wired to the manual source preflight, not run here.

## Compact ChatGPT plugin → Codex review proposal — 19 November 2026

The existing `goal.report` tool accepts a concise optional
`nextAction` with CONTINUE and derives one
`CHATGPT_CODEX_REVIEW_PROPOSAL` from the untrusted report plus
native-bound workspace/goal/chat/epoch. Raw transcripts, report
receipts, access tokens, Codex run IDs and account identifiers are
not included. The source-only bridge passes this proposal to its
injected host callback without invoking Codex, creating authority,
claiming QA or releasing the PromptOutbox. Native one-time report
receipt matching, approved Codex run mapping and trustworthy final
ChatGPT result correlation remain independent blocked gates.

## Native read-only packet validation — 19 November 2026

A Rust-private source-only receiver now verifies the structured
`CHATGPT_CODEX_REVIEW_PROPOSAL` against the already owned
Codex V1 read-only source approval, pinned clean SHA, saved/live
ordinary ChatGPT URL and trusted host epoch. It checks the
cross-language canonical fingerprint, then projects only an
untrusted review candidate. No model-supplied report field
can authorize worker execution. This receiver has no active
OAuth/native plugin caller and does **not** prove a ChatGPT
account, in-chat final answer, one-use receipt or safe STOP
effect transaction. A successful source match is review data,
not permission to dispatch Codex.

## Plugin read-only progress query — 19 November 2026

The hosted plugin source now defines `goal.status`: no model-controlled
workspace or run parameters, one independently authenticated
and native-admitted read, and a bounded data-only response
without a widget re-render. Its Codex V1 state is an *existing native*
progress projection; neither running state nor source completion
is evidence of ChatGPT delivery, independent QA or operator
permission to execute. An unbound chat or absent trusted host
callback returns a hold, not an invented status. The separate
installed desktop MCP facade keeps its original four tools.

## Exact roles and owners

| Role | Responsibility / owner | Forbidden assumption |
| --- | --- | --- |
| Operator | Selects goal, repo/branch, acceptable outputs, account, budget and consent | No model may silently broaden permission |
| AI client / front door | Any admitted MCP-capable process invokes the **same four** installed Rust MCP tools | MCP initialize, client name and model text are not credentials |
| Host authority | Tauri/Rust authenticates the process, holds workspace leases, grants, STOP and approvals | Node gateway or renderer cannot issue their own grants |
| Deterministic supervisor | Existing `src/supervisor/`, `src/prompt/`, `src/runtime/` decides WAIT/VERIFY/PAUSE/STOP/DONE, owns outbox/checkpoint | Do not add parallel session stores or duplicate scheduler authority |
| Optional planner | A versioned, host-approved reasoning provider proposes bounded next steps | Proposal is never dispatch authorization or proof |
| Optional task worker | Exact approved `AgentBackend` provider runs engineering tasks through supported APIs/CLI | A provider is not automatically the ChatGPT conversational worker |
| ChatGPT conversation | **Ordinary ChatGPT Chat** in WebView2, with user-owned account/session and persistent history where supported | Browser tab, URL, app plugin and ChatGPT final response are not interchangeable receipts |
| Evidence and QA | Independent GitHub/source/verification receipts with pinned SHA and actual test evidence | A quiet web page, commit message, or AI answer is not QA or DONE |
| ChatGPT in-thread app/plugin (optional) | User-initiated tool invocation and `ui/message` only inside the conversation that actually hosts the app, when capability exists | Cannot create, bind, read or command arbitrary other ChatGPT chats |

Existing signed-in Codex `goal_run.*` is a **separate coding/worktree feature** and remains compatible; it does not become `chat_goal.*`. The V2 Codex/OpenCode source adapters are **not executed**. WebView2 displays ChatGPT; Lightpanda is a separate, restricted preview browser and never borrows WebView2 cookies or session identity.

## End-to-end flow: safe, usable now versus future gates

1. **Goal intake.** Operator chooses a workspace, repository and branch, explicit acceptance, action scope, time/turn budget and STOP conditions. Host pins goal identity and exact source ref. One MCP client may supply the request; no platform-specific goal grammar is assumed.
2. **Workspace attach.** The native host checks the client's process and workspace lease, opens or selects the existing WebView2 tab, and navigates to ordinary ChatGPT Chat if a new tab is needed. Same-tab switching does not create a new conversation. URL guards are **not** proof of ChatGPT account-side mode or exact conversation ID.
3. **Chat work — currently manual.** Verified MCP clients can use the existing four-tool facade and Code Mode `tools.handoff.prepare` to stage one native, unverified draft in their leased workspace. The operator reviews and copies it or explicitly invokes Send once; a queued UI action does **not** prove delivery. The project reference remains client-supplied, not verified by this draft. Code Mode has no automatic ChatGPT send or answer-reading capability.
4. **In-thread app option.** A user-invoked ChatGPT MCP app may return structured results or request an in-thread follow-up through `ui/message`, if the host advertises support. It is **not** a remote Codex-to-any-ChatGPT-thread transport, automatic plugin rebinding or final-answer callback.
5. **Evidence intake.** Use authenticated worker or app callbacks and independent GitHub/source/QA evidence. When there is no supported final ChatGPT receipt, request an operator-visible checkpoint; do not infer completion from browser idle.
6. **Reconciliation.** A single canonical `PromptOutbox` reservation precedes **any permitted automated send**, followed by authenticated ACK, result identity and evidence checks. An unconfirmed side effect becomes `RECONCILE_REQUIRED`; it is never blindly replayed. Manually typed prompts are not falsely recorded as authenticated host dispatches.
7. **Continuation.** The operator explicitly pastes a reply into the same workspace; the reply remains **unverified input**, not a ChatGPT result receipt. The main-window UI can atomically advance the existing native draft by exact fingerprint. A Code Mode client may use terminal `tools.handoff.continue` only against that same pending native fingerprint and its existing lease. Both paths require manual review, never automatically infer success or send again. If context is excerpted, the operator must inspect the original chat and independent evidence. A planner may propose a next step but cannot authorize work.
8. **Completion.** `DONE` requires acceptance and applicable independent QA; otherwise `WAIT/REVIEW_REQUIRED/BLOCKED/PAUSED` with evidence. Preserve ChatGPT history and the project checkpoint.
9. **Recovery.** After app/worker crash: freeze new sends, read canonical checkpoint/outbox, verify original workspace and exact chat identity where supported, and prefer **reattaching the same ordinary chat**. A new explicit **main-window-only URL bookmark** can save/reopen/forget a canonical `chatgpt.com/c/<uuid>` link on the operator's click without reading messages. This is navigation metadata, **not** account/session attestation; if identity, receipt or host support is missing, `PAUSED_NEEDS_USER` with a bounded recovery prompt. A new ordinary chat is only a deliberate context rollover, never a quota/crash workaround.

## Transport admission: no simulated capability promotion

| Channel | At this source baseline | Can it autonomously send prompts / read final ChatGPT answers? |
| --- | --- | --- |
| User-operated WebView2 / ordinary ChatGPT | Browser navigation source and earlier Windows browser smoke; latest mode unverified | **No external authenticated send/result channel** |
| Locally installed MCP clients → Tauri | Four-tool façade and browser operations; Codex/OpenCode client evidence from older Windows SHA | **No**: MCP browser access does not equal ChatGPT transcript access |
| ChatGPT-hosted MCP Apps / `ui/message` | Officially documented for app-hosting conversation, experimental arithmetic probe | **Only host-supported, in-thread app-initiated follow-ups; not arbitrary other chats or unattended completion** |
| Codex App Server / future worker providers | Codex V1 had Windows acceptance at older SHA; V2 adapters source only | **No**: these are distinct agent sessions, not ChatGPT consumer Chat |
| Extension / DOM / private endpoints / cookie replay | No consumer output transport approval | **DISABLED / not an acceptable replacement** |

The consumer service [Terms of Use](https://openai.com/policies/row-terms-of-use/) restrict programmatic output extraction. OpenAI's [MCP Apps UI guide](https://developers.openai.com/plugins/build/chatgpt-ui) documents `ui/message` inside a hosting app, not a universal external session API. Respect per-account feature/permission differences and do not assume a ChatGPT plugin remains selected for later turns.

## Universal adapter contracts — versioned, capability-driven

**Client adapter (MCP):** keep `status`, `search_capabilities`, `describe_capability`, `invoke_capability`; reuse the installed facade and process-identity lease. A Claude/Gemini/Cursor client must pass the same handshake, schema, workspace contention and STOP tests, without a name-based trust bypass.

**Planner adapter (optional):** `propose({goalFingerprint,latestVerifiedEvidence,lockedDecisions,allowedActions,budget}) → {proposedAction,reason,requiredProof}`. The result is data, not an executable command; no vendor must be installed to make deterministic WAIT/STOP decisions.

**Worker adapter (optional):** the existing V2 `AgentBackend` manifest, `probe`, `openSession`, `submitTurn`, `observe`, `cancel`, `reconcileReserved` remain the extensibility point for Codex/OpenCode/future supported providers. Native process/sandbox/receipt gates are required **per worker profile and capability**; unsupported actions stay unavailable. Preserve the Codex V1 `goal_run.*` route while V2 is being accepted.

**Chat transport adapter (separate):** future capabilities must be proved individually: `attachExistingOrdinaryChat`, `verifySessionIdentity`, `submitAuthorizedPrompt`, `observeAuthenticatedTurn`, `lookupDelivery`, `requestOrdinaryChatHandoff`. Each must declare `SUPPORTED_VERIFIED | UNSUPPORTED | UNKNOWN` with issuer, mode, version, identity scope and authorization proof; missing capability fails closed. No module may fabricate these callbacks from a URL, generic model API or model message. Do **not** register speculative capabilities in production MCP.

## Canonical state and compatibility

- **One goal source:** native-approved goal/scope and exact repo/ref; model-supplied replacements are rejected.
- **One dispatch source:** persisted `PromptOutbox`; ACK and reconciliation always bind to workspace/session/epoch/prompt/turn. Checkpoint state is host-owned, not inferred from ChatGPT UI.
- **Manual handoff:** the native host holds one volatile, unverified draft per workspace, including reviewable follow-ups. New unrelated drafts require exact operator dismissal; continuations require **atomic previous-fingerprint matching** in that same inbox. The native UI and Code Mode both use this owner. Restart requires review/re-preparation; no ChatGPT delivery, external response, QA or work completion is inferred.
- **Read-only evidence:** `VerifiedGoalRuntime.sourceProgress` uses the existing leased GitHub reviewer only when a trusted host is injected. The installed default gateway remains unbound; UI and public GitHub data cannot attest QA.
- **One identity source per layer:** native WebView object/tab, MCP client PID/lease, provider session and ChatGPT conversation must be correlated explicitly; never claim one ID proves another. In-memory `SharedProfileRegistry` is not persistent ChatGPT conversation recovery.
- **Existing four public MCP tools unchanged:** `workspace_chat.prepare_handoff` is a new **deferred read-only manual-draft capability** with native client/workspace lease admission; `goal_run.*` remains Codex V1 coding, `agent_run.*` V2 preparation/status/STOP only, `workspace_browser.*` browser control, and `workspace_chat.fixture_*` debug-only. `chat_goal.*` and `workspace_chat.submit` remain **PROPOSED, NOT REGISTERED**.
- Do not overwrite legacy v1 checkpoint schemas, split one outbox into competing vendor-specific versions, auto-change `Local`, or merge/release without direct operator approval.

## Acceptance and next implementation order

Read [Universal ChatGPT acceptance gates](../validation/universal-chatgpt-acceptance.md). Sequence: (1) fix source preflight and verify baseline, (2) prove multi-client MCP conformance and workspace leases with real clients, (3) confirm manual ordinary ChatGPT persistence/restart UX, (4) integrate only trusted evidence/QA and manual bounded continuation, (5) evaluate an officially supported ChatGPT in-thread plugin path within its scope, (6) **only if** a documented, permitted external consumer-host capability becomes available, implement native authenticated session binding and one-send/no-replay QA, (7) separately mature optional V2 worker providers and ten-workspace load acceptance.

**No external consumer ChatGPT unattended send/extraction, model replacement, automatic new chats, cross-repo pushes, CI dispatch or installer release is authorized by this design.**

## Current official online transport assessment (16 Nov 2026)

The user's selected destination remains an **existing ordinary,
persistent ChatGPT Chat** in WebView2. The one-shot user-click
send feature now binds its exact saved workspace `/c/<uuid>` URL
and checks `location.href` again inside the queued UI script.
This is a manual browser operation only; neither the URL nor
an `UI_ACTION_REQUESTED` result proves ChatGPT delivery, final
answer identity, source work or QA.

OpenAI's [Workspace Agents API trigger](https://developers.openai.com/workspace-agents/trigger-runs)
is a separately published agent workflow. It supports authenticated
input, `conversation_key` and idempotency; it does **not** expose
the completed response text or an external API for an arbitrary
ordinary consumer chat. [MCP Apps `ui/message`](https://developers.openai.com/plugins/build/chatgpt-ui)
is a host-supported in-thread bridge, not external access to all
tabs. The [current consumer Terms](https://openai.com/policies/terms-of-use/)
prohibit automatically/programmatically extracting service output.
Do not use these alternatives to justify consumer page scraping,
cookie replay, private APIs or unattended send/readback loops.
API product changes require a separately selected product target,
access/credential authorization and acceptance; none is activated.

## Cross-file task-N / workspace-NN boundary

Codex goal tasks and ordinary ChatGPT webviews are separate
native/CLI actors. The new `assertCodexTaskOutboxScope`
rejects foreign workspace IDs and operatorChat/browser
collections in a goal task-N outbox before a new provider
turn. Equal numeric suffixes never imply browser session
access or consent. The existing authenticated, operator-
reviewed manual draft handoff is the only approved context
exchange. This prevents incorrect cross-file identity
assumptions without adding a second state owner or blocking
unrelated independent Codex tasks. Genuine future jointly
authorized goal/chat actions need a separately approved
host-issued binding before they may share a lease.

## Workspace Agents beta run status is not a consumer-chat answer

OpenAI officially documents beta run-state lookup for
published Workspace Agents. It can show a genuine run's
lifecycle if authenticated and configured, but the completed
answer text is unavailable from that API. The response
has a distinct agent run ID; an arbitrary ordinary ChatGPT
`/c/<uuid>` message does **not** acquire that API.

Responses/Conversations API supports actual answer retrieval
for separately billed API conversations only. The
`assessChatTransport` gate now denies a manifest
declaring `WORKSPACE_AGENT` or `RESPONSES_API` product
family from claiming existing consumer ChatGPT support.
The pure product classifier remains descriptive; it
does not install credentials or launch a worker.

## Codex model execution

Managed model turns use the pinned Codex App Server with ChatGPT sign-in.
The transport requires a ChatGPT account and selects the built-in OpenAI
provider. Existing outbox records from the retired API mode remain stored
for compatibility and cannot launch a new run.
