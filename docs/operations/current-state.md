# LazyPrompting — Active Source State

**Selected repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Reviewed parent:** `5d54b53d5f593fc1145d180fea00f4dd3faa30a0` (20 November 2026).
**Surface:** `CHATGPT_GITHUB` — source development, not execution on the user's Windows PC.
**Current workstream:** Unified ChatGPT Companion, Codex-first ordinary ChatGPT goal intake, and conservative native rollover.
**Proof ceiling:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`; exact-HEAD Windows, Rust/Tauri, installed MCP, browser, native permission dialog and ChatGPT integration: `NOT_EXECUTED`.

This is the **single active continuation owner**.

## Source improvements from three Chrome extensions — 21 November 2026

Reviewed the original Chrome Web Store descriptions for AutoGPT
Autojourney (queue and templates), ChatGPT Automation (per-task status,
recovery and retry) and ChatGPT Slow Fix – Speed Booster (recent-message
visibility). Their feature claims are **source descriptions only**; the
distributed implementation was not verified and no third-party code was
copied. Independently verified CSS documentation explains
`content-visibility:auto` as a rendering hint, not guaranteed RAM
reclamation. No extra Skill installation, browser permission or UI was
added. Lessons were adapted into the existing Companion/Work owners only.

In the **shared Helium/WebView2 source**, the structural observer now
ignores self-owned mutations and message-body streaming churn, while
recognizing relevant turn/container, meter, notice and rollover UI
changes. Indicator text is only replaced on value changes. The one-click
rollover observer reads extension storage only while the current tab has
an armed nonce; it hydrates the last safe status once on page load.
Trusted first-send events request a coalesced check. This removes a
source-observed self-triggering rescan path without introducing telemetry,
message extraction, private APIs, prompt auto-send or automatic retry.
Synthetic positive/negative source fixtures and three controlled local
performance/recovery scenarios were authored.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. CPU, memory, input
latency, actual DOM selectors, WebView2/Helium and real deletion:
NOT_EXECUTED. Native Work/PromptOutbox destructive cleanup still requires
its separately owned gate.



## New Chat auto-remove through visible ChatGPT UI — source-only

The same Helium/WebView2 toolbar now has the owned LazyPrompting app
icon, aligned Context/Chat metrics, conditional warning, New Chat and
Settings at the right. New Chat's trusted click stores an exact Chat A
UUID plus per-tab nonce, navigates to the blank official new-chat page,
then waits for a **trusted first-send action** and a distinct saved
Chat B with a mounted message turn. Only then does it attempt Chat A's
exact visible sidebar menu > Delete > native confirmation. Any missing,
ambiguous, or changed selector/ID fails closed. One-shot DELETE_ATTEMPTED
storage is persisted before any destructive click; reloading cannot
repeat it. A failed target shows Old chat retained; an interrupted
attempt is classified unverified, not proof of removal.

**Native boundary:** This browser/UI operation cannot attest
native Work/PromptOutbox/checkpoint clearance or automatically reconcile
the existing Tauri old-chat cleanup ledger. Native Work permissions and
STOP remain unchanged. In a Work-bound WebView2 chat, do not confuse
this site-level deletion with an approved native rollover. A complete
host-integrated workflow is NOT VERIFIED.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Helium/WebView2
real selectors, deletion, account state, and native reconciliation are
NOT_EXECUTED. No third-party private API, background agent, cloud CI or
release action was added.


## Shared Helium + WebView2 Companion — current design

The user approved **one byte-identical extension UX and Settings contract**
for Helium and embedded WebView2. The former separate Helium compact-only
controller and native WebView2 legacy navigation/bookmark toolbar have been
replaced with a single canonical MV3 manifest and script/style set. Helium
packaging copies those same files; WebView2 NSIS embeds and byte-pins them.
There is **one inline strip**, **one settings gear**, no browser popup,
notes/export/navigation, manual token field, extra toast, or secondary bar.

The strip shows **Context ~X** from the separately installed original
Usage Meter's already rendered token scalar when available (otherwise
**Context —**), and **Chat Nx** only for a contiguous full structural
turn-index sequence beginning at the start of a chat (otherwise **Chat —**).
It shows **New chat soon** at 3.6M, **Switch chat** at 4M, both adjustable;
an upstream **Limit hit** label overrides planning, and bounded site
alert heuristics are explicitly **Possible**. No token, conversation or
quota source is invented. The original meter is not bundled or installed
by native WebView2, so *functional token-source parity is conditional*.
The same code and empty-state behavior is used on both surfaces.

Settings in both environments have **Compact History On/Off**, and keep
visible **Last 1 / 3 / 5 / 10 / 25 / Unlimited / Custom (1–1500)**.
One exchange is approximated as up to two structural turn nodes, not
semantic full-history analysis. Old loaded turns are hidden reversibly
with a **Show earlier messages** control; content-visibility optimization
remains bounded and fail-closed. Context Warning Edit/Done exposes only
the two M-token thresholds, validates their ordering and persists with
the other local settings. Reset restores On/Last 10/3.6M/4M. Browser
profiles have independent storage but identical UI and logic.

The existing native WebView2 Work/PromptOutbox/STOP and its separately
operator-reported 4M native Send once guard remain unchanged.
**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; installed Helium,
WebView2 and performance: NOT_EXECUTED.

The earlier Helium-only, popup/manual-token and native toolbar sections
below are **superseded historical source descriptions**, not active UX.

 The previous full 20 November development history is preserved in [the frozen source checkpoint](history/2026-11-20-source-development-checkpoint.md). Older [18 November Windows evidence](history/2026-11-18-windows-localtest.md), [prior installed acceptance](../validation/localtest-readiness.md), and original [16 November baseline](https://github.com/OpenITStudios/LazyPrompting/blob/3a7f277d05852ccf2d113c61b45421907402fa89/docs/operations/current-state.md) remain distinct; no past test result applies automatically to this source.

## Helium always-on compact with Usage Meter count — current browser scope

The previous Helium manual-token estimator, large toolbar, bookmarks,
navigation and popup/options UI are **superseded and removed from the
generated Helium extension**. The current Helium add-on always applies
the bounded Compact History renderer hint when supported. It has no
toggle, second strip, manual token entry, or background network access.

It adds `N pesan termuat` immediately beside the **Chat ~X tokens**
estimate already displayed by the separately installed original
SelectorsHub ChatGPT Usage Meter. The N is currently mounted structural
messages only, not total historical chat messages in a virtualized thread.
The add-on reads no raw ChatGPT transcripts or provider APIs; the upstream
meter remains responsible for its automatic estimate and limit-hit UI.
Short, dismissible 3.2M / 3.6M / 4M notices depend on that visible
estimate. No official quota or confirmed length limit is inferred.

The native WebView2 Companion, its native 4M report guard, and separate
ChatGPT transport policy are unchanged by this Helium-only scope.
**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; live Helium, site
selector compatibility and memory/performance remain NOT_EXECUTED.
The superseded Helium design sections below are historical context,
not the current package.

## Usage-style Companion UI and Helium popup — source-only rework

Compared with upstream SelectorsHub ChatGPT Usage Meter's visual organization
at `e59a8c5d2a364f522160190167fb4c1c70e0a438`, the old multi-row
Companion toolbar was reorganized into a single compact status pill
above the composer. Low-priority navigation/bookmark/selection/source
tools live in a small anchored Settings panel with disclosure controls.
Responsive CSS progressively hides optional detail; theme and keyboard
states are preserved. Per-chat Collapse and Compact preferences remain
explicit operator settings, not DOM removal.

The generated **Helium-only** MV3 manifest includes a small action Popup
and separate Options page. These read last observed chat metadata and
**user-reported** token estimates from local extension storage and offer
show/hide strip, compact-default, collapsed-default and local estimate
clearing. The popup cannot certify the currently selected chat, official
account quotas, reset times, real limit hit or native Windows sending.
WebView2 uses the same pill and its existing native Work/handoff owner,
without a second installed extension, remote data reader or private API.
Helium's initial preference hydration is awaited before new chat Compact
defaults are applied. No third-party UI assets or unlicensed code were
copied.

Source contract assertions cover the revised layout, generated manifest,
resource closure and the privacy/authority restrictions.
**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.
Helium, ChatGPT website, Windows/WebView2 and latency/RAM: NOT_EXECUTED.

## Standalone Helium Chromium extension — source-only package

Helium officially supports Chromium extensions. The existing MV3 Companion
is the only shared codebase; a reproducible package helper creates an
unpacked Helium variant with one standalone browser-only token estimate.
It stores manual counts per chat in extension storage and displays
3.2M/3.6M/4M advice without claiming official ChatGPT quota or blocking
ChatGPT's Send. Compact History defaults on in Helium alone, with per-chat
off/restore and protections for recent/selected/streaming turns.
Native WebView2's canonical operator-reported estimate and send guard
remain separate and unchanged. CSS rendering skips are not history
download prevention, DOM removal or measured RAM reclamation.

The source package and negative/positive parser fixtures are authored,
but browser installation, exact ChatGPT selectors and performance are
NOT_EXECUTED. No third-party source, private endpoint, transcript reader
or background network poll is added.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.

## Packaged Companion and UI limit notice — source-only integration

The NSIS resource map now bundles the source-owned Companion manifest,
scripts and CSS. The existing Windows opt-in enables the extension from
`$RESOURCE/companion/` when no explicit developer override is present.
All extension assets remain byte-pinned by the native loader. Installation
never downloads a third-party extension, intercepts fetch, or changes the
shared profile's permission owner.

A new read-only `limit-notice.js` examines short non-conversation UI alert
candidates and reports only `CHAT_LENGTH_POSSIBLE` or
`USAGE_CAP_POSSIBLE` in the extension toolbar. It does not extract model
answers, read full chats or private endpoints, send native messages,
interpret reset timestamps, or mark a chat full automatically.
The operator must verify a genuine chat-length refusal and choose the
existing **Work > Mark chat full** action. Model/usage quota is a distinct
condition. A previously stale 4M source regression is updated to match the
actual native guard. Source fixtures cover positive/negative alert cases and
the NSIS resource ↔ manifest ↔ pinned native-loader contract.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.
Installed Windows, live page UI, WebView2 extension acceptance and quota
signals: NOT_EXECUTED.

## Operator-reported 4M New Chat guard — source-only increment

The existing native bookmark remains the canonical chat-token estimate
and rollover owner. The public SelectorsHub ChatGPT Usage Meter was examined
for the screenshot, but its full-chat reading depends on undocumented
ChatGPT endpoints and network interception; no source is copied. Companion
shows **New Chat by 4M** as a planning target, not an automatically measured
token count or official ChatGPT limit. Work accepts reported values such as
`4,441,883` or `Chat ~4.44M`; no response, transcript, browser cookie or
private API is read.

Native status at **3.2M** is `LONG_CHAT_ADVISORY`; at **3.6M** it is
`ROLLOVER_DUE`; at **4M** it is `ESTIMATE_CAP_HOLD`, persisted with
`rollover_prepared=true`. The existing serialized Send once bookmark
admissions block at 4M, including at preflight and final queue admission.
Only an explicit correction below 4M followed by cancellation can resume
the old chat. The established Codex bootstrap, Chat B binding and
reviewed previous-chat cleanup remain user-operated; the app does not
automatically create/delete a remote ChatGPT conversation.

**Proof:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`.
Current Windows/WebView2, tokenizer accuracy, real site, native send races
and installed extension are `NOT_EXECUTED`.

