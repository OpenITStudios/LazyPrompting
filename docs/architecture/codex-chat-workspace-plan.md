# Codex-supervised ChatGPT Temporary Chat — Proposed Control Contract

**Authority:** operator-selected target, 2026-11-11. **Stage:** DESIGN / FEASIBILITY; NOT IMPLEMENTED; NOT RUNTIME-VERIFIED.
**Target repo:** OpenITStudios/LazyPrompting at branch `Local`. **Audited source baseline:** `3635067dd4888f86d750b36550d96cfba2d4d756`.
**Product UX:** the existing Tauri/Svelte layout and ten workspace tabs stay fixed; only accurate status indicators may be adjusted.
**Do not use this document to override `AGENTS.md`, `GITHUB_RULES.md`, account policy, or actual host capabilities.**

## User-approved mission and role direction

The user instructs **Codex once** (workspace, repository, branch, immutable goal/acceptance, allowed scope, time budget). **Codex supervises**; a **ChatGPT Chat / Personalized Temporary Chat** is the proposed primary conversational worker; **LazyPrompting** owns deterministic routing, browser state, authorized dispatch, evidence and recovery. GitHub belongs to the selected *project*, not necessarily to the LazyPrompting repository. No ChatGPT Work, no model-as-browser-controller, no screenshot/OCR or extra model inference for routine transport.

A planned autonomous cycle is:

```text
Operator -> Codex command (goal + scope + deadline)
Codex -> LazyPrompting desktop MCP (4 stable public tools; deferred capabilities)
Native host -> one workspace's persistent, bounded prompt outbox
Permitted chat send interface -> ChatGPT Classic/Temporary Chat
Status observer -> host (started / active / UI-idle / error / unknown; no answer text)
After safely observed completion -> authenticated GitHub read at pinned ref
Host reconciliation -> Codex goal review when evidence requires reasoning
Codex -> one next bounded prompt, or VERIFY / WAIT / PAUSE / DONE
```

This is a **target**, not proof that ChatGPT consumer web pages expose a permitted, stable unattended communication transport. Do not assume that a Chrome extension's ability to click a UI confers authorization to run this loop against ChatGPT or access private endpoints. No deployment or activation against ChatGPT until compliance/authorization and live capability gates pass.

## What exists vs what does not

| Existing source owner | Verified source scope | Proposed delta |
| --- | --- | --- |
| `apps/desktop/src-tauri/src/mcp_stdio_host.rs` | Installed Rust stdio facade; fixed `status`, `search_capabilities`, `describe_capability`, `invoke_capability`; `workspace_browser.*` and `goal_run.*` | Advertise new scoped chat-goal capabilities behind existing four names; keep old callers working |
| `apps/desktop/src-tauri/src/embedded_webview.rs` | Ten child WebView2 views share `browser-01` data directory; currently no extension enabled; UI shell has a different profile | Extension-enabled profile proof, signed resource staging, per-WebView origin/session binding |
| `apps/desktop/src-tauri/src/browser_mcp_pipe.rs` | Session- and executable-checked local browser action channel | Strict chat-capability boundary and trusted native IPC; do not broaden arbitrary script access |
| `src/mcp/chatgpt-probe*.mjs` | Experimental arithmetic MCP Apps send/report test | Keep diagnostic only; cannot be assumed to solve external orchestration |
| `src/prompt/prompt-outbox.mjs`, `src/runtime/workspace-registry.mjs` | Durable reservation and workspace identity foundations | Reuse, do not introduce another work queue or source-of-truth session store |
| `src/supervisor/`, `src/prompt/` | Decision, checkpoint, supervisor and handoff source contracts | Integrate only at the canonical owner after transport approval |
| `src/integrations/` | Existing GitHub evidence adapters | Reuse immutable-ref read and reconciled diff; verify exact repo and branch |
| `src/transport/` | Managed Codex/App Server functionality | Use Codex as the *supervisor*; existing `goal_run.*` coding-task semantics remain distinct |

`goal_run.start` currently executes bounded Codex tasks/worktrees. **Do not silently reuse or repurpose it** to mean Codex-supervised ChatGPT conversations.

## Browser extension decision — narrow, non-extracting adapter

