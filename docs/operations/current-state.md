# LazyPrompting — Active Source State

**Selected repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Reviewed parent:** `4f6bf5d4e230619ceb348798f26bb2d23a5718e0` (20 November 2026).
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