## Conservative Compact History — source-only Companion increment

One **opt-in, per-conversation** Compact History control is included
inside the existing byte-verified ChatGPT Companion; there is no new
extension, service, memory store or browser API. `compact-history.js`
uses existing structural turn markers, measured per-turn heights
in bounded 48-turn batches, and CSS `content-visibility:auto`
to reduce offscreen rendering work. Pending batches are one-shot
and cancelled on disable/navigation, never continuous polling.
The newest eight mounted turns, active editing/selection and streaming
turns are excluded. On disable, navigation, unsupported CSS or more than
3,000 mounted turns, it removes only its own CSS hints. It does not
detach, hide, clone or retain old ChatGPT DOM nodes; it does not read
transcripts, intercept network responses or alter the native outbox.
Preferences use existing extension-local storage keyed by chat ID.

`tests/run-chat-companion.mjs` contains authored source and inert-DOM
regression assertions for mode off/on, newest/streaming/focus
exclusions, cleanup and 48-turn batching. The toolbar source
also includes a storage-failure rollback path. On real Windows, compare the same
long thread before/after using the existing read-only WebView2
**shared-profile** memory sampler and observable input/scroll behavior.
No specific RAM, CPU, or latency saving has been measured.

**Proof:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`;
Windows/WebView2/ChatGPT rendering: `NOT_EXECUTED`.

## Explicit rollover intent and reviewed cleanup receipt — source increment

A saved Chat A can now be replaced by Chat B only after the operator
explicitly chooses **Prepare New Chat**, or marks Chat A full (which
also prepares rollover). A normal bookmark change is rejected without
creating a deletion candidate. The Work action **Prepare New Chat +
copy Codex request** combines operator intent and recovery bootstrap
preparation; a failed native preparation does not copy a ready-looking
request. Preparation is stored in the existing
native per-workspace bookmark and blocks native Send once to Chat A;
an ordinary preparation can be cancelled. A save with no prior
bookmark continues to bind normally. Invalid unprepared switches
are rejected *before* the gateway/outbox read, avoiding an unnecessary
potentially slow preflight.

The manual cleanup review records `reviewedForManualDelete` on the exact
old/new pair only after native OS Yes, current URL recheck and the
existing no-pending-effect check. This review is an **operator
attestation**, not independent GitHub proof. A direct
`REPORTED_DELETED` call without such a review is denied; legacy
pending records start unreviewed. No extra database, AI, browser
plugin, remote delete API or broad automation was added.

**Proof:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN` source only.
Exact-HEAD Rust/Tauri, real ChatGPT, account identity and native
handoff/cleanup races: `NOT_EXECUTED`.