First candidate: a **single internally authored unpacked Manifest V3 extension**, bundled with the desktop app, enabled only in the **shared workspace WebView2 profile**. It provides:
1. `PromptSender`: check the intended workspace, active URL and editable/send-ready state; stage an approved prompt; request exactly one send. Prefer an explicit send control to synthesized Enter so multiline prompts remain intact. An element or DOM click is **not** a send/receipt proof.
2. `ResponseStatusMonitor`: detect evidence of generation start, stop/continue indication, settling, errors, manual interruption, navigation and page lifecycle. Emit **status only** (no assistant text, screenshots, tokens, cookies, ChatGPT network/API payloads or conversation export).
3. `Health`: observer version, origin, document epoch and bounded monotonic sequence; a missing/ambiguous signal is `UNKNOWN`, never `DONE`.

**No generic script execution, arbitrary site navigation, ChatGPT private API interception, session-cookie extraction, CAPTCHA bypass, or browser-agent LLM.** Monitor/sender must not be loaded outside the host-approved origin. The extension has no authority to issue repository writes or approve its own task.

**Platform proof first:** the pinned Tauri 2.12.5 / Wry 0.57.2 sources support `WebviewBuilder.browser_extensions_enabled` and `extensions_path`; Windows WebView2 supports unpacked extension installation. All views using one data directory must use compatible extension-enable settings. The application shell uses a separate data directory and stays extension-free. WebView2 may lack standard Chrome browser UI extension entry points; use existing Tauri UI. Install a versioned **immutable extension directory**: modifying an unpacked installed extension's files can remove it from the profile. Test locked runtime and packaging before assuming the APIs work; do not add a second custom extension installer if Tauri works.

**Communications choice is a proof gate, not an assumption:** test extension content script -> MV3 background -> supported native channel in a locally owned fixture. Chrome/Edge Native Messaging exists for full browsers, but its availability and security properties in the pinned WebView2 host are **not assumed**. If that interface cannot be used safely, assess a **single native WebView2 WebMessage bridge** with validated origin and request identity; do **not** run two competing privileged bridge implementations. Web content and extension messages are untrusted; host authorization must remain independent.

A separate Chrome DevTools MCP or Playwright connection is for **focused QA/debugging** on disposable profiles, not a required production component. Disable exposed CDP debugging ports in distribution.

## Minimal MCP capability proposal (behind existing public four)

| Capability name (proposed, NOT REGISTERED) | Request / result intent | Authority |
| --- | --- | --- |
| `chat_goal.start` | Goal id; workspace id; repository/branch; acceptance; scoped permission; maxWallSeconds; maxTurns; expected HEAD; limits | Native operator-confirmed start. Creates bounded host-owned run. |
| `chat_goal.status` | Goal id -> authoritative checkpoint, latest event, wait reason and deadline | Read-only |
| `chat_goal.control` | Goal id + pause/resume/stop; stop revokes further dispatch | Only host-authorized control; no model override |
| `chat_goal.report` | Accepted evidence, attempted turns, blockers, usage estimates, final verdict | Read-only |
| `workspace_chat.submit` | Workspace, session epoch, goal id, unique prompt id, text, expected fingerprint and grant | One reserved send, no blind retry; unavailable until transport gate passes |
| `workspace_chat.status` | Workspace + epoch -> UI state, observed event, evidence cursor, current prompt | No assistant response text or transcript |

Avoid duplicate public MCP tool names and avoid multiple schemas for the same capability. The installed Rust facade remains the Codex-facing owner; internal Node gateway changes only if its host-owned composition actually requires them. Existing `workspace_browser.*` remain unchanged. Initial implementation must be **disabled by default** and fail closed.

## Single-workspace message lifecycle and proof vocabulary

`UNBOUND -> READY -> RESERVED -> INPUT_ATTEMPTED -> SEND_OUTCOME_UNKNOWN or SUBMIT_ACCEPTED -> GENERATING -> UI_SETTLING -> UI_COMPLETED_OBSERVED -> SOURCE_RECONCILED -> NEXT_READY / DONE`.

Terminal or interrupting branches: `ERROR`, `USER_STOPPED`, `RECONCILE_REQUIRED`, `NO_EVIDENCE`, `PAUSED`, `BLOCKED`, `WAIT_QUOTA`, `DEADLINE`. Browser UI completion is **not** a verified ChatGPT final answer or repository progress; similarly, commit movement is **not** chat-turn completion.

