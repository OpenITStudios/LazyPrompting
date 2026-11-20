# LazyPrompting — Active Source State

**Selected repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Reviewed parent:** `05baf52ee90feb015fc551e6d6920c48bf255600` (20 November 2026).
**Surface:** `CHATGPT_GITHUB` — source development, not execution on the user's Windows PC.
**Current workstream:** Codex-first ordinary ChatGPT goal intake, minimal desktop UI and bounded Code Mode status.
**Proof ceiling:** `SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`; exact-HEAD Windows, Rust/Tauri, installed MCP, browser, native permission dialog and ChatGPT integration: `NOT_EXECUTED`.

This is the **single active continuation owner**. The previous full 20 November development history is preserved in [the frozen source checkpoint](history/2026-11-20-source-development-checkpoint.md). Older [18 November Windows evidence](history/2026-11-18-windows-localtest.md), [prior installed acceptance](../validation/localtest-readiness.md), and original [16 November baseline](https://github.com/OpenITStudios/LazyPrompting/blob/3a7f277d05852ccf2d113c61b45421907402fa89/docs/operations/current-state.md) remain distinct; no past test result applies automatically to this source.

## Product scope and installed proof boundary

- **Goal:** Up to ten logically isolated workspaces with ordinary persistent ChatGPT Web chats. The user assigns a task through Codex; LazyPrompting is the native owner of workspace, browser, permission, checkpoint and STOP. The Codex V1 worktree runner is a **different** goal type from a ChatGPT conversation goal.
- **Current supported chat path:** Operator-reviewed manual ChatGPT handoff with conservative recovery. ChatGPT consumer automatic response extraction and unattended prompting are not available and may not use undocumented private APIs or DOM scraping. Account/profile memory is shared; workspace isolation is logical, not a credential security boundary.
- **Installed MCP facade:** Four public tool names (`status`, `search_capabilities`, `describe_capability`, `invoke_capability`). Native capability metadata currently includes 24 entries in source; metadata discovery never grants an effect.
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