## Previous Chat Cleanup — scoped source increment, 20 November 2026

Native `chat-bookmarks` now stores one previous-chat URL alongside
the currently bound Chat B. A different new bookmark or removal cannot
discard a pending cleanup target. A changed bookmark requires the
existing canonical PromptOutbox to show no unresolved workspace effects
at save time. The original manual-handoff session-memory inbox is also
checked; pending drafts or a held draft mutex fail closed, without
waiting under the bookmark lock. The browser URL is read again before
binding to reject navigation races. **Keep previous chat** dismisses only the local reminder;
**Review and open old chat** checks exact URLs and PromptOutbox and uses
native OS approval to record operator review of the GitHub checkpoint,
new chat usability and unrecorded work. The previously bound Chat A
opens via the existing supporting-tab controller, with explicit
success/failure feedback; the protected main Chat B does not change.
An old-chat link can be copied if the tab cannot open. A reported
successful deletion closes the review tab only if its active registry
identity and ChatGPT URL still match; otherwise another tab is left
untouched. One derived Work summary displays Bind/Monitor/Recover/
Reconcile/Cleanup instead of independent competing status messages.
The user must choose Delete and confirm inside ChatGPT. The app records
a second explicit `OPERATOR_REPORTED_DELETED` confirmation, never
`serverDeletionVerified=true`. Failed reads or inconsistent navigation
hold cleanup. This is not a bulk deletion engine.

