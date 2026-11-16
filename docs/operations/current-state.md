**Development authority:** `OpenITStudios/LazyPrompting` → `Local`.  
**Source baseline:** `096175576097b0425644fb0b15f0d855743c44b3` before operator-visible manual draft wiring (14 Nov 2026). Prior Windows evidence: `5869d30`/`d346c75`.  
**Evidence classification:** latest work is SOURCE_COMMITTED, without new native/runtime tests. Prior Windows/NSIS/Codex results apply only to their exact earlier SHAs; no consumer ChatGPT acceptance.

This file owns **only the current engineering position, one next task, and stop conditions**. Historical chronological milestones were moved without changing their bytes to [11 November source progress archive](history/2026-11-11-local-progress-before-localtest.md). Older Windows history is [archived separately](history/2026-11-10-full-checkpoint.md). Archive headings saying “Next” are historical, not parallel instructions.

## Intended product and scope boundaries

The operator provides one scoped goal through **any verified MCP-compatible AI client**. Native host owns approval/STOP, workspace identity and permits; deterministic supervisor owns evidence, outbox and continuation. The conversational target is **ordinary persistent ChatGPT Chat (non-temporary)**, not Work or an API worker. ChatGPT sends/results remain manual or narrowly in-thread unless an authorized host transport is proven. Crash recovery prefers the exact old chat; unsupported identity recovery pauses without creating one. See [selected universal product contract](../architecture/universal-chatgpt-workflow.md).

- **Installed desktop architecture:** Tauri/Rust + Svelte, up to ten WebView2 workspace views; separate native Rust MCP facade and packaged internal Node gateway. See [MCP ownership](../../mcp/ARCHITECTURE.md).
- **Implemented engineering path:** bounded Codex App Server `goal_run.*` tasks/worktrees. Universal stdio MCP is already a client front door; V2 workers remain non-executable, and proposed `chat_goal.*` is not registered.
- **ChatGPT transport gate:** Codex/OpenCode prepare manual drafts via `workspace_chat.prepare_handoff`, with source-only, main-window draft preview/copy wiring; URL bookmarks aid manual recovery. Neither enables unattended ChatGPT send/results. See [universal gates](../validation/universal-chatgpt-acceptance.md).

## Current implementation and evidence

| Area | Implemented in source | Proven / still missing |
| --- | --- | --- |
| Goal-run/managed Codex transport | `src/transport/codex-app-server.mjs`, `goal-codex-runner.mjs`, bounded native `goal_run.*` | 27/27 Linux Node process/event/recovery/pause subtests were executed on exact reconstructed source; actual installed Codex CLI and Windows native path not verified |
| Durable workspace/checkpoint/outbox | `WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`, scheduler lease | Real-file/fake-host integration tests and 202 additional focused supervisor/storage assertions passed; neither real native permission nor actual QA is implied |
| Terminal event and restart safety | Process-local `turn/completed` correlation, source fingerprint, ambiguous-delivery holds | 34 event assertions passed; uncertain delivery, conflicting event and old unbound scope are held for reconciliation, never blind resend |
| Cooperative `goal_run.control.pause` | Durable native marker, `PAUSE_REQUESTED`/`PAUSED` source, explicit resume, STOP precedence | Node tests and Rust **static** source checks; Cargo/installed Rust MCP tests have **not** run on the combined revision |
| GitHub/worker feedback reviewer | `StructuredWorkerFeedback`, `TrustedGoalReview`, `createVerifiedGoalRuntime`, durable review prepare/commit | Source-only host-injected composition; no deployed native attestation provider, verified production worker feedback or independent QA receipt |
| Desktop/preview/ten slots | Svelte/Tauri, shared WebView2 workspace profile; Lightpanda separate from WebView2 | Historical Windows work was recorded before recent commits; ten-slot final installed acceptance, memory/performance and latest native build not verified |
| Ordinary persistent ChatGPT Chat navigation | Normal WebView2 workspace defaults to `https://chatgpt.com/`; UI/native URL guards deny known Temporary Chat query parameters; dormant send candidate guards the same | Source-only change; **does not** prove account-side mode, restore the exact conversation automatically after restart, implement a supported unattended consumer transport or complete ten-slot Windows acceptance |
| Packaging and installer | Separate NSIS Tauri config, pinned Windows gateway staging and read-only stage verifier | 13/13 synthetic stage-verifier assertions passed; actual staged Node 24.14.1 resources, complete Cargo build and generated installer not verified |

**Proof classes must not be mixed.** A test using a local synthetic Codex process is not a signed-in real model turn. A matching Git HEAD is not QA PASS. A browser idle indicator is not a verified ChatGPT response. A source blob or authored Rust test is not Windows compilation.

Focused reports: [Goal Run pause QA](../validation/goal-run-pause-2026-11-11.md), [scope/replay QA](../validation/goal-run-scope-binding-2026-11-11.md), [Codex subprocess QA](../validation/codex-stdio-process-integration-2026-11-11.md), [worker trust boundary](../architecture/worker-feedback-trust-boundary.md).

## Windows localtest execution — 12 November 2026

Executed on Windows x64, Node **24.14.1**, Rust MSVC, against the exact
`Local` revision `5869d30bb593799e7a1fb49124117a4a516b46ec`.