**Safety invariant:** reserve and persist `goalId/workspaceId/conversationEpoch/promptId/promptDigest` BEFORE side effect. Correlate observations to the reserved epoch and active view. No duplicate prompts when acknowledgement was lost, after reload, when the extension worker dies, or when manual input occurs. An unknown send remains held. Never fire next send from a timer alone; dispatch requires a matching status and reconciled task evidence.

**Detection quality:** observe real start before completion; do not equate disappearance of Stop alone with successful completion. Require no error/manual stop and a settling window whose duration is calibrated in fixtures, not hard-coded as an absolute proof. Background timer throttling, focus changes, virtualized DOM, regenerated answers, multiple assistant segments, tool-confirmation dialogs, page reloads and unexpected locale changes must be separately evaluated. If selector mapping breaks, fail closed rather than guessing.

## GitHub-first context, not GitHub as a chat transport

On each *project* workspace, Codex binds the user-authorized repository and branch to a pinned HEAD; the smallest relevant documents are `AGENTS.md`, `GITHUB_RULES.md`, `CONTEXT.md` (when present), the repository's canonical active status path, and actual changes. The repo may differ per workspace; do not hardcode OpenITStudios/LazyPrompting as every project's source.

After completion is **observed**, inspect current HEAD; if changed, compare *all commits* in the saved SHA..new SHA range, read changed files and test receipts when necessary, and verify branch ancestry and task scope. Compare the actual source to acceptance criteria. A commit title, author claim, status paragraph, or AI-supplied SHA cannot independently prove QA or task completion. Record source provenance and exact evidence level.

**Do not demand a no-op Git commit after every conversational turn**; it pollutes history. Prefer meaningful source/milestone commits and a compact canonical status update when needed. If there is no corresponding committed evidence and no approved structured callback, the host cannot know the exact last ChatGPT answer. Report `NO_VERIFIABLE_RESULT` or ask for a targeted checkpoint; never invent the answer or blindly continue. A GitHub watcher sees source changes, not the assistant's hidden reasoning or response.

## Temporary Chat rollover and context recovery

User-selected intent: ChatGPT **Chat**, normally **Personalized Temporary Chat**, to avoid filling history. Chat mode and plugin availability must be verified for the actual account. Temporary chat may use existing plugins in Personalized mode and does **not** create a persistent history entry by default. The provided `?temporary-chat=true` URL is a convenience hint, **not** a verified API or a guarantee that a usable chat/plugin binding exists.

Rollover on genuinely long/failed conversation (not depleted account quota):
1. Pause new sends; resolve pending prompt/side-effect uncertainty, or hold `RECONCILE_REQUIRED`.
2. Persist the **latest verified** project HEAD, exact goal/acceptance, locked decisions, approved scope, outstanding risks, required proof, and previous session identity.
3. Prepare a replacement Temporary Chat only via a capability actually supported by the host. Do not assume arbitrary new-chat API, plugin auto-selection, or direct ChatGPT consumer session identifiers.
4. Bootstrap first prompt: repository URL + branch + last verified SHA + goal; instruct ChatGPT to read rules, canonical status, relevant diffs and prior completion evidence, reconcile concurrent changes, then state what remains before writing.
5. Only after source and session binding are verified, resume one prompt. Unverified / in-progress local work is `UNKNOWN`, not silently preserved.

**Automatic replacement and full unassisted rebinding of ChatGPT Classic sessions remain UNPROVEN.** The source handoff coordinator currently accepts injected host callbacks; those callbacks are not a verified chat service. When not supported, generate a bounded resume prompt and enter `PAUSED_NEEDS_USER`. New chats must never be used to bypass account usage limits.

## Goal owner, duration, resource and budget constraints

A four-hour goal is a **maximum allowed window**, not a promise of continuous AI execution or eventual completion. Tauri/native host persists the run and monotonic deadline independent of whether the initiating Codex chat remains open. It cannot assume the Codex App Server will run forever or that ChatGPT will always respond. On expiry or explicit user STOP, revoke new sends, reconcile outstanding operations, preserve checkpoint and report what remains.

Ten slots are available. Start with **at most two concurrent active interactions**, one outstanding prompt per workspace, and fair admission across goals. Separate logical workspace/session IDs even though the ten views share one browser login/profile. A shared login means shared cookies, sign-out, policies and account usage limits: tabs are not security-isolated account identities.