**Proof:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`; exact-HEAD
native Windows, real ChatGPT UI deletion, outbox/lease race,
two-chat binding, multi-workspace and restart behavior `NOT_EXECUTED`.

## Unified ChatGPT Companion — scoped source increment, 20 November 2026

The existing `chatgpt-composer` unpacked extension has been rebuilt as one
independently authored **LazyPrompting Companion**. Its small inline toolbar
offers turn-marker navigation (only loaded/visible thread structure),
operator-authored short bookmark labels, browser-native selective copy,
notes-only Markdown export, and manual HTTPS link review. Only storage and
the ChatGPT host are requested. The original independent popup send is
removed from the manifest; the native Send once/PromptOutbox/STOP remain the
sole supported application send path. No extra scheduler, browser profile,
AI model, output scraper, account API or private ChatGPT endpoint was added.

The browser displays **loaded turn count, not estimated full chat tokens**.
The existing local native bookmark owns any operator-reported token estimate
and the confirmed FULL hold. The previous 1M input ceiling has been expanded
to 100M (source guard only). Its former **1M+** advisory was superseded by
the **3.2M / 3.6M / 4M** planning thresholds documented above; none is an
official ChatGPT thread limit. The new
`workspace_chat.rollover_status` is an owned, native-lease-scoped
**read-only** capability under the same four public MCP tool names. It
projects only bookmark status and estimate, no transcript or extension notes,
and grants no send or response authority.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`; native compile,
WebView2 extension install and UI behavior, ten-workspace runtime,
MCP use by Codex, UX, CPU/RAM improvement and real limit detection:
`NOT_EXECUTED`. No consumer ChatGPT transport was enabled. The original
Usage Meter, Scroll and other external sources were reviewed for ideas;
no third-party source code was copied.