- **Phase A PASS.** `npm run preflight:localtest` returned `PASS (0 issues)`:
  every `test:*` entrypoint, the Svelte/TypeScript check, the Vite build,
  `cargo fmt --check`, `cargo check` and `cargo test` (35 passed, 0 failed,
  8 ignored). Two real defects had to be fixed first: the new
  `chat_fixture_native.rs` moved `url_string` before its later read and did
  not compile, and the fixture bridge test still expected an 11-entry
  capability catalog after `chat_goal.progress_review` was added.
- **Phase B PASS.** The gateway closure was re-staged from the reviewed
  source; `npm run preflight:gateway-stage` returned
  `SOURCE_STAGE_VERIFIED` for 29 files. The NSIS installer was produced and
  installed, and the installed `gateway/manifest.json` equals the staged
  manifest.
- **Phase C PASS for the installed desktop.** The installed
  `lazyprompting-desktop.exe mcp` answered `initialize`, `tools/list` and
  `search_capabilities`. `workspace_browser.open`, `navigate`, `location`,
  `back`, `forward` and `reload` were exercised on Browser 01; all ten slots
  opened and reported `https://example.com/`; `workspace-11` was refused.
  Closing the window left no gateway/Codex child process and removed the
  named pipe.
- **Phase C PASS for the goal-run path.** With the signed-in Codex CLI
  `0.167.0-alpha.3.2`, the pinned WSL2 Lightpanda 1.0.3 binary and a
  disposable fixture repository, these ignored native tests passed:
  `packaged_gateway_initializes_and_stops`,
  `packaged_codex_recovers_turn_after_gateway_restart`,
  `packaged_gateway_runs_an_approved_read_only_goal`,
  `private_wsl_browser_isolates_ten_workspaces` and
  `packaged_gateway_verifies_five_coding_worktrees`. The coding goal wrote
  only inside its own worktrees, left the base checkout clean, and recovered
  the exact interrupted turn after a gateway restart.
- **Transport defect fixed.** The App Server can reject a status read right
  after a turn starts. That was reported as a failed request, stopped the
  host poll and failed goal tasks. Transport failures now report an unknown
  turn status, `WAITING` instead of `RECONCILE_REQUIRED`, and the goal
  runner keeps polling. The native recovery test failed one run in three
  before the fix and passed three runs in three after it.

## Client-agnostic installed MCP — 12 November 2026

- The installed stdio facade is standard MCP, so it is not Codex-only. It
  answers `initialize` (also without a protocol version), `ping`,
  `tools/list`, `tools/call`, and truthful empty `resources/list` and
  `prompts/list`, and accepts a nested capability `arguments` value as a
  JSON object or a JSON string. Five deterministic Rust conformance cases
  cover the generic client sequence, optional client shapes, notification
  handling, malformed input and the stringified argument.
- **LIVE_INTEGRATION_VERIFIED with third-party clients.** The official MCP
  Inspector CLI (not Codex) listed the four tools with `--strict` reporting
  no schema portability problem, then opened `workspace-03` and read
  `https://example.com/` from the installed application. The Inspector
  requests protocol `2025-11-25`; the facade answers `2025-03-26` and the
  client proceeds normally.
- **LIVE_INTEGRATION_VERIFIED from OpenCode.** `opencode mcp add lazyprompting
  --global` registered the installed executable and `opencode mcp list`
  reports `✓ lazyprompting connected`. An OpenCode session then opened
  `workspace-05` and read `https://example.com/` through the MCP tools.
  OpenCode V2 keeps servers under `mcp.servers`.