Zero-waste policy: event-driven status observation, small in-flight GitHub checks after meaningful events, bounded fallback polling while active only, deterministic source comparisons before Codex inference, compact incremental prompt context, and no second browser reasoning model. Report actual turn counts/latency/context and quality; do not guess monetary savings.

## Source milestone: browser Send mechanism, no live activation

The fixture-only MV3 adapter is at
`apps/desktop/browser-extension/`, with deterministic Node tests.
The separate `src/browser/chatgpt-send-candidate.mjs` is a **not-imported**
send-only target-site prototype, using an injected native-host admission
callback. It stages input and requests Send without scraping output; it
never treats a click as a host acceptance receipt.

The actual Codex→Tauri→extension bridge remains absent. The complete
integration requires authenticated single-use host commands and an
independently observed status. Site-specific selectors and React input
behavior have NOT been proven. Keep ChatGPT host permission absent from
the shipped fixture manifest until G0/G1/G4 pass.

## Implementation ownership — proposal only

- `apps/desktop/browser-extension/`: one compact MV3 extension (content state/sender + minimal background), **only after fixture/runtime proof**; manifest host permission narrowly scoped. No third-party extension bundles.
- `apps/desktop/src-tauri/src/`: host-scoped WebView2 extension admission, view/epoch binding, validated one-use command channel and lifecycle.
- `apps/desktop/src/`: preserve existing layout; display accurate workspace states and user pause/stop, no new layout redesign.
- `src/prompt/` / `src/supervisor/`: reuse prompt outbox, decision and handoff owner; do not duplicate queues/checkpoint stores.
- `src/integrations/`: read-only GitHub HEAD/compare/receipt verification.
- `mcp/`: only nearest-owner documentation/adapter contract; four installed public tool names unchanged.
- `tests/` and scoped native tests: fixtures, deterministic protocol, recovery and cross-workspace cases.
- Existing Lightpanda preview remains **separate** from the ten authenticated WebView2 chat tabs; it does not inherit cookies or grants.

## Source increment: injection-gated fixture MCP control

A synthetic `ChatFixtureHostBridge` has been authored at
`src/browser/chat-fixture-host-bridge.mjs`. It is routable through
`CapabilityRouter` only when the **trusted test caller injects** the
`fixtureBridge` provider. The two deferred capability names are:
`workspace_chat.fixture_submit` and `workspace_chat.fixture_status`.
Normal gateway boot constructs no such provider, and the installed Rust
desktop continues to expose its unchanged browser/goal-run capabilities.
No `chatgpt.com` origin, output reading, plugin auto-binding or new
MCP public top-level tool is added.

It validates exact workspace/epoch/origin identity and native-host admission,
enforces a per-workspace pending lock and a two-active-slot default,
consumes fixture grants once and holds any dispatch outcome not acknowledged
by the **fixture host**. Only a private host-side observation method can
advance a simulated turn to `UI_COMPLETED_OBSERVED`; only independently
verified fixture evidence can free the slot. Real GitHub proof, durable
PromptOutbox integration, native named-pipe binding, actual WebView2 messaging
and authenticated source receipts remain **unimplemented** for this chat
path. This fixture's memory state is not durable production state.

The follow-up implementation owner is the installed **Rust desktop host**;
it must not advertise this test-only capability as a usable ChatGPT UI
transport without real Windows extension/host proof and a permitted host
connection. For QA see [fixture MCP bridge contract](../validation/chat-fixture-mcp-bridge-2026-11-11.md).

## Fixture profile safety correction

The debug fixture loader now selects `browser-profiles/fixture-debug` rather
than the existing signed-in `browser-profiles/browser-01`. It pins all
extension assets with SHA-256, not just the manifest host scope. The
installed WebView2 extension mechanism and authenticated messaging still
require Windows integration evidence. The profile change is **debug-only**;
the normal ten-browser layout and shared-login behavior are unchanged.

## Native-owned direct Send — fixture implementation decision