## Focused workflow cleanup — source only, 20 November 2026

The bounded context projection now distinguishes repeated entries from
actual loss of unique or truncated decisions; a skipped 64-entry prefix
still requires review. The existing desktop continuation helper validates
input only and no longer composes a competing prompt: Rust's current
`chat_manual_handoff.rs` is the single final draft owner. When Codex or
the operator supplies a specific reviewed next step, the same-chat
follow-up does not re-quote the entire previous draft or reply. Missing
next steps retain a short, explicitly unverified clarification excerpt.
The desktop identifies the smaller 3,000-byte Codex review input ceiling.

No new agent, state store, permission, MCP tool or consumer ChatGPT
read/send transport; native outbox, STOP and manual review are unchanged.
Source-level negative/positive Node and Rust fixtures are **authored but
NOT_EXECUTED**, including on Windows and real Codex/ChatGPT. No token,
memory or time saving has been measured.

## Preventive Chat Rollover — scoped source increment, 20 November 2026

The operator-visible Work panel and the original Windows-local
`chat-bookmarks` owner now hold a minimal per-conversation **reported
token estimate** and **confirmed full-chat digest**. At 1M reported
tokens a recommendation appears, never a verified ChatGPT hard-limit
or automatic switch. Operator-confirmed FULL is persisted and checked
before the native Send once reservation and again under the same
bookmark lock at the final queued WebView action. A new saved
conversation clears its own estimate but retains the bounded list
of prior full-chat digests. One copy action asks Codex to prepare a
verified repository/approved-goal resume prompt; creating the new
ordinary ChatGPT conversation, sending the bootstrap, and saving its
new URL remain explicit operator actions.

Existing browser profile, unified Companion, PromptOutbox,
native confirmation, STOP, identity, QA and privacy boundaries remain
in place. The third-party Usage Meter is only a research reference:
it was not bundled/installed and no private ChatGPT APIs,
session cookies, raw transcripts, output extraction, background
polling, AI model or server was introduced. This source cannot
automatically measure the chat's true size or guarantee proactive
hard-limit avoidance without an operator-reported estimate.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Exact-HEAD
Windows/Cargo/WebView2, installed MCP, live chat full/false-enter,
multi-workspace operation and measured efficiency: `NOT_EXECUTED`.
No runtime test, build, release, CI or tag was initiated.

## Product scope and installed proof boundary

- **Goal:** Up to ten logically isolated workspaces with ordinary persistent ChatGPT Web chats. The user assigns a task through Codex; LazyPrompting is the native owner of workspace, browser, permission, checkpoint and STOP. The Codex V1 worktree runner is a **different** goal type from a ChatGPT conversation goal.
- **Current supported chat path:** Operator-reviewed manual ChatGPT handoff with conservative recovery. ChatGPT consumer automatic response extraction and unattended prompting are not available and may not use undocumented private APIs or DOM scraping. Account/profile memory is shared; workspace isolation is logical, not a credential security boundary.
- **Installed MCP facade:** Four public tool names (`status`, `search_capabilities`, `describe_capability`, `invoke_capability`). Native capability metadata currently includes 25 entries in source; metadata discovery never grants an effect.
- **UI:** Browser plus workspace status by default. Manual browser controls and Work review are optional; native login, confirmation, recovery and STOP semantics remain untouched. Reducing visible UI is not evidence of less RAM.
- **Browser providers:** WebView2 is the human-visible shared-profile renderer. Lightpanda is a separate, permission-limited preview automation backend. They do not share ChatGPT account credentials or an assumed transport.

## Current source owners — new Goal Contract flow

| Purpose | Canonical source owner | State |
| --- | --- | --- |
| Approved goal schema/digest | `src/supervisor/goal-contract.mjs` | Bounded v1 contract; digest is not authorization |
| Per-workspace persistence | `CheckpointStore` via `src/prompt/native-workspace-goal.mjs` | New goals `PAUSED / UNBOUND` only |
| Native operator approval | `apps/desktop/src-tauri/src/workspace_goal_native.rs` | OS Yes/No, host-selected goal ID; no dispatch |
| Authenticated routing | Existing `browser_mcp_pipe.rs` + `gateway_session.rs` + private `mcp-gateway.mjs` | Native process identity, workspace lease, private gateway; no new server |
| Goal read | `workspace_goal.status` (native MCP) | Scoped summary with monotonic checkpointVersion; source/chat/QA unverified |
| Code Mode read | `goalWorkspaceId` → `tools.workspace_goal.status()` | Native-lease-bound compact projection; post-execution scope check |
| Worker and QA guard | Existing `goal-guardian.mjs` + trusted review/supervisor | Source-only candidates; no independent runtime QA |
| Effects and recovery | Existing `PromptOutbox`, workspace registry and STOP owners | Unknown outcomes held; no retry based on missing receipt |