- **Automatic setup and automatic start.** `npm run setup:local -- --apply`
  registered eight clients and verified each with a real stdio handshake that
  listed four tools. The facade also starts the desktop host itself when a
  client calls it, so no manual first step is needed; starting the host
  grants no permission. The setup never rewrites a configuration that
  already holds the exact entry, because a client reloads its configuration
  on change and drops a working server connection. Measured numbers are in
  [localtest evidence](../validation/localtest-readiness.md#7-client-agnostic-mcp-and-automatic-setup--12-november-2026).
- `npm run register:mcp` prints the exact registration for every supported
  client and refuses anything except the installed executable. The four
  public tool names are unchanged; the native host still owns admission and
  verifies the client executable path. The setup never rewrites a
  configuration that already holds the exact entry, because a client reloads
  its configuration on change and drops a working server connection.
- Not verified: Claude, Cursor, VS Code, Windsurf and Zed are not installed
  on this host, so their own agent sessions were not run. The Inspector and
  one OpenCode agent turn are observed.

- **Still unverified.** The operator has not accepted or rejected the native
  approval dialog from the installed UI; no QA provider, GitHub writer or
  worker-feedback attestation is connected in production; the `goal_run`
  pause/resume path is covered by source tests and the native pause-marker
  unit test, not by an installed operator session. Consumer ChatGPT Chat
  automation stays blocked by the Gate 0 decision below; the synthetic
  arithmetic probe reaching a temporary HTTPS tunnel is a transport
  diagnostic, not product acceptance.

## Immediate blockers to localtest

1. **Preflight source gate:** active state must be <18,000 characters; the previous `Local` document exceeded that limit. Universal routing edits reduce it; a full exact-SHA repository preflight remains required.
2. **Windows native gate:** **executed** on `5869d30` — Node preflight, `cargo fmt/check/test`, NSIS build, installed desktop browser smoke, signed-in Codex goal runs and the WSL2 Lightpanda isolation test all passed. Remaining Windows gaps are the operator-accepted native dialog, an installed pause/resume session and measured ten-slot resource behaviour.
3. **CI execution gate:** a read-only, manual Windows workflow is registered on default `main` (commit `c10f121`) and requires the exact `Local` SHA. It has **not** been dispatched. The equivalent local run above is not a GitHub Actions run; no automatic dispatch or branch promotion is authorized.
4. **NSIS staging:** Tauri base config disables bundling. Earlier staging passed on older source; re-stage the changed gateway closure before building a new installer.
5. **Product integration:** authenticated native final-turn/QA/approval binding to the already authored verified goal runtime is still missing. Consumer ChatGPT Chat automation is separately blocked and is **not** tested by the Codex/NSIS smoke.

See the [four-phase controlled Windows localtest checklist](../validation/localtest-readiness.md). The repository's manual-only workflow must never be presented as having run when it has not. The earlier source-only preflight audit is archived verbatim in [history](history/2026-11-11-source-only-preflight-audit.md), and the pre-local blindspot audit in [history](history/2026-11-11-final-pre-local-blindspot-audit.md).

## M2 scoped GitHub and QA source wiring — 11 November 2026

A host-injected source constructor binds exact repository/branch, `GitHubEvidence`, `ReceiptReconciler` and `createVerifiedGoalRuntime` without a second checkpoint owner. Isolated Node 22.16.0 tests passed **24 GitHub/QA + 17 constructor assertions** with injected fake HTTP/QA/storage; no production native attestation, GitHub credentials, QA provider or source-to-DONE verification is established. All existing public tools remain unchanged. Native callbacks, exact result identity, independent acceptance QA and supported consumer ChatGPT transport remain open; no unattended website sending is enabled. See [scoped source QA](../validation/scoped-goal-evidence-integration-2026-11-11.md).

See [scope/QA evidence](../validation/scoped-goal-evidence-integration-2026-11-11.md).

## Consumer ChatGPT Chat Gate 0 decision — 11 November 2026

- Primary-source review: OpenAI's consumer terms prohibit automatic/
  programmatic output extraction. No documented authenticated external
  ordinary consumer ChatGPT Chat session and final-turn API was established.
  The exact requested unattended ChatGPT consumer worker is therefore
  `BLOCKED_COMPLIANCE / HOST_UNSUPPORTED`, **not** source-complete.
- Supported programmatic alternatives exist: official local Codex
  App Server/SDK and managed Agents API (API-billed). These are
  **different products**, not interchangeable with ordinary Chat,
  and must not be selected without the operator's permission.
- Keep consumer ChatGPT Web automation disabled. Continue supported
  Codex/supervisor source, native-host QA and installer preparation
  while respecting the original product target. See
  [verified Gate 0 decision](../validation/chatgpt-consumer-transport-gate0-2026-11-11.md).


## Codex CLI and native test admission caveats — 11 November 2026

- Current shipped Codex transport expects **exactly**
  `codex-cli 0.167.0-alpha.3.2`. Upstream has later releases;
  a local CLI binary with a different `--version` output
  will be rejected until protocol compatibility is independently
  verified. See [Windows localtest](../validation/localtest-readiness.md).
- Default `cargo test` excludes Rust integration tests explicitly
  marked `#[ignore]` for real signed-in Codex/gateway/Lightpanda.
  Passing Cargo is a source/native-unit gate, **not** the installed
  end-to-end gate. Run only an operator-approved targeted ignored
  test after disposable environment setup.

**New source-only universal worker contract (12 Nov):** `src/agent/` introduces host-verified profile selection, exact worker receipts/events and v2 goal-scope binding. 49 deterministic Node tests PASS in isolated source, including controller, Codex/OpenCode adapter fixtures and real `PromptOutbox`; still **not** installed worker integration. See [runtime evidence](../validation/universal-agent-source-runtime-2026-11-12.md). See [contract evidence](../validation/universal-agent-contract-2026-11-12.md).

**New source-only multi-client work (12 Nov):** bounded two-goal admission, strict stdio verifier (10 isolated Node tests PASS), lazy startup, 24-request native pipe and per-client workspace/goal leases. Rust/installer **NOT_EXECUTED** for the updated source. See [multi-client QA](../validation/universal-mcp-multi-agent-2026-11-12.md).

## One active next engineering task

**Browser AI offline action source candidate — 16 Nov 2026.**
The latest `Local` source binds a native Lightpanda private target
and JS-safe epoch/HMAC witness to a fixed local-only checkbox/search
test. In the existing Tauri main window the operator must confirm
each operation. The native host reserves and seals the one canonical
app-local `PromptOutbox`, verifies the exact `DISPATCH_PENDING`
row, consumes one original native grant and performs one direct
`LP.clickNode`/`LP.fillNode` request. An independent fixed-fixture
CDP readback and exact on-disk `VERIFIED` hash are required for
a success result; failures remain held for reconciliation. The
desktop Browser Activity panel exposes the bounded test controls.
Four public MCP tools and Code Mode's browser-effect deny policy
are unchanged.

**Current next task:** source/architecture review for remaining
fail-closed races and future single-phase native validation
acceptance. The primary remaining proof barrier is real Windows
Cargo/Svelte compilation, installed pinned Lightpanda CDP
compatibility, STOP/restart/unknown-result handling, and measured
browser/permission UX. A valid post-dispatch uncertain outcome
remains held; general operator reconciliation and cross-file
Codex task-outbox exclusion are not yet production complete.
Do not broaden to public websites, arbitrary scripted pages or
consumer ChatGPT Web automation; these require independent
policy/host/license gates.

**Proof:** SOURCE_COMMITTED, TEST_AUTHORED_NOT_RUN. No new Node,
Rust, Windows, WSL, browser E2E/QA or token benchmark was executed
for this HEAD on the CHATGPT_GITHUB surface. Earlier Windows tests
apply only to their exact historical SHA. [B0–B7](../architecture/desktop-multi-browser-product.md).

## Online ChatGPT prompting — 16 November 2026 source checkpoint

The actual ChatGPT website is already displayed online through
browser-owned WebView2. The operator-only `Send once` path now
requires a user-saved existing ordinary `/c/<uuid>` conversation
bound to the same workspace. The native host verifies the current
URL against the saved bookmark before an attempt; queued JavaScript
rechecks the exact URL to deny navigation races. A missing/foreign
bookmark blocks the action. Browser DOM response extraction,
consumer-web autonomous looping and unsupported private endpoints
remain disabled.

Officially documented ChatGPT Workspace Agents API triggers are
another product: they queue a published workspace agent under its
own access token/conversation key but do not return a completed
ChatGPT reply or control arbitrary ordinary existing Chat.
Responses/Agents API are also distinct API-billed products; none
is activated or silently substituted for the original target.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN at this new
HEAD. Online logged-in account, actual WebView delivery and
Windows/native/browser E2E remain NOT_EXECUTED. The in-memory
operator send-attempt ledger is not a durable session receipt.

## Browser AI status watch cost policy — 16 November 2026

The online ChatGPT watcher remains **control-only** and uses the existing
native `operator_chat_status` WebView2 inspection. **No LLM/model/API
call is made per poll**; actual CPU/RAM overhead and Windows behavior
are NOT_EXECUTED at this source HEAD. No assistant output text is read.

The previous fixed six-second frontend interval is replaced by the
small, pure `apps/desktop/src/app/chat-status-watch.mjs` timing policy.
There is **no timer at all while no workspace is being watched**.
After operator `Send once`, a workspace is checked after 3 seconds,
then waits 6, 12, 20 and up to 30 seconds if status remains WAITING.
While GENERATING, intervals back off from 5 to 30 seconds. One global
in-app scheduler reads at most **one** native status at a time, with
at least two seconds between completed reads across workspaces.
When minimized/hidden it pauses and resumes on visibility. A watch
expires after at most 15 minutes and never initiates a retry or
follow-up. The actual native host status hints remain explicitly
unverified: POSSIBLY_COMPLETED/ERROR/UNKNOWN stop with an operator
review; no response transcript or ChatGPT result is fabricated.

The existing source owner, four public MCP tools, STOP gates and
manual continuation stay unchanged. Node fixtures cover cadence,
idle/no timer, workspace eligibility, rate limiting, expiry and
failure behavior; they are TEST_AUTHORED_NOT_RUN and require
matched user-PC evidence only in a separately selected phase.

## Durable online operator-send reservation — 16 November 2026

**P0 source fix:** the previous process-local duplicate-prompt
HashSet did not survive restart. The native `operator_send_once`
path now derives SHA-256 digests from the exact bookmarked ordinary
ChatGPT conversation and reviewed prompt, then uses the already
installed authenticated Node gateway to reserve a
`PromptOutbox.operatorChatAttempts` record in the canonical
`app_local_data_dir()/outbox.json` **before WebView2 eval**.
The gateway method `lazyprompting/operatorChatSend` is private
native-bootstrap transport, not a fifth public MCP tool or a
Code Mode browser action.

The existing schema-v1 outbox persists only workspace ID, opaque
attempt ID, conversation/prompt digests and the fixed
`ATTEMPT_UNVERIFIED` state. Duplicate workspace+conversation+
prompt attempts fail closed across process restart. Pending
prompt/browser actions in the same app-local outbox block the
operator send. A different explicit operator-reviewed follow-up
can still be prepared; no implicit retry, resultVerified, verified
ChatGPT response or raw prompt/chat URL is stored. The native
in-memory ledger still owns *only* transient UI control hints.

**Current proof:** SOURCE_REVIEWED and SOURCE_COMMITTED; new negative
Node fixtures authored but NOT_EXECUTED. No current Windows native
build/installed WebView2, concurrent-send/restart acceptance, or
actual ChatGPT turn receipt. Codex per-task outboxes are a distinct
cross-file coordination gap. The consumer ChatGPT unattended Web
transport remains BLOCKED_COMPLIANCE / HOST_UNSUPPORTED; do not
convert this into an automatic send/response loop.

## ChatGPT operator-review recovery — 16 November 2026

**P0 source continuity fix:** A pending operator ChatGPT send now blocks
a second prompt in the same workspace, including a different prompt
body. It also blocks same-file prompt/agent/browser reservations.
The existing schema-v1 `PromptOutbox` retains each immutable
digest-only attempt; `ATTEMPT_UNVERIFIED` remains active across
gateway/desktop restarts.

The existing main-window `advance_manual_handoff` command now
prepares a continuation from the operator-pasted reply and exact
old native draft fingerprint, then—**before replacing that draft**—
asks the authenticated internal gateway to record
`REVIEWED_UNVERIFIED` against the exact saved ordinary
ChatGPT conversation and original prompt hash. Failure to record
review leaves the old native draft unchanged. The review records
human action only: `deliveryVerified:false`,
`resultVerified:false`, `nextPromptAllowed:false`.
A different reviewed follow-up, including one with the same
literal text as an older turn, is admitted only after this
prior manual-review boundary.

A restart loses the session-memory manual draft by design.
For that case, the Browser Activity panel now has **I reviewed this chat**: the operator must inspect the original bookmarked chat
and explicitly accept a native Windows confirmation dialog.
The native owner checks exact current URL/bookmark, one pending
entry, and unchanged page identity after the dialog; it then
releases that hold to `REVIEWED_UNVERIFIED` without reading
response contents or sending a prompt. No auto-retry or
automatic answer/extraction is enabled.

**Proof:** SOURCE_COMMITTED/TEST_AUTHORED_NOT_RUN.
Native Windows/Rust/Svelte/installed ChatGPT and multi-workspace
acceptance remain NOT_EXECUTED. A malformed/ambiguous old outbox,
lock left behind by a crashed process, or an unsupported consumer
ChatGPT transport still fails closed; no automated clearance or
QA claim. The separate Codex per-task outboxes remain a
cross-file conflict gate requiring independent native evidence.

## Interrupted PromptOutbox lock recovery — source checkpoint, 16 Nov 2026

**P0 crash-lock improvement:** each new app-local PromptOutbox
transaction now writes a bounded, fsynced `owner.json` containing
the Node process ID and OS-random token *inside the existing*
exclusive `outbox.json.lock` directory. The lock is still
conservative and fail-closed; no age-based timeout deletes it.

The private authenticated gateway has a native-only
`lazyprompting/operatorChatLock` inspection/recovery RPC.
The operator can select **Interrupted state recovery** in the
existing Browser Activity panel; a main-window Windows
confirmation is required. Recovery is permitted only when the
lock is a plain directory containing exactly the expected
owner record, its token is unchanged and the original process
is demonstrably absent. The owner is inspected again immediately
before removal, and removal is non-recursive. Any live owner,
malformed record, unknown process status, old-format/ownerless
lock or unexpected file is a hold. No model or page may supply
a lock token, file path or self-approval.

This repairs *the stale mutex only*, never replays ChatGPT
actions, clears `ATTEMPT_UNVERIFIED` or certifies an answer.
A pending attempt must still be reviewed by the operator via
the existing native recovery path. Old ownerless locks cannot
be safely inferred stale from a timestamp; they remain
`LOCK_UNVERIFIED` for separately authorized PC inspection.

**Evidence:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.
Source fixtures cover active/unknown/interrupted lock owners,
wrong token, restart behavior and unchanged pending attempts;
Node/Windows/Rust/UI/browser tests NOT_EXECUTED on this HEAD.
Native PID liveness, Windows filesystem semantics and multi-
workspace stability remain independent user-PC acceptance gates.


## Before-localtest consistency and operator usability — 16 November 2026

**Current source checkpoint:** reviewed historical operator-chat attempts
are distinct audit entries; repeating the same literal prompt in a later,
separately operator-approved turn is valid. The relevant
`tests/run-prompt-outbox.mjs` fixture has been corrected to accept
multiple `REVIEWED_UNVERIFIED` history entries while rejecting *two
pending* entries for one workspace. New source fixtures cover two
concurrent native reservation requests (only one admitted), losing
the response after an operator review was persisted, and rejecting
an active lock with a stable `OUTBOX_LOCK_BUSY` error. No retry,
false `RESPONSE_VERIFIED`, or deletion of ambiguous history follows.

**Operator experience:** Browser Activity now reads the already
authenticated, canonical app-local `PromptOutbox` status **once on
opening the Activity panel or after an explicit send/review/recovery**.
A native-only Tauri command returns only
`NO_PENDING / REVIEW_REQUIRED / AMBIGUOUS_HOLD` and false
delivery/result/next-prompt flags; it never releases native
prompt/URL digests or response text. The panel displays human
labels, a manual Refresh action, and the **I reviewed this chat**
button only when there is exactly one pending send. Recovery
continues through its separate OS-confirmed path. There is no
additional model request, periodic polling, or second state owner.

**Crash boundary:** If the gateway persisted `REVIEWED_UNVERIFIED`
but the native session-memory draft was not swapped, the pending
attempt may be absent while the original draft still exists.
This is not verified delivery. The operator must reconcile the
original draft/chat and explicitly prepare its next reviewed
draft; no automatic prompt resend or reconstruction of private
chat text occurs.

**Coordination hold:** `goal-codex-runner.mjs` uses per-task
`task-1` etc. outbox identifiers in a goal-run directory, whereas
ordinary ChatGPT reserves `workspace-01` etc. under the app-local
outbox. These are **different identity namespaces** and cannot
safely be treated as identical through string matching.
Cross-file conflict prevention requires a trusted host mapping/
lease on the actual consumer before a shared-workspace claim.
Do not invent a second outbox or silently alias task IDs.

**Proof:** source integration and negative tests authored, not
executed. Windows Cargo/Svelte/installed gateway/actual ChatGPT,
cross-file task mapping and 1/2/5/10 workspace runtime acceptance
remain NOT_EXECUTED. Unattended consumer ChatGPT transport U5
remains blocked separately.

## Stop and safety boundaries

- Do not switch, merge, force-push, delete or auto-promote `main` or the retained `Harness` branch. All code work stays on user-selected `Local`; other OpenITStudios projects are read-only without their own authorization.
- No browser-site output scraping, unofficial consumer ChatGPT API, unattended ChatGPT Web send, account/session impersonation, automatic plugin installation, CI workflow dispatch, release or production deployment.
- STOP, deadline, unacknowledged sending, invalid scope, stale SHA, failed QA or ambiguous external result prevent continuation. Never infer that an unverified worker turn permits a new prompt.
- Only actual commands on exact checked-out sources count as executed tests. Archive previous source/history claims instead of duplicating them as current evidence.

## Codex task and ordinary ChatGPT workspace identity boundary

Codex V1 goal runs use `task-1..8.json` under an OS-native
goal-run directory; ordinary ChatGPT in WebView2 owns
`workspace-01..10` reservations in a different app-local
`PromptOutbox`. They are **distinct actors**, not matching
numeric aliases. The goal runner now refuses browser action,
operator-chat or foreign workspace rows inside any task
outbox *before* starting the provider turn. The only existing
cross-actor context bridge is the native authenticated,
operator-reviewed manual handoff, not a shared reply store.

A new, deliberately linked Codex/ChatGPT goal would need
its own native operator-approved binding and atomic admission;
no fabricated cross-file lock is installed for independent
Codex work. Source checks authored, NOT_EXECUTED.

## Official ChatGPT result transport — verified capability ceiling

OpenAI's Workspace Agents API now exposes beta
`GET /v1/workspace_agents/{id}/runs/{run_id}` for run
statuses such as `queued`, `in_progress`, `suspended`,
`completed` and `failed`. This is a valid status
source **only for separately published Workspace Agents**
with authenticated access; the API does not expose a
completed answer body or control existing ordinary
consumer `chatgpt.com/c/<uuid>` sessions.

The platform Responses/Conversations APIs support
programmatic output retrieval and continuation of their
**own API conversations**, not consumer ChatGPT threads.
A paid API product is not a silent replacement for the
user-selected ordinary persistent ChatGPT engine.

`assessOfficialChatProduct` and the current
`assessChatTransport` source gate explicitly encode
these differences. Workspace Agent run status, API
response text and ordinary consumer answer identity
cannot be substituted for one another. No access
token, external call, cloud integration or API
expense was initiated. The existing operator-reviewed
manual reply/handoff remains required until
documented, independently authorized consumer
result transport exists.

Primary documents:
https://developers.openai.com/workspace-agents/trigger-runs
https://developers.openai.com/api/docs/guides/conversation-state
https://openai.com/policies/terms-of-use/

Proof: SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN;
NOT_EXECUTED for actual product/API connections.

## Optional OpenAI Responses API source candidate — 16 November 2026

**Selected default remains ordinary persistent ChatGPT Chat in WebView2.**
`src/transport/optional-openai-responses.mjs` implements a bounded,
**inert until explicitly injected/approved** optional OpenAI Platform
Responses API turn adapter. It does not introduce a browser scraper,
consumer ChatGPT `/c/<uuid>` reader, new MCP tool, gateway route,
UI selection, environment-key lookup, stored credential, shadow
outbox, scheduler or automatic follow-up.

Only a separately configured `api-workspace-NN` and an already
host-created OpenAI Platform `conv_...` API conversation are
eligible. The installed native host must *later* inject an official
Responses client and its original canonical `PromptOutbox` plus
a trusted per-turn approval callback that binds exact model,
conversation, workspace, prompt digest, distinct turn ID, context
revision and maximum output tokens (up to 2,048). Without that
host integration and operator selection, the adapter is not called
and no API charges can occur from this feature.

Once those prerequisites are explicitly supplied in a future
approved mode, the source adapter first persists the exact
one-turn reservation in the existing `PromptOutbox` and only
then calls `responses.create` *once* with the official
`conversation` ID. A lost/ambiguous network reply or
wrong response identity leaves the outbox pending and
**never automatically retries**. It acknowledges the exact
`resp_...` ID only when the returned API conversation/model
match; it records `RESPONSE_VERIFIED` only for a completed
API response with typed output and token-usage receipt.
This means an API output exists—**not** that an independent QA
passed, the user approved another prompt, or the ChatGPT
consumer conversation answered. The returned API text is
held in the trusted caller's return value, not persisted
into PromptOutbox or exposed to consumer WebView/Code Mode.

Token usage: zero calls while disabled; at most one
user-authorized API generation per submit; max-output-token
admission and bounded turns. Real token billing, pricing,
SDK installation, host secrets, native per-turn approval,
API conversation creation and installed performance require
separate explicit selection and validation. The module does
not silently switch the product's selected engine.

Official source: https://developers.openai.com/api/docs/guides/conversation-state
and https://developers.openai.com/api/reference/resources/responses/methods/create

**Proof:** SOURCE_REVIEWED, TEST_AUTHORED_NOT_RUN for
`tests/run-optional-openai-responses.mjs`. No API account,
credential, network request, Windows build, SDK validation
or consumer ChatGPT E2E was executed. Consumer transport U5
remains BLOCKED_COMPLIANCE / HOST_UNSUPPORTED.

## Bounded official Responses API auto-goal — integrated SOURCE (16 Nov 2026)

**This section supersedes the earlier "inert, not registered" optional
API-adapter checkpoint above.** Ordinary persistent ChatGPT WebView2
remains the DEFAULT, separate consumer chat mode. The optional,
separately billed **OpenAI Platform API goal runner** now has
source-level native/UI wiring but **does nothing unless** an operator
opens the collapsed API automation panel, enters a goal/model/turn
budget, accepts the Windows cost/permission dialog and has configured
`OPENAI_API_KEY` in the local desktop host's environment. There
is no bundled key, default paid call, cloud job, hidden provider
switch, consumer-web scraping or public MCP/Code Mode exposure.

**Native → gateway → official API path:** `api_goal_controls.rs`
checks the main window and approves the bounded run. The existing
authenticated gateway exposes private `lazyprompting/apiGoal`
start/status/stop. A single `ApiGoalRuntime` owns the asynchronous
turn loop; it uses the official `https://api.openai.com/v1/`
Conversations and Responses API via a **zero-auto-retry**
HTTPS wrapper, with bearer key confined to the local Node
process. It creates one independently billed/persisted API
`conv_...` conversation only after explicit approval,
enforces `api-workspace-01` identity (not consumer
`workspace-01`), records the goal/model/limits and each
provider turn in the SAME canonical `PromptOutbox`, and
checks response/conversation/model ID, structured assistant
JSON and actual token usage before sending a distinct
model-proposed next prompt. The existing native STOP cancels
new turns; a cancelled/unknown in-flight request leaves a
durable `RECONCILE_REQUIRED` hold, never automatic replay.

**Progress and cost:** At most 5 model requests/run, 256–2,048
output-token cap/request, total-token post-response threshold
2,048–80,000, exact prompt hash + UUID and no repeated next
prompts. Each status check is a local outbox read: zero model
tokens and a single in-app timer only while running/visible.
A structured `DONE_PROPOSED` or `BLOCKED` result stops at
`REVIEW_REQUIRED`, NOT independently verified `DONE` or QA.
Prompt/output text and credentials are NOT persisted in the
outbox. Last summary/evidence are memory-only UI review hints;
after restart, previous RUNNING/PREPARING is reported
`RECONCILE_REQUIRED` and no generation auto-resumes.
Actual API input/context cost is variable: token limits do
NOT represent a guaranteed monetary spending ceiling.
The user must separately configure a hard project spend
cap and account/model access.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.
The official SDK/API compatibility, credentials, billing,
Windows/Tauri/Svelte compilation, native dialog, gateway
restart behavior and real network/model usage are
NOT_EXECUTED in this CHATGPT_GITHUB session. The previously
selected consumer ChatGPT transport U5 is still blocked:
this is an explicitly separate API conversation, NOT a
ChatGPT `chatgpt.com/c/<uuid>` answer reader.

Primary references:
https://developers.openai.com/api/docs/guides/conversation-state
https://developers.openai.com/api/docs/guides/structured-outputs
https://developers.openai.com/api/reference/resources/responses/methods/create
https://developers.openai.com/api/docs/guides/rate-limits

### Credential gate correction for the packaged Windows gateway

The original `GatewayChild` intentionally calls `env_clear()`
and only forwards a minimal allowlist. Therefore the new
native API command explicitly reads `OPENAI_API_KEY`
**after** the Windows operator approves that specific
API goal, then sends the credential only through the
already authenticated, private local gateway request.
The Node gateway is not permitted to inherit the API
key at application startup, and no secret reaches the
browser/renderer, public MCP, Git history or outbox.
The temporary key exists in the trusted native/gateway
process memory only. This closes an actual blocked
credential path found during integration source review.
Runtime secret handling remains NOT_EXECUTED at current HEAD.

## Code Mode × optional Responses API source integration — 16 Nov 2026

The **existing** confined Code Mode interpreter is
now used by the API goal runner for one internal,
read-only, fixed-program check after each completed
Responses API turn. The sole data source is the
host-owned, durable `PromptOutbox.getApiGoalRun`
record, projected to an exact, bounded
`GATEWAY_API_GOAL_OUTBOX_STATUS` shape. Code Mode
can inspect `runId`, the fixed API workspace,
durable state, last decision, turn/token counts
and false QA/consumer continuation flags.
It cannot read raw prompts/answers, a `conv_...`
ID, API key, browser sessions, credentials or
host-owned permissions. It cannot start, resume,
STOP or authorize a paid API call.

The controller itself checks the returned bounded
Code Mode composition against the persisted record
and only follows an already-approved
`RUNNING + CONTINUE` branch within max turn/token
budgets. A mismatch is held for reconciliation,
never a blind retry. The original Responses API
client, native billing consent, STOP, outbox and
UI remain the single owners. Public/installed MCP
Code Mode continues to offer read-only operations
and one native manual-draft broker only; no
external API Goal binding is newly exposed there.

Proof: SOURCE_COMMITTED and TEST_AUTHORED_NOT_RUN,
not Windows/native/real API/token-usage PASS.
The ordinary ChatGPT WebView2 auto-output
transport remains unsupported independently.


## Final source checkpoint — 16 November 2026; Local → independent PC validation

**Selected source baseline:** `dbb334d17ed1325ff6134dfc58fa76785e98cd0c`
(the code HEAD inspected before this documentation-only handoff).
The actual **tested** revision must be recorded afresh with
`git rev-parse HEAD` on the user's PC after retrieving `Local`.
**Surface:** `CHATGPT_GITHUB`. **Proof:** `SOURCE_REVIEWED`,
`SOURCE_COMMITTED`, `TEST_AUTHORED_NOT_RUN`. No current-HEAD
Node/Rust/Svelte/Windows/WSL/installed-CDP/OpenAI API E2E, UX,
token-efficiency or release verification has been executed.
Older Windows records at `5869d30` / `d346c75` are
historical evidence only, not acceptance of this revision.

**Scope concluded on GitHub (source-authored, not tested):**

1. **Desktop / ordinary ChatGPT:** 10 WebView2 workspaces,
   browser chrome and supporting tabs, saved ordinary
   `/c/<uuid>` bookmarks, exact-chat operator `Send once`,
   main-window handoff and human-pasted continuation.
   The generation-control watcher performs a bounded,
   back-off native UI status read with **no model call per poll**;
   `POSSIBLY_COMPLETED` still requires human review.
2. **Durable safety/recovery:** original app-local
   `PromptOutbox` handles digest-only send-attempt history,
   exclusive pending workspace action, sealed offline-action
   intents, one-use native grants, post-effect receipts,
   interrupted lock owner identity, OS-confirmed manual
   reconciliation, and no blind repeat of unknown delivery.
   No raw ChatGPT messages, API keys or browser cookies
   are durable outbox fields.
3. **Offline Browser AI:** fixed localhost Lightpanda/WSL
   preview index, private target HMAC/document epoch,
   native-only operator-confirmed checkbox click/search fill,
   strict on-disk dispatch proof and independent static
   fixture readback; this is **not** a general online
   browser actor or verified installed CDP capability.
4. **Codex, MCP and Code Mode:** unchanged four public MCP
   tools; bounded Acorn JavaScript interpreter, native
   handoff broker and read-only status/receipt projections.
   `task-N` Codex goal outboxes are not `workspace-NN`
   consumer ChatGPT identities. Agent V2 still carries
   restricted source/review authority, not general execution.
5. **Official API goal (optional and separately billed):**
   collapsed desktop API panel → native main-window cost/turn
   approval and host-held `OPENAI_API_KEY` →
   authenticated private gateway → official OpenAI Platform
   Conversations/Responses API → same canonical
   PromptOutbox. Source supports a bounded 1–5 turn
   `CONTINUE / DONE_PROPOSED / BLOCKED` loop, typed output,
   usage receipt, STOP and unknown-result holds.
   The interpreter runs a fixed **read-only internal
   `tools.api_goal.status()`** composition after each
   provider-correlated turn; it cannot dispatch a paid effect,
   see output text or decide QA PASS. API `conv_...` is
   **not** the WebView2 ordinary ChatGPT chat `/c/<uuid>`.

**Explicit holds at handoff:**

- Ordinary consumer ChatGPT **unattended answer extraction
  and auto-reply** are not enabled/approved. UI state hints
  are not a verified reply; no scraping or private API fallback.
- Windows compiler, installed MCP/WebView2, pinned WSL
  Lightpanda `LP.clickNode`/`LP.fillNode`, OS approval,
  STOP/crash/restart, concurrency and 1/2/5/10 workspace
  performance remain `NOT_EXECUTED` at current HEAD.
- The optional OpenAI Platform mode requires *separate*
  account/model entitlement, host API key, explicit native
  billable run approval and independent cost/usage controls.
  The UI's default model name is only a source default,
  **not** evidence that the real account can use it.
  Post-response token limits are **not** a dollar hard cap.
- Model-generated `DONE_PROPOSED`, and an API provider's
  `completed` response, are not independent product QA.
  Cross-surface task IDs do not confer permission to
  control the consumer ChatGPT browser.

**Next owner:** a user-selected and verified
`LOCAL_PC_AGENT` on the actual PC, using the existing
[Windows handoff](../validation/localtest-readiness.md).
Begin with a clean pinned checkout and deterministic
source/compile gate, then installed native smoke,
offline browser/ChatGPT consent/recovery checks, and
finally an **explicitly opted-in low-cost real API test**
if authorized. Record a per-gate PASS/FAIL/HOLD tied
to the **same actually tested SHA**, sanitized evidence,
and first blocker. Do not turn a commit or fixture
into a fictitious runtime PASS, dispatch GitHub CI,
replace the default ChatGPT engine, or ship a release.

**Source-phase decision:** documentation handoff complete;
**STOP** the GitHub-source workstream here. This is not
`PRODUCT_ACCEPTED`, `WINDOWS_BUILD_VERIFIED`,
`INSTALLER_TESTED` or a release approval.