For the **owned localhost fixture**, Codex's MCP request stays under the
installed Rust host's authority; Rust uses the existing per-workspace
WebView handle and the Tauri `eval` API with a compile-time embedded
`chat_fixture_send.js`. This replaces the former page-visible
`window.postMessage` command/acknowledgment adapter. No untrusted webpage
can grant native approval via a message in this design. Extension code
remains useful for status observation, not for granting authority.

The JS script checks exact localhost URL, fixture path, editor actionability,
pre-existing user text and duplicate prompt IDs, then requests a single
button click. The native host reserves **before** the side effect.
It never treats `eval` as proof of delivery. Native status from a local
page is only an `observationTrusted=false` hint; source/commit evidence
and Codex's goal criteria are still separately required. The JS does
not read or transmit ChatGPT Output. There is **no production
`chatgpt.com` origin enablement**, and this source cannot claim
autonomous consumer ChatGPT operation.

This reduces the number of privileged channels needed for the fixture.
Future production completion notification must use a verified,
authorized transport (official host API or authenticated extension
worker/native channel), **not** a page-visible event handler.

## Source increment: multi-project GitHub-first progress (no live worker loop)

Existing canonical integration owners now support an **explicit** host-bound
`{repository,branch}` scope per project:
`GitHubEvidence.changesSince({baseSha,maxCommits})` and the
`ReceiptReconciler` optional scoped constructor. This corrects historical
`Local` / LazyPrompting-only assumptions without changing the existing
unscoped compatibility path.

- The source reader pins branch HEAD, compares the complete bounded commit
  range from the last checkpoint, checks GitHub merge-base ancestry,
  commit count, unique SHAs and branch movement during the read. It
  rejects incomplete/divergent histories and returns only compact commit
  identifiers/headings, no full transcript, no ChatGPT Output.
- A commit SHA is **source evidence**, not proof that ChatGPT ended its
  response, that QA ran or that the goal is done.
- When a separate trusted receipt is available, scoped reconciliation
  requires exact project/branch, goal ID, prompt ID and matching SHA.
  `NOT_EXECUTED` QA never authorizes completion.
- The host itself **must** bind the authorized project scope and provide
  read-only GitHub credentials. Neither the model nor an untrusted page
  may create or change that binding. There is still no production
  workspace -> provider wiring, no source watcher and no live response
  transport. Use the current outbox/registry/supervisor rather than
  introducing another queue or checkpoint owner.

See [executed fake-HTTP QA](../validation/github-progress-scope-2026-11-11.md)
for capability and failure boundaries.

## Main-goal source composition: GitHub progression review behind MCP

The implemented `src/prompt/github-goal-review.mjs` now joins:
`WorkspaceRegistry.read` -> `PromptOutbox.pending` ->
`verifyTurn` (host-owned) -> scoped `GitHubEvidence.changesSince` ->
`ReceiptReconciler.reconcile` -> `evaluateContinuation`.

This is a **read-only decision preview**, not a new orchestrator loop or
checkpoint store. No GitHub fetch or Codex reasoning call is made when
workspace/session/outbox identity is invalid or an authoritative host
turn-completion result is unavailable. A UI status-only extension is
explicitly insufficient. A SHA change can be returned for independent
Codex inspection without declaring response completion or QA success.

`chat_goal.progress_review` is visible behind the **existing four
MCP tools** only if a trusted host explicitly injects a reviewer
with `inspect`. It remains disabled in the standard Node gateway
startup and is not yet wired into the installed Rust desktop MCP.
Even a successful review returns `nextPromptAllowed=false`;
the existing registry, outbox and scheduler must complete a durable,
authorization-checked reconciliation **before** any actual next send.

Source QA: [GitHub goal review](../validation/github-goal-review-2026-11-11.md).
Live consumer ChatGPT transport, official terminal-response receipts,
Windows/WebView2 acceptance and automatic new Temporary Chat handoff
remain unresolved platform gates.

## Blindspots to gate before production