**Unfinished connections, by design:** The native Goal Contract is not yet bound to the separate `WorkspaceRegistry.bindApprovedGoal` source path or a cryptographically verified ChatGPT conversation/turn. An operator-reviewed `baseSha` is **client reported**, not HEAD proof. Goal approval does not enable ChatGPT send, browser automation, Codex dispatch, or Code Mode writes. New goal's `sourceVerified:false`, `chatTurnVerified:false`, `nextPromptAllowed:false`, `qa:NOT_EXECUTED` must stay false until independent authority is present.

## Source cleanup and preservation

This checkpoint follows a focused cleanup of the most recent native goal and Code Mode additions. Scope is limited to consistent native/Node status validation, correctly scoped request routing, meaningful negative fixtures and developer documentation. It does **not** add new UI, services, state owners, browser engine, runner, token model or API transport.

All newly authored checks remain **`TEST_AUTHORED_NOT_RUN`** until the user separately starts the PC-local phase. The existing preflight includes `test:repository`, `test:goal-contract-guardian`, `test:workspace-goal-native`, Code Mode source/regressions, Windows Rust formatting/compile/unit tests, the Svelte build and packaged gateway closure verification. The structured fixture may count logical MCP round trips; it is **not** a measured token, RAM or latency saving.

## Targeted workflow efficiency — source follow-up, 20 November 2026

**Source parent:** `Local@8b68fddc954c2ed7ab31acaee5b8cb1a4ff7e695`. The native MCP fallback remains
compatible with the negotiated `2025-03-26` protocol: successful results
retain both `structuredContent` and full JSON `content.text`, because a
legacy MCP client may not consume the structured field. Source-only regression
fixtures protect that equivalence. This is **not** an observed reduction in
MCP wire bytes or model tokens.

The existing Code Mode `goalWorkspaceId` path now reuses the
already-authenticated gateway after the initial leased status read. The
scoped operation no longer performs another gateway tools/list probe before
Code Mode or after it; if the original child disappears, the recheck fails
closed instead of silently starting a new gateway. Native lease and
checkpoint version comparisons remain unchanged. The native
`workspace_goal.status` reply deadline is unchanged: a cold packaged
gateway bootstrap may take longer on low-end Windows hardware, so no
unmeasured timeout tightening is included in this cleanup.

The optional `npm run preflight:targeted` executes **13 selected existing
Node source-check scripts** instead of the full **72-script** manual preflight.
It does not run the Rust compiler, desktop build, installer, browser or native
permission dialog. The original `npm run preflight:localtest` remains unchanged
as the full validation gate. No actual speed, token, RAM, or CPU improvement
has been measured on this source.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Exact-revision local Node/Cargo/Svelte/Windows/MCP runtime:
`NOT_EXECUTED`. No CI/cloud runner, new UI, state store, scheduler,
new browser transport or release.

## Continuation workflow simplification — source-only, 20 November 2026

**Surface:** `CHATGPT_GITHUB`; selected parent:
`Local@468919b04e9859b70893a8b984cb2be6f1eb13e0`.
The existing source-only `createVerifiedGoalRuntime` (not an installed
ChatGPT transport) now projects a compact `continuationStatus` using the
same checkpoint/registry and exclusive scheduler lease. A bounded
`stateKey` marks **tracked local state** unchanged for a Codex-facing
continuation hint; it is not a GitHub HEAD, source change, ChatGPT turn
or QA attestation. `guardianReview` now requests an explicit host
receipt event before running expensive verified worker/GitHub review.
The Guardian's supervisor/worker action comparison is corrected:
supervisor `CONTINUE` is distinct from the approved domain next
action. No new database, MCP endpoint, UI, scheduler or model was added.
All prompt/send/STOP/permission gates and automatic ChatGPT transport
holds remain unchanged.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Synthetic positive/negative fixtures are authored in existing
`test:verified-goal-runtime`, `test:goal-contract-guardian` and
their native/mock scopes. No actual user-PC execution, installed
MCP/ChatGPT receipt, measured token saving or background agent run.
The native installed `workspace_goal.status` is unchanged.

