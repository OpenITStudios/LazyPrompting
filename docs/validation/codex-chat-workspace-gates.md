# Acceptance gates — Codex-supervised ChatGPT workspace

**Status:** planned tests, **NOT_EXECUTED** against the design revision. Source baseline `3635067dd4888f86d750b36550d96cfba2d4d756`.
**Owner:** validation. Technical target: [chat workspace contract](../architecture/codex-chat-workspace-plan.md).
No automatic GitHub Action dispatch, real ChatGPT site automation, plugin installation, browser profile mutation, or Windows distribution is authorized by this checklist.

## Evidence ladder

- `SOURCE_REVIEWED`: exact SHA/code/docs inspected; does not prove behavior.
- `TEST_AUTHORED_NOT_RUN`: fixture/test authored, no execution.
- `EXECUTED_TEST_PASS/FAIL`: runner+OS+SHA+commands+exit and artifacts observed.
- `LIVE_INTEGRATION_VERIFIED`: actual installed Windows WebView2, signed-in host, control/channel, exact action and independent outcome observed.
- `PRODUCT_ACCEPTED` only after all applicable gates, operator acceptance and authorization. No screenshot, fixture or commit alone can upgrade another category.

## Gate 0 outcome — 11 November 2026

**Current verdict for unattended consumer ChatGPT Chat:
`BLOCKED_COMPLIANCE / HOST_UNSUPPORTED`.** OpenAI's consumer
[Terms of Use](https://openai.com/id-ID/policies/terms-of-use/)
prohibit automatic/programmatic output extraction. No supported
external consumer ChatGPT Chat send/response API or independently
authenticated final-turn receipt was established. Existing fixture tests
do not waive this gate. [Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview.md)
and the official Codex App Server are programmable alternatives,
**not** the same ChatGPT product. Selecting either requires
operator approval; none was assumed. Detailed primary-source finding:
[Gate 0 decision](chatgpt-consumer-transport-gate0-2026-11-11.md).

## Gate 0 — scope, transport and permissions (P0)

**Goal:** decide what may be used without relying on undocumented ChatGPT consumer APIs.

- Confirm operator target: Codex initial goal control; ChatGPT **ordinary Chat**, Personalized Temporary Chat where required, GitHub-first project evidence; 10 existing workspace views.
- Identify actual account-specific plugin capabilities and GitHub read/write availability in ordinary Chat / Personalized Temporary Chat without assuming enterprise/Work entitlements.
- Verify service Terms/permission of **unattended ChatGPT Web prompt submission** independently; never assume UI scriptability means permission. No ChatGPT private endpoints, conversation output scraping, cookies, CAPTCHA bypass, account or usage-limit circumvention.
- Verify whether a supported host can bind/restore a new chat and MCP app, or deliberately scope replacement to manual confirmation. No made-up create-session callback.
- Identify cross-repository write scope, allowed branches, required operator confirmation; no blanket grant from a goal prompt.
- If the above is unresolved, permit **fixture-only** proof and docs; do not run the automation against ChatGPT.

**PASS:** documented and approved allowed transport/host capabilities plus bounded scope. Otherwise `BLOCKED_COMPLIANCE` or `HOST_UNSUPPORTED`.

## Gate 1 — extension packaging and native bridge (fixture only)

**Preconditions:** checkout pinned to SHA; no external ChatGPT page; disposable Windows profile; installed Tauri/WebView2 version recorded.

1. Use the existing Tauri `WebviewBuilder.browser_extensions_enabled(true).extensions_path(...)` candidate. Confirm pinned Cargo.lock `tauri 2.12.5` / `wry 0.57.2` and WebView2 installed runtime. Validate the API in the **actual** target build (upstream docs alone are insufficient).
2. One source-controlled unpacked extension, immutable/versioned staged folder. Verify hash/manifest, reload/restart persistence, upgrade and rollback. Do not edit the live extension folder in place (WebView2 may uninstall it).
3. Ten child WebViews share one profile and identical extension-enable setting; application shell remains a different data directory. Test closed/background tabs and profile migration; confirm existing user data is not erased.
4. Validate a minimal channel: native host authorizes one fixture operation -> content-side observer sees it -> event returns with `workspaceId`, `epoch`, `promptId`, `sequence`; untrusted page cannot emit privileged approved messages.
5. Test whether MV3 messaging APIs actually exist inside this WebView2. Do not assume Chrome Native Messaging works. If absent, test **one** scoped native WebMessage bridge; choose one and document why.
6. No permanent exposed remote-debugging port; DevTools/CDP for QA only on disposable isolated profile. No cookies, tokens, message text or credentials in logs.
7. Force service worker termination/reload, WebView hidden, navigation, and host crash; preserve authoritative state in native host, not extension globals.

**PASS:** install, binding, event and cleanup observed on Windows for each applicable platform boundary; failed bridge leaves every mutating capability DISABLED.

## Gate 2 — prompt and completion behavior on owned synthetic chat fixture

A local fixture implements a composer, a Send control, thinking/streaming/idle indicators, errors, generated messages and navigation. Test it without paid model inference or ChatGPT accounts.

**Send cases:** empty/multiline/unicode/large but bounded input; disabled composer; Send disabled; wrong tab; background tab; manual typing during pending run; two concurrent calls; duplicate `promptId`; lost acknowledgment after side effect; refresh after input before acknowledgment; stale DOM/editor replacement; hidden overlay; modifier/IME input. Inspect that requested text, editable value and exactly one send are correct. Fake click success is not accepted delivery.

**Completion cases:** no start observed; short/long response; streaming pause; stop button flicker; assistant message incremental rendering; thinking/tool UI; explicit Continue Generating; manual Stop; network error/connection loss; loading spinner; regenerate; navigation/reload during generation; minified page/selector change; background timer throttling; new session epoch; stale observer event. Calibrate short stabilization interval only from measured fixtures; timeouts produce `UNKNOWN` not `COMPLETED`.

**Security and privacy cases:** forged content-script messages, replay, cross-origin navigation, injected instructions, oversized input, identity mismatch, user STOP during in-flight operation, permissions revoked, UI from another app. No data extraction, page JS eval exposed as MCP, arbitrary site action or silent bypass.

**PASS conditions (hard):** zero double sends in all fixtures; zero cross-workspace routing; zero false `UI_COMPLETED_OBSERVED` on error/manual stop or missing observed generation; all ambiguous deliveries held. A positive observed-completion fixture alone is NOT proof of ChatGPT compatibility.

### Fixture MCP control progress (source only)

The injected Node gateway source now contains `workspace_chat.fixture_submit`
and `workspace_chat.fixture_status`. Normal MCP use remains disabled without
a trusted test-host provider. The source test and the native IPC/extension
transport have distinct PASS requirements. A successful in-process fixture
test does **not** count as G1 installed WebView2 or G4 live ChatGPT.

### Native fixture bridge source milestone

The installed Rust four-tool MCP façade now routes debug-only
`workspace_chat.fixture_send/status` via the existing authenticated pipe.
The debug Tauri child WebView can optionally load the strict loopback-only
MV3 fixture extension. The page-visible message path is **not**
an authenticated native extension channel; status comes from the
owned fixture page and remains untrusted. One prompt remains in
`SEND_OUTCOME_UNKNOWN` until future independently authenticated receipt
reconciliation. Node VM/source fixtures passed, but exact Windows
Rust compilation and WebView2 runtime integration remain **NOT_EXECUTED**.
This is not Gate 1 or Gate 4 acceptance.

## Gate 3 — deterministic Codex/MCP/GitHub coordination

- Preserve four installed Rust MCP public tool names; new capabilities are deferred under `search/describe/invoke`. Stable schemas and effect annotation; unknown capability fails closed.
- Distinguish `chat_goal.*` planned namespace from current `goal_run.*` managed-Codex-worktree namespace.
- Host records single active prompt/epoch, monotonic deadline, run ID and branch scope. STOP/pause overrides model-suggested next action.
- GitHub verifier pins repository+branch+SHA; reads exact source at immutable SHA and independently compares the entire new commit range. Concurrent branch movement -> `REVERIFY_REQUIRED`.
- Simulate unrelated commits, spoofed task ID in message, stale repository status, test claim without receipt, branch mismatch, no commit, permitted content-only milestone, partial failure after GitHub write, and completion before/after source commit.
- A commit without applicable evidence never implies successful ChatGPT final answer; a visual completed signal without source change never implies accepted progress.
- Duplicate, missing and reordered events must not change authorized result.
- No Copilot/Codex/LLM inference for deterministic states; evaluate existing supervisor/outbox modules with real executable tests when available.

**PASS:** one bounded goal can generate at least 5 fixture iterations, preserve goal/branch, stop correctly, avoid stale source and reject fabricated QA. Record model calls only where reasoning is actually required.

## Gate 4 — live ordinary ChatGPT Temporary Chat (only after Gate 0)

Run under explicit account/site authorization, with a disposable, supervised goal and no sensitive data. Do not substitute Work, direct model API, ChatGPT API or a simulated fixture when claiming ChatGPT Chat proof.

- Confirm the selected tab really is **Personalized Temporary Chat** and permissioned features work; URL query alone is not proof.
- Verify sender support separately from observer support. If host accepts a prompt, record one observed UI result/associated workspace, without content scraping.
- 5 sequential short prompts in **one chat** with no duplicate, unintended confirmation, wrong context or silent tool drift. Observe differences between actual ChatGPT completion and UI heuristic. Do not read/retransmit assistant output.
- At each completed task, only supported GitHub/status evidence is passed to Codex. If no durable evidence, freeze and record `NO_VERIFIABLE_RESULT`; an apparently quiet UI must not trigger blind continuation.
- Document all manual interventions (plugin selection, permissions, chat creation) as interventions, not autonomous PASS.

**PASS:** permitted, observed, scoped sequence with accurate evidence and no hidden human operation. If unavailable, record a platform blocker and leave the live path disabled.

## Gate 5 — rollover and recovery

- Trigger by actual long-context behavior or operator-requested rollover, not exhausted plan quota. Create and verify a canonical snapshot before transition.
- Planned rollover: old session paused; pending prompt reconciled; scoped checkpoint pinned; new Temporary Chat capability proven; repository recovery prompt reads repo/branch/rules/status/commit range and independently verifies HEAD before work.
- Unexpected disconnection: find last **verified** GitHub state; never infer uncommitted progress; no duplicate chat creation after uncertain result.
- Verify actual new-chat creation, Personalized Temporary setting, login, tool/app availability, operator confirmation if needed and unique new session binding. If not supported, `PAUSED_NEEDS_USER`.
- Restart host and Codex worker; preserve monotonic deadline, outbox, last verified SHA and current workspace origin. Reject old-session events after epoch switch.

**PASS:** no duplicate send, no lost verified milestone, no silent branch change and no unacknowledged source write; unsupported automatic rollover is accurately marked NOT_IMPLEMENTED, not bypassed.

## Gate 6 — 10 workspace acceptance, quality and resource budget

- Stage 1 workspace, then 2 concurrent, then 5/10 slots with max 2 active turns (configurable only after measurement). Test different repositories, branches, user-manual interactions, mixed durations and simultaneous reloads.
- At most one in-flight prompt per slot, no cross-slot state, no login/session privacy claims (profile is shared).
- Verify UI status labels and STOP override under visual/keyboard/manual use; leave approved layout fixed.
- Observe memory/CPU and event counts with idle, 1, 2, 5 and 10 visible/hidden tabs. No default screenshots/AI inference or idle GitHub polling.
- Produce quality comparisons against the prior manual workflow: accepted milestones per ChatGPT turn, unsupported/uncertain state count, duplicate sends, manual interventions, recovery success, Codex reasoning calls, and GitHub API calls. No invented cost-savings claims.
- Explicit user approval before installer distribution, production server/network enablement, or a long unattended run.

**PASS:** zero cross-workspace identity leaks, zero duplicated mutations, no fabricated done, and transparent limitation on any incomplete platform-specific gate.

## Exit checklist — what must be established before implementation starts

- The protocol, owners and evidence boundaries are documented and reviewed.
- P0 compliance + platform capability truth is recorded, or implementation strictly constrained to offline fixtures.
- No parallel browser agent framework or secondary paid model is required.
- Test cases above are owned by canonical source/test paths; no duplicate checkpoint system.
- Any code PR/commit must cite exact approved gate and leave unsafe production capabilities OFF until acceptance.

**Current outcome:** this document is a test specification only; no QA has been executed on the new design.