| Priority | Problem | Safe disposition |
| --- | --- | --- |
| P0 | ChatGPT consumer-web unattended auto-send and automated output restrictions | Independent policy/permission gate; no output scraping/private endpoint; no site automation until approved |
| P0 | Native extension messaging in actual installed WebView2 | Prove two-way event routing and secure authority on synthetic local site |
| P0 | Uncertain send or commit outcome | Durable outbox/idempotency; hold, do not retry by guess |
| P0 | Lack of authoritative ChatGPT turn-completed event | UI completion stays observational; require source evidence before next prompt |
| P0 | No source commit or unavailable write permission | No fabricated result; checkpoint/PAUSE unless an approved structured receipt exists |
| P0 | New-chat creation/plugin binding for Personalized Temporary Chat | Capability-gated rollover; manual recovery when unsupported |
| P0 | Cross-workspace origin/session/goal contamination | Bind IDs to native WebView object + epoch; reject mismatch |
| P1 | MV3 service-worker sleep, background tab throttling, DOM/locale drift | Persist owner state in host; event-driven observer, bounded watchdog, fail closed |
| P1 | Shared login/profile across 10 tabs | No claimed account isolation; protect cookies and global sign-out; respect quota |
| P1 | Codex supervisor closed/restarted during a multi-hour run | Host-owned deadline, persistent state, explicit resumption |
| P1 | React/contenteditable composer and non-trusted synthetic input | Fixture-level focus/value/send actionability proof; never treat .click() as accepted |
| P1 | Tauri profile settings, extension folder mutability and distribution | Same profile settings, versioned immutable staging, integrity check, rollback |
| P1 | Concurrent GitHub pushes and false commit attribution | Pin HEAD, compare range, validate scope/provenance and report conflicts |
| P1 | Prompt injection from web/GitHub and unapproved writes | Treat as untrusted data; host-only grants; no self-elevation |
| P2 | Notification UI and richer plugin features | Omit until actual operator need; no Windows desktop toast required |

## Stage gates and stop

The [acceptance matrix](../validation/codex-chat-workspace-gates.md) is mandatory before any production-capable adapter. Phase A: fixture status/sender and WebView2 packaging, no ChatGPT site automation. Phase B: offline host/MCP/goal/GitHub reconciliation and adversarial regression. Phase C: explicitly permitted and supervised live ChatGPT Chat compatibility check. Phase D: safe rollover, concurrency and installed Windows evidence. If any P0 is unresolved, STOP production activation and record exact blocker.

**Next authorized work:** research/provenance and documented contract review. No source implementation, extension installation, CI dispatch, production deployment, automatic cross-repo writing or account-limit avoidance is authorized by this design alone.

## Host-bound result feedback — source gate, not ChatGPT Web automation

See [canonical worker-feedback contract](worker-feedback-trust-boundary.md).
The source now supports a bounded, independently attested structured
worker result and a read-only wrapper that ignores an MCP caller's
`proposal`. A worker can report a meaningful short conclusion even
when GitHub HEAD remains unchanged, but that explanation cannot
invent a QA PASS, permission or `DONE` state. The durable reconciler
requires this host-attested fingerprint in the checkpoint.

Only documented agent hosts or independently approved structured
callbacks may supply such results. The official Codex App Server is a
candidate; ordinary/Personalized Temporary Chat still has no verified
external final-result path in this project. UI completion and a browser
extension do not solve that gap. Without permissioned transport and
final-turn binding, remain `REVIEW_REQUIRED` or pause for manual
handoff; never initiate a blind ChatGPT Web loop.

## Source milestone — checkpoint-bound durable review reconciliation

The new `GoalReviewReconciliation` class is an injected, host-only
source-level composition of the read-only `GitHubGoalReview` and
existing `CheckpointStore`, `WorkspaceRegistry`, `PromptOutbox` and
scheduler lease. The review must bind the same goal ID, active
`WAITING` checkpoint, task, session, branch, HEAD and checkpoint
version. `REVIEW_PREPARE` is persisted before any multi-file mutation;
it holds the checkpoint in `RECONCILE_REQUIRED`. After exact
registry/outbox reconciliation and a further HEAD check,
`REVIEW_COMMIT` persists `READY` or verified `DONE`. A crash at any
step can only be resumed from the recorded intent with trusted host
authorization and no duplicate send. There is no new competing
checkpoint store.

Node source tests on fake host and file-backed simulator passed.
The Windows/native provider, actual GitHub account credentials,
official ChatGPT completion signal, installed MCP path and permitted
ChatGPT consumer site transport remain unverified. This class is
not imported by the default desktop runtime or gateway, never
authorizes cross-repository writes, and always returns
`nextPromptAllowed=false`. See
[durable reconciliation validation](../validation/goal-review-durable-reconciliation-2026-11-11.md).