## Adaptive ChatGPT Prompting Contract — source-only, 20 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent:
`Local@b6a0d50c4b360480e21289b8a8c0e798ac33ab0f`.
The existing `prompt-supervisor.mjs` now has optional task-type and
minimal/focused/deep presentation choices, plus deterministic
`assessPromptQuality`. It quotes client strings, enforces bounded goal/step
and 12 KB UTF-8 output, and only includes distinct acceptance/constraints.
`context-projection.mjs` keeps the most recent distinct context items.
Native `chat_manual_handoff.rs` now presents a common goal/acceptance/
reported context/next step/output/STOP shape, retaining the same installed
MCP schema and unverified manual-only receipt. Continuations retain
bounded, labeled operator-pasted excerpts; no extra model, agent, UI,
scheduler, database, permission or ChatGPT transport was introduced.

**Source owners:** [prompt contract](../architecture/prompt-only-supervisor.md),
`test:prompt-supervisor`, `test:prompt-budget-context` and native Rust fixtures.
**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Current PC, Windows, Cargo, installed MCP, actual ChatGPT answer quality
and measured model tokens/latency: `NOT_EXECUTED`.

## Conversation Reasoning Contract — source-only, 20 November 2026

**Parent:** `Local@c65cc50baf6a4bdf5173a9417e405eb153f35453`.
One pure `src/prompt/conversation-reply.mjs` contract now requires
literal GitHub URL, work instruction and goal for the strict first
repository prompt; for replies it prepares a bounded Codex reasoning
brief and validates an exact-context, quote-grounded model suggestion.
It distinguishes discussion/draft/revision from implementation claims
and model DONE. The existing `prompt-supervisor.mjs` returns only
`DRAFT_ONLY` for assessed replies; claims of completion require proof.
Native manual handoff displays repository URLs, requires work instructions
for repo-scoped drafts and uses the existing operator-pasted response/
nextStep path. Legacy generic manual MCP schema is preserved.

**Host limitation:** no installed Codex reasoning callback, authenticated
consumer ChatGPT reply reader, automatic send or new UI/service is added.
Model decisions do not grant approval, commit permission, QA or next prompt.
**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Native Windows,
Node/Cargo runtime, real semantic quality and token savings: `NOT_EXECUTED`.

## Goal-aware reply refinement — source-only, 20 November 2026

**Source parent:** `Local@05baf52ee90feb015fc551e6d6920c48bf255600`.
The existing one-owner `src/prompt/conversation-reply.mjs` now binds
review fingerprints to workspace plus optional complete
session/task/response/contextRevision; the injected Codex-host callback
**requires** that scoped tuple, although no real installed callback
is yet connected or independently attested. Long/full reply context
exceeding one 12 KB brief returns `FULL_REPLY_REVIEW_REQUIRED` with
no model call, no silent truncation and no proposed next prompt.
Mixed-question/claim/blocker feedback is held for evidence/permission
instead of promoting a secondary claim into DONE or a commit.
Design-fit candidates are explicitly **not operator approvals**;
revision candidates include their material issues. Unknown initial
acceptance is flagged for clarification, not fabricated.

The existing desktop and Rust manual continuation paths now request
operator clarification when the next step has not been reviewed, rather
than asking ChatGPT to advance work blindly. The original native
four-tool facade, handoff schema, PromptOutbox/STOP and installed
authorization boundaries remain unchanged.

**Evidence:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Additional multi-turn synthetic cases and negative assertions have been
authored in existing Node/Rust fixtures. No actual PC Node/Cargo/
Windows tests, Codex semantic result, consumer ChatGPT full-turn
transport, quality score or token performance measurement was obtained.
The managed Codex App Server owns a separate task/session and is **not**
promoted to ChatGPT consumer-host authority by this change.

## Native-bound Code Mode contextual reply — source-only, 20 November 2026

