# Universal AI Client → Ordinary ChatGPT — Product Contract

**Authority:** operator correction, 19 November 2026. **Stage:** selected product goal; automated ChatGPT browser loop not available. **Development branch:** `Local`. This document owns the chat-first product goal. [Universal Agent Orchestrator](universal-agent-orchestrator.md) owns optional execution-worker contracts, and [MCP architecture](../../mcp/ARCHITECTURE.md) owns the installed surfaces.

## Non-negotiable outcome

LazyPrompting is a Windows app with **ten browser workspaces**, each for an ordinary, persistent ChatGPT chat. The operator sets the goal and when to stop. In the selected workspace, LazyPrompting submits a prompt, waits for ChatGPT to finish answering, interprets the answer in context, and submits the next relevant prompt in the same chat. The loop ends when the goal is reached or the operator's stop condition is met.

Project context is recovered from the project's existing GitHub records using the documented continuation procedure. Keep the prompts tied to the selected chat, project and goal. The product uses the signed-in ChatGPT web chat without a paid model API. The steps below describe the available manual workflow and transport limits until the browser loop is available.

**Universality means compatible clients and optional approved planning/worker adapters — not replacing ChatGPT with another model.** Codex, OpenCode, Claude Code, Gemini CLI or editors can act as clients only when their actual MCP integration is installed and verified. Acting as an MCP client is *not* evidence that a provider can execute `AgentBackend` jobs or control consumer ChatGPT sessions.

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