**Source parent:** `Local@ac1b66d6d9c32950f455939f9614a8c5f652ab98`.
The existing confined `src/gateway/code-mode-runtime.mjs`
now exposes a **read-only Code Mode builtin**,
`tools.handoff.review({previousFingerprint,context,assessment})`,
for Codex-authored semantic proposals against the original
native manual inbox. It requires the actual host-selected
workspace/fingerprint, applies the canonical conversation-reply
validation, respects optional native goal STOP, and produces
`REVIEW_CANDIDATE`/`REVIEW_REQUIRED` without side effects.
If a valid review precedes the existing `handoff.continue`
effect **within the same bounded code program**, only the exact
reviewed nextStep is accepted; denial happens before native
callback. Manual native operator review, outbox, and
source/ChatGPT/QA proof boundaries are unchanged.

The existing desktop follow-up input now describes the Codex
reviewed suggestion; no extra UI controls, agents, workers,
persistent stores, public MCP tools, ChatGPT consumer-Web output
extraction or unattended send were introduced.
Node Code Mode and native/desktop result contracts have
additional authored negative/positive synthetic regression cases.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Exact-HEAD Node/Cargo, Windows-installed MCP, Codex model judgment,
original consumer ChatGPT turn and measured performance:
`NOT_EXECUTED`. No runtime claim is made from this source commit.

## Decision Intelligence and contextual handoff hardening — source-only, 20 November 2026

**Source parent:** `Local@533f4685288e0e59eafe0adf6dd5af371384e301`.
The existing conversation-reply owner now accepts an advisory six-
dimension quality rubric with typed severity and per-criterion coverage.
Host-facing reviews require it; CRITICAL issues hold, MINOR-only
revision is rejected, and design-fit requires addressed acceptance
without treating model judgment as QA or operator approval. The
bounded context projection distinguishes current/superseded decisions
and reported progress, and marks limited context explicitly.
If the supplied context is known to be incomplete, semantic review
returns `PARTIAL_CONTEXT_REVIEW_REQUIRED` instead of relying on
an omitted decision or unreviewed response.
The prompt supervisor holds ordinary ChatGPT continuation when the
actual reply/semantic review is missing; Codex-local read-only
planning remains separate.

Code Mode's `handoff.review` now correlates optional native goal
ID/revision with the projected native goal state when supplied.
A same-run terminal `handoff.continue` must match the **exact pasted
reply AND reviewed nextStep**; review cannot switch to a new
`handoff.prepare` in that same run. The existing 3000-byte reply and
800-byte instruction budgets are enforced before effect staging;
over-budget proposals are held rather than silently shortened.
No new public MCP tools, persistent stores, permissions, scheduler,
model process or automatic consumer ChatGPT read/send path.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
The added Node synthetic cases and existing native draft fixtures are
authored only. Actual PC Node/Cargo/Windows, Codex reasoning
quality, ChatGPT turn attestation, QA and token/latency savings
remain `NOT_EXECUTED`. Runtime semantic evaluation is a separate
future permitted host validation, not implied by this source pass.

## Deferred local acceptance — when independently selected

Follow [localtest readiness](../validation/localtest-readiness.md) and [universal ChatGPT acceptance](../validation/universal-chatgpt-acceptance.md) on the **exact source SHA** at the time of testing:

1. Validate source + Node tests, Rust formatter/compilation/tests, Svelte and native gateway staging against the same ref; do not conflate mock/synthetic tests with Windows functionality.
2. On an actual Windows-installed host, inspect all four MCP public tools and the native `workspace_goal.prepare/status` schemas; confirm operator Yes/No, persisted `PAUSED / UNBOUND`, no send, and readback across restart.
3. Confirm Code Mode `goalWorkspaceId` can return a sanitized status under its existing lease. Deny foreign workspace, wrong snapshot, fabricated approval, stale lease, mixed run identities, missing ChatGPT proof and unknown effect outcomes.
4. Test isolation/recovery at 1, 2, 5 and 10 workspaces, with independent account/session checks. Record CPU/RAM and model tokens only when directly measured.
5. Keep the ChatGPT automatic transport feature **blocked** until the separately authorized, documented transport and final-turn receipt requirements are satisfied.

## Exit criteria

Source review may end at `SOURCE_READY_FOR_LOCAL` once code, regression fixtures, relevant consumers and documentation agree. This is **not** `EXECUTED_TEST_PASS`, `LIVE_TARGET_VERIFIED` or permission to release. If local evidence later detects a defect, reconcile the precise failing owner rather than adding another agent, UI panel or scheduler.

**Hold:** No automatic consumer ChatGPT prompting, no V2 worker dispatch, no CI/cloud-substitution test, no branch promotion or release.
