# Current State — Single Active Continuation Owner

**Branch:** `Local`  
**Reviewed structural baseline:** `1d2fdc0fdd50d4b0ab569fcd40330c72de88f0f2` (2026-11-11).  
**Scope:** repository root, architecture and MCP ownership standardization. Product/UI design changes are intentionally deferred.

## Active engineering position

- LazyPrompting has three noninterchangeable MCP implementation lanes: installed Rust desktop facade, packaged internal Node gateway, and legacy standalone Node server. A fourth opt-in path is the synthetic ChatGPT probe; see [MCP architecture](../../mcp/ARCHITECTURE.md).
- The code includes ten WebView2 workspace bindings, desktop/native browser controls, authenticated packaged gateway/Lightpanda integration foundations, bounded Codex execution and durable recovery. The observed Windows tests described below were recorded before this repository-only cleanup, not rerun against any new SHA.
- Only this file owns the active next engineering task. The former 134 KB chronological current-state file was retained byte-for-byte as an [archived checkpoint](history/2026-11-10-full-checkpoint.md). Historical `Next:` lines in that archive are superseded by this section.

## Existing evidence — provenance and limits

| Area | Most recent recorded evidence before architecture cleanup | Still unverified / not inferred |
| --- | --- | --- |
| Native Windows application | Installed x64 debug build opened; WebView2 controls and MCP browser navigation were exercised in recorded Windows tests | Full ten-tab interactive acceptance, complete operator-dialog and recovery workflow on final combined build |
| Gateway and private browser | Packaged Node authentication, native grants and staged integration; real WSL2 Lightpanda ten-context test recorded | Full production installation/security acceptance and behavior after arbitrary host changes |
| Managed Codex | Windows tests recorded ten distinct turns/threads with retained receipts and five-task worktree changes and checks | General-purpose autonomous correctness, product-wide release acceptance, all interrupted/unknown-outcome cases |
| ChatGPT transport experiment | ChatGPT Work arithmetic probe recorded two turns in five isolated chats after explicit bootstrap; Chat-mode callbacks remained inconsistent | A currently approved HTTPS endpoint, automatic Chat-mode delivery without reselection, real-goal operation, production transport |
| Repository reorganization | This task reviews exact GitHub source and authors a repository structure checker | Any claim that the new checker, entire test suite or native build passed on the post-cleanup commit |

Detailed chronology, source/proof claims and test limits: [archived full checkpoint](history/2026-11-10-full-checkpoint.md). Specific ChatGPT probe evidence/setup: [transport handoff](chatgpt-chat-handoff.md). No automatic work across another OpenITStudios repository is permitted.

## Repository restructuring checkpoint — completed at source level

- `4bb60ab`: root/toolchain metadata, documentation routers, MCP boundary map, historical checkpoint archive and static structure checker.
- `1d2fdc0`: byte-identical `BackendLifecycle` moved to `src/runtime/`, retaining a gateway compatibility export and a regression assertion; managed Codex transport no longer imports a gateway-internal owner.
- The Windows **manual-only** preflight definition uses the pinned Node 22.16.0 and lockfile installs for both root and desktop. Static ownership checking now traverses active documentation and rejects transport-to-gateway source back-edges.
- The read-only GitHub structural audit checked active documentation path references (85 Markdown documents, 84 relative references in the review) and source import locations. These checks do not constitute an executed npm, Cargo, Windows, MCP or installed application test.

## Next — selected proposed architecture, research recorded 2026-11-11

**Operator intent:** one goal issued in Codex for a chosen browser/repo/branch and bounded run duration. Codex supervises; ChatGPT ordinary Chat / Personalized Temporary Chat is the desired conversational worker; WebView2 remains 10 tabs with approved UI layout; GitHub project commits/status provide verifiable progress. An internal browser status + prompt sender is **proposed**, not implemented.

- [Canonical implementation contract](../architecture/codex-chat-workspace-plan.md): current owners, target MCP capability schemas, extension/native transport, GitHub evidence, recovery, budgets and blindspots.
- [Deep reference/source matrix](../architecture/research-browser-control-2026-11-11.md): 14 systems/extensions and upstream platform policies, without copying external code.
- [Acceptance/stop gates](../validation/codex-chat-workspace-gates.md): G0 permissions/host transport; G1 Windows fixture/extension; G2 input/completion fixture; G3 GitHub/Codex reconciliation; G4 authorized live ChatGPT Chat; G5 rollover; G6 ten workspace QA.

**Current status:** DESIGN / SOURCE_REVIEWED. NO new extension, prompt capability, live ChatGPT automation or runtime execution on this source revision. Old Codex `goal_run.*` worktree behavior is not the proposed `chat_goal.*` behavior.

**Exact next independent work:** verify Gate 0 account/host/terms and determine permitted consumer-ChatGPT transport. If unresolved, only the isolated, owned-browser fixture track is eligible for implementation after review; do not build or activate a live ChatGPT auto-loop. Fix the existing contradictory context-continuity source contracts only when the approved target path is implemented and migration tests are available.

## Gate 0 and first fixture checkpoint — 2026-11-11

- [Gate 0 verification](../validation/chat-workspace-gate0-2026-11-11.md): platform extension capability is plausible, but **unattended ChatGPT Classic automation is not authorized/verified**. Consumer Web auto-loop remains disabled.
- [Synthetic chat fixture](../validation/chat-fixture-2026-11-11.md): added scoped prompt/send status simulation and isolated loopback-only mock. Linux Node 22.16.0 assertions: **39/39 PASS on byte-matched source**; browser/Windows/ChatGPT/native integration **NOT_VERIFIED**.
- No existing production MCP capabilities, Tauri browser profile, UI layout, session cookies or ChatGPT website actions changed.
- **Next:** on the user-approved fixture track, validate an actual Windows MV3/WebView2 native channel and status observable; independently resolve Gate 0 before any ChatGPT live operation. Do not substitute fixture PASS for permitted live transport.

## Source-only browser extension milestone — 2026-11-11

- Added `apps/desktop/browser-extension/` with Manifest V3, fixture-only
  content script and metadata-only background worker. Code demonstrates
  composer focus, multiline input, one explicit Send request and status
  monitoring **without screenshot, OCR or assistant text extraction**.
- `npm run test:browser-extension-fixture`: 43/43 deterministic assertions
  executed on Linux Node 22.16.0; source blob SHA matches the tested files.
  See [extension evidence](../validation/chat-extension-fixture-2026-11-11.md).
- **Not yet:** installed WebView2 extension, native MCP↔extension bridge,
  ChatGPT browser send/completion acceptance, or goal-driven chat loop.
  Do not confuse source-complete fixture with production operation.
- Next independent ChatGPT/GitHub work: native fixture bridge source and
  source tests where verifiable without Windows; keep unsafe site access
  OFF until host policy and native integration can be established.

## ChatGPT composer candidate — source only, 2026-11-11

- Added standalone, **not loaded** `src/browser/chatgpt-send-candidate.mjs`:
  candidate selectors for ChatGPT composer, sequential Send with cross-call locking, native verified-release, empty-editor check,
  bounded prompt IDs and an injected native-host admission callback.
- Node 22.16.0: **27/27 source-contract assertions PASS** on byte-matched
  module/test files. No real ChatGPT interaction or new browser permission.
- **Pending:** trusted Codex MCP → native host → extension transport, selector
  compatibility, official/live permission gate, and real turn completion.
  GitHub output may verify a source milestone, not the end of a chat turn.

## Fixture MCP -> trusted-host contract — source milestone

- Added `ChatFixtureHostBridge` and two opt-in, synthetic capabilities
  `workspace_chat.fixture_submit` / `workspace_chat.fixture_status` to
  the **Node gateway registry/router**, without changing its four public tool
  names. No normal production startup injects the provider.
- The bridge requires a native-source admission callback, exact
  workspace/epoch/view/loopback URL, one-use grant, bounded active slots,
  monotonic observation events and independent verified evidence before
  another prompt. Host callbacks and Rust/WebView2 communication are still
  **injected test seams, not installed integrations**.
- The new repository test
  `npm run test:fixture-mcp-bridge` is **AUTHORED_NOT_EXECUTED** on the
  committed tree. An isolated Node host-mirror smoke (16 assertions) and
  existing extension fixture regression (43) plus composer candidate (27)
  passed; these do not prove the exact new gateway test or Windows integration.
- Next: complete the trusted native host↔fixture extension bridge on Windows
  without activating consumer ChatGPT automation; verify exact-source Node
  tests, IPC and sandboxed origin admission before considering live transport.

## Debug-only Rust MCP to WebView2 fixture increment — 2026-11-11

- **New source:** `apps/desktop/src-tauri/src/chat_fixture_native.rs`;
  only debug build with explicit `LAZY_FIXTURE_BRIDGE_ENABLE=1` admits
  `workspace_chat.fixture_send` / `fixture_status`. Both remain behind
  the existing four MCP tool names; no UI layout or normal production
  commands changed.
- The installed MCP request now has an explicit native fixture route
  through the existing same-session/executable-checked named pipe.
  It verifies the child WebView's exact loopback URL and workspace ID,
  reserves before any Send, limits two active fixture prompts, and
  never automatically retries or releases uncertain operations.
- The fixture extension can receive the native page-visible test message.
  Its status is **advisory only**; native source never extracts ChatGPT
  output and always reports `nextPromptAllowed=false`.
- **Executed in isolated Linux Node 22.16.0:** existing extension 43,
  new native window-message simulation 28, composer candidate 27, and
  new Rust source-contract 28 assertions. These are fixture/syntax/source
  checks, **NOT** a Rust compilation, WebView2 Windows test, or ChatGPT
  Classic integration.
- **Unresolved P0:** Rust `cargo check/test` on exact SHA; real extension
  installation/host callback; persistent verified receipt and release;
  permitted ChatGPT Classic transport; Temporary Chat rollover.
  See [evidence and blockers](../validation/chat-fixture-native-webview-2026-11-11.md).

## Shared-profile safety correction — 2026-11-11 (source-only)

- Separated debug fixture WebView2 user-data directory `browser-profiles/fixture-debug`
  from the normal shared signed-in `browser-profiles/browser-01`. Normal
  ten-workspace profile behavior remains unchanged when the debug flag is off.
- The debug extension loader now pins SHA-256 for its loopback-only manifest,
  `background.js`, and `content-script.js`, rejecting missing/modified
  assets before passing the directory to Tauri/WebView2.
- Added Rust unit tests for profile leaf selection and extension asset integrity,
  **AUTHORED_NOT_EXECUTED** (no Rust/Cargo or Windows host in this runtime).
- Added `npm run test:fixture-extension-integrity`: **16/16 Node assertions
  EXECUTED_TEST_PASS** in Linux Node 22.16.0 on Git-blob-identical assets;
  tampered scripts, expanded host scope, and missing assets are rejected.
- No signed-in profile migration, extension install or ChatGPT automation
  occurred. The existing page-visible fixture messaging is still untrusted.
  Next: obtain exact-SHA Rust compile/Windows WebView2 evidence with an
  approved runner, then build an authenticated native-extension channel.

## Native-owned direct Send fixture — 2026-11-11 (supersedes prior page-message transport)

- Retired the unsafe `window.postMessage` native-command handler on the
  owned fixture. A fixed `chat_fixture_send.js` is now embedded using
  Rust `include_str!` and invoked by **native `Webview.eval`** only
  after MCP/native workspace and URL admission. The script independently
  rechecks the current exact URL before touching its synthetic composer.
- Extension remains a **status-only observer** for its internal
  `chrome.runtime` messages. Native fixture status still samples the
  fixture `#status` field; both are **observations**, not authoritative
  final-turn receipts. Native dispatch remains `SEND_OUTCOME_UNKNOWN`
  and `nextPromptAllowed=false`; no auto-loop/unverified retries.
- Re-pinned the extension's content-script SHA-256 after deleting the
  page-visible command listener; isolated profile and permissions stay
  unchanged. The native JS is compile-time embedded, not loaded from an
  arbitrary external directory.
- **Executed in Linux Node v22.16.0, exact tested source:** extension 43,
  direct-send fixture VM 49, Rust/JS source contract 32, detached composer
  27, and fixture integrity 16 — **167/167 assertions PASS**. New Git
  blobs were checked against byte-identical local executed files.
- **NOT_EXECUTED:** Rust/Cargo compilation and tests, installed Windows
  WebView2, actual native eval and extension lifecycle, GitHub receipt
  reconciliation, and ChatGPT Classic/Temporary Chat operation.
  See [proof](../validation/chat-fixture-direct-send-2026-11-11.md).
- Next: independently verify the exact Rust build and WebView2 behavior,
  then implement authenticated extension-origin status reporting or a
  supported official host completion signal. Do not use the removed
  page-visible message channel for external sites.

## GitHub-first project scope and incremental receipt check — 2026-11-11

- Audited `src/integrations/github-evidence.mjs` and
  `src/integrations/receipt-reconciler.mjs`: previously the former only
  accepted the `Local` branch, and the latter only handled
  `OpenITStudios/LazyPrompting:Local`. This conflicted with the user-selected
  **one project/branch per Codex-controlled workspace**.
- A new **explicit trusted-host `scope`** now enables read-only checks for
  any approved repository/branch without widening the default/legacy
  behavior. `GitHubEvidence.changesSince` reads the bounded commit range
  by exact SHA, verifies ancestry, rejects truncated/diverged/rewritten
  histories, and rechecks HEAD after fetching. It returns a compact
  chronological commit index only, never a transcript or QA PASS.
- `ReceiptReconciler` now optionally binds the authorized project scope
  and requires matching goal ID, prompt ID, repository, branch, HEAD and
  trusted receipt verifier before accepting QA/goal results. `NOT_EXECUTED`
  cannot set `acceptancePassed=true`.
- **Executed:** Linux Node v22.16.0, 52/52 deterministic assertions
  PASS using fake GitHub HTTP only; both source files and test Git blobs
  match byte-for-byte. See
  [scope/evidence QA](../validation/github-progress-scope-2026-11-11.md).
- **Not implemented:** native workspace-to-GitHub credential binding,
  production GitHub watcher, actual GitHub API integration into the
  ChatGPT goal loop, authenticated live ChatGPT completion, and installed
  Rust/WebView2 Windows acceptance. The existing model/renderer cannot
  self-approve a GitHub scope.
- **Next:** wire the scoped verifier behind a native-authorized
  workspace/goal identity with persistent checkpoint and precise
  trust rules, without adding a second source-of-truth; run exact-SHA
  Rust/native CI only with authorized dispatch. Keep ChatGPT Web
  auto-prompting OFF until platform gates pass.

## Main-goal integration: scoped GitHub -> Codex review — 2026-11-11

- Added `src/prompt/github-goal-review.mjs`: read-only composition of
  **existing** WorkspaceRegistry, durable PromptOutbox, trusted host
  turn-verifier callback, `GitHubEvidence.changesSince`,
  ReceiptReconciler and `evaluateContinuation`. It has no second
  outbox/checkpoint store and never sends a prompt or writes GitHub.
- Source now checks exact workspace, session, context revision, ACKed
  prompt/response handle, goal/branch, host-provided checkpoint and
  authoritative terminal-turn receipt **before** any GitHub comparison.
  A mere extension `UI_COMPLETED_OBSERVED` or a GitHub commit is not
  treated as a verified ChatGPT answer. Missing/contradictory receipts
  return `REVIEW_REQUIRED`, with compact verified SHA/commit pointers
  for Codex to examine.
- Added deferred, **host-injected only** read capability
  `chat_goal.progress_review` in the internal Node MCP capability
  registry/router. Four public tool names remain unchanged; normal
  gateway and installed Rust desktop MCP **do not inject a goal reviewer**.
  No dynamic host/website activation, dispatch or cross-repo writing.
- **Executed:** Linux Node 22.16.0: `test:github-goal-review`
  **86 assertions PASS** with injected fake GitHub HTTP and trusted
  host fixture; `test:github-goal-mcp` **21 assertions PASS**
  with the exact router, registry, schema validator and a never-used
  RemoteBrowser test stub. Git blobs for 5 directly changed source
  and test files matched local executed copies.
- **Not yet complete:** durable CAS/outbox reconciliation after an
  accepted review; native Windows project/credential/turn binding;
  actual GitHub API read through the running app; real ChatGPT
  completion transport and Temporary Chat rollover. All require
  their own acceptance evidence. The review always returns
  `nextPromptAllowed=false` and cannot silently dispatch.
  See [specific acceptance](../validation/github-goal-review-2026-11-11.md).
- **Next:** bind the review to a trusted, durable host transition using
  existing workspace registry/outbox/scheduler lease and test
  restart/unknown side-effects before allowing any next prompt.
  Keep ordinary ChatGPT consumer-Web automation disabled until
  permitted host transport and real turn completion are confirmed.

## P0 goal-review checkpoint hardening and durable transition — 2026-11-11

- **Source implementation:** `GitHubGoalReview` now requires an exact
  `goalId`, `WAITING` checkpoint phase, pending task identity and a numeric
  checkpoint CAS version. Optional workspace/session/repo/branch/goal hash
  fields are checked if present. Its read-only `inspectUnderLease` entry
  is for a host that already owns the same exclusive scheduler lease.
- **New host composition:** `src/prompt/goal-review-reconciliation.mjs`
  requires injected native authority, read-only pinned-head validation,
  the existing WorkspaceRegistry, PromptOutbox and CheckpointStore, and
  one exclusive host lease. It never uses a model-supplied trust flag.
- **Durable handoff:** existing CheckpointStore now supports
  `REVIEW_PREPARE` (non-dispatchable `RECONCILE_REQUIRED` intent) and
  `REVIEW_COMMIT` (after registry CAS, exact response outbox release and
  head recheck). Restart resumes a prepared intent idempotently;
  a source move, stale scope, uncertain side effect or operator STOP
  cannot be silently converted into READY/DONE.
- **Local execution:** Node 22.16.0 Linux executed **62** checkpoint/scope
  assertions and **95** reconciliation/restart assertions on fake host and
  file-backed simulated stores; legacy checkpoint smoke also passed.
  Five new/modified source and test blobs were byte-identical to the
  executed local files. See [focused proof](../validation/goal-review-durable-reconciliation-2026-11-11.md).
- **Not production-connected:** this new reconciler is not instantiated
  by the installed Rust MCP or default Node gateway, and all results
  keep `nextPromptAllowed=false`. The tests did **not** execute the
  real Windows host, installed ChatGPT integration, actual GitHub HTTP,
  native grants, or the complete existing test suite.
- **Next:** test this source with **actual** repository file-backed
  stores and exact-SHA Windows Node/Cargo preflight, then bind one
  native-authorized provider to the existing host without adding a
  second MCP public interface. Keep ChatGPT consumer-Web automation OFF
  until host permission and actual final-turn evidence pass.

## Active next: trusted worker feedback and conservative no-commit handling — 2026-11-11

**Product priority:** allow Codex to make context-aware decisions from an
authorized worker's structured result *without* scraping ChatGPT consumer
output, falsely equating UI idle with a final turn or treating a Git commit
as complete QA. This source-only increment supersedes earlier stage-specific
`Next:` lines above; those remain history, not the current action list.

- New `src/prompt/structured-worker-feedback.mjs` accepts strictly bounded
  worker summaries, blockers, evidence pointers and proposed next actions;
  exact goal/workspace/session/task/prompt/response/source identity and a
  trusted host fingerprint/terminal-turn/transport/operator-scope
  attestation are required.
- New `src/prompt/trusted-goal-review.mjs` ignores caller-provided
  `proposal`, supplies the verified worker proposal to the existing
  GitHub reviewer under a host lease, and rechecks review identity.
  If GitHub HEAD did not move or QA evidence is missing, an attested
  short worker explanation is still available for targeted review but
  does not permit another prompt.
- The existing `GoalReviewReconciliation` now requires
  `feedbackVerified=true` and an exact `workerFeedbackHash` to prepare
  a durable review. The hash is recorded through
  `REVIEW_PREPARE/REVIEW_COMMIT` into the same canonical checkpoint.
  Direct, caller-controlled review preview remains non-dispatching.
- **Executed (Linux Node 22.16.0, fake host):** 69 assertions on the
  committed contract test runner; 33 assertions on review composition.
  Both new source files and their two test runner Git blobs match the
  locally executed files byte-for-byte. Expanded exploratory test suites
  passed separately. See
  [worker result proof](../validation/worker-feedback-gate-2026-11-11.md).
- **Not executed on this combined tree:** full existing Node suite,
  actual file-backed owner integration, Cargo/Rust/Windows WebView2,
  installed desktop MCP, real GitHub API from the app, real Codex
  App Server callbacks or ChatGPT Chat final-turn integration.
  The latest Rust/Windows source still has **no injected production
  chat-goal reviewer**. All new results retain
  `nextPromptAllowed=false`. No browser UI/layout changes.

**Exact next independent engineering task:** run the real repository
`WorkspaceRegistry`/`PromptOutbox`/`CheckpointStore` integrated
regression and exact-SHA Windows Node/Cargo preflight when a permitted
runner is available. Then bind one authenticated native-host provider
(`readIdentity`, `readResult`, `verifyResult`, `verifyTurn`,
`readHead`, `authorize`) before considering any actual dispatch.
For ordinary ChatGPT consumer Chat, independently prove a permitted
final-turn/result transport or retain a user-confirmed manual handoff.
Do not present the official Codex App Server as the same product
transport as ChatGPT Classic.

## M1 real-store integration checkpoint — 2026-11-11

- Replaced an exclusively simulated confidence claim with a reproducible
  local integration test against the **actual** `WorkspaceRegistry`,
  `PromptOutbox`, `CheckpointStore`, `CheckpointTransition`,
  scheduler file lease and `GoalReviewReconciliation`.
- `tests/run-goal-review-real-storage.mjs` performs durable
  reserve -> ACK -> REVIEW_PREPARE -> registry CAS -> response outbox
  reconcile -> REVIEW_COMMIT -> restart classification. It verifies the
  checkpoint, registry, response identity, worker fingerprint and exact HEAD
  persist consistently. Three post-write crash points must recover without
  sending or re-reviewing another prompt.
- **Executed evidence:** Linux Node v22.16.0 on Git-blob-identical source,
  68/68 assertions PASS in the reproducible committed runner. Additional
  exploratory 163/207 assertion runners passed locally, including two
  shared-workspace isolation and scheduler-lease denial scenarios;
  they are not committed regression claims. Existing two worker-feedback
  contract runners also passed again (69 + 33 assertions). See
  [real-store verification](../validation/goal-review-real-storage-2026-11-11.md).
- Added `test:goal-review-real-storage` to root npm scripts and existing
  manual-only preflight. **No CI dispatch, Windows Cargo test, native MCP
  injection, browser automation or live ChatGPT transport was performed.**
  Host approval and GitHub HEAD in this fixture are independently supplied
  synthetic callbacks, so external provenance remains NOT_VERIFIED.
- **Next active implementation:** bind a *trusted host-owned composition* to
  existing official Codex App Server final-turn events and scoped source
  verification, then prove exact-SHA end-to-end supervisor cycle with real
  host receipts. Avoid another checkpoint owner or direct consumer ChatGPT
  UI automation. Full Windows installed acceptance and separately supported
  ChatGPT Classic transport are still release gates.

## M1 composition source milestone — 2026-11-11

- Added `createVerifiedGoalRuntime` in
  `src/prompt/verified-goal-runtime.mjs`, a single opt-in, host-only
  composition of canonical real stores, structured worker feedback,
  trusted review, GitHub evidence, decision engine and durable reconciliation.
  It requires absolute non-colliding storage paths and nine injected
  authenticated-host callbacks; it ignores caller-provided `proposal`.
- **Executed:** Linux Node v22.16.0, exact source and test Git blobs,
  32/32 full composition assertions PASS with local persistence and fake
  external provider/host. A legitimate stored turn can produce
  `RECONCILED`; missing QA yields `REVIEW_REQUIRED` with a bounded
  verified explanation and no state commit; untrusted turn and
  wrong workspace/path fail closed. See
  [composition proof](../validation/verified-goal-runtime-2026-11-11.md).
- Preflight includes `test:verified-goal-runtime`. No provider is
  installed in the Rust desktop or default Node gateway. There is
  **no production ChatGPT auto-loop, no live native approval and no
  source of independently verified consumer ChatGPT final turns**.
- **Exact next action:** implement and test a narrowly scoped native
  provider for the nine callbacks using existing Windows MCP/IPC and
  officially supported Codex App Server final-turn events. Prove
  operator consent, exact source scope, recovery/STOP, and QA on a
  pinned Windows build before exposing any runtime capability; keep
  consumer ChatGPT Chat transport blocked until independently permitted.

## M2 native Codex turn receipt — staged source increment, 2026-11-11

- The installed Rust MCP facade now advertises read-only
  `goal_run.turn_receipt` behind its existing four public tool names.
  `goal_runs.rs` correlates an already operator-approved, not-stopped
  goal run with the task's exact persisted Codex turn and
  `PromptOutbox` `RESPONSE_VERIFIED` receipt. It checks task identity
  before constructing a path, approved criterion, thread, turn,
  context revision, run mode, branch/base SHA and unique original
  prompt ID. It returns **metadata only**.
- Its receipt explicitly states `recordedCompleted=true`,
  `finalTurnHostAttested=false`, `qa=NOT_EXECUTED`,
  `acceptancePassed=false` and `nextPromptAllowed=false`.
  A persisted record is not independent live Codex
  `turn/completed` provenance or proof of successful QA.
- **Executed:** 29/29 static V8 source-contract assertions on the
  staged Rust source blobs. Linux Node 22.16.0 regression suites
  for real-store/verified-goal-runtime/structured-worker-feedback/
  trusted-goal-review PASS (68+32+69+33=202 assertions, unchanged
  Node source). A reproducible source-contract Node test is added
  to manual preflight; it has not been executed as an exact checkout
  Node command. Native Rust unit tests were authored but not run.
- **Not verified:** Cargo fmt/check/test, Windows named-pipe
  invocation, installed Rust build, actual Codex App Server final
  turn attestation, native-to-JS `createVerifiedGoalRuntime`
  provider binding and real ChatGPT Chat transport. No UI or
  browser automation changes, CI dispatch, repo promotion or release.
  See [native receipt QA](../validation/native-codex-goal-turn-receipt-2026-11-11.md).
- **Next:** run exact-SHA Windows Cargo and MCP acceptance when an
  approved runner is available. Connect an independently verified
  official Codex App Server final-turn receipt and host-approved
  scoped source/QA providers to the canonical verified runtime.
  Keep consumer ChatGPT Web automation unavailable until its own
  authorized transport is proven.

## M2 official Codex terminal-event correlation — 2026-11-11

- Identified the actual integration gap: `goal-codex-runner.mjs` already
  queried Codex App Server completed turns but discarded `onEvent`
  notifications. The first owned-transport step now feeds
  `turn/completed` notifications into a bounded, process-local
  `CodexTerminalEvents` recorder and checks exact thread/turn/status
  against the official terminal query before releasing the outbox.
- The existing canonical per-goal `report.json` records either
  `EVENT_AND_QUERY_CORRELATED` or `TURN_STATUS_QUERY_ONLY` for each
  completed turn. A failed/interrupted/conflicting event blocks the
  result; restart does not invent an event that the old process saw.
- The Rust native `goal_run.turn_receipt` reads this optional
  observation with exact task/thread/turn scope checks. It reports
  `processNotificationObserved` and `turnObservationKind` but **still**
  reports `finalTurnHostAttested=false`, `qa=NOT_EXECUTED`,
  `acceptancePassed=false`, `nextPromptAllowed=false`.
  No new MCP public tool, durable store, ChatGPT browser send or
  cross-repository writing capability was introduced.
- **Executed:** 29/29 Node v22.16.0 assertions for the new
  process-local event gate; 18/18 V8 static source predicates on
  the staged runner/Rust blobs. **Authored but not executed:**
  the actual `runReadOnlyGoal` fake-host integration suite and
  updated Rust native unit test. Full Node checkout, Windows
  `cargo fmt/check/test`, installed MCP call and live Codex
  event sequence remain NOT_VERIFIED. See
  [focused evidence](../validation/codex-terminal-event-correlation-2026-11-11.md).
- **Exact next step:** run the combined test/preflight on one pinned
  Windows build and verify the app-server notification schema in the
  approved native process. Then bind independent native operator/
  process authority and QA receipts to the existing
  `createVerifiedGoalRuntime`. Consumer ChatGPT Web auto-loop
  remains disabled pending a separately permitted host transport.

## M2 terminal conflict fail-closed and Node regression — 2026-11-11

- Fixed a verified recovery blindspot: `CodexTerminalEvents` no longer
  converts a known malformed terminal notification or exhausted event
  capacity into a harmless `NOT_OBSERVED` fallback. Both now quarantine
  uncertain evidence as a conflict.
- `goal-codex-runner.mjs` now keeps
  `GOAL_TURN_TERMINAL_EVENT_CONFLICT` in
  `RECONCILE_REQUIRED` **across restart**, without quietly querying or
  retrying the original task in a new process. The same durable report
  and outbox remain the canonical owners; no extra store, public MCP
  capability or send permission was introduced.
- **Executed Node v22.16.0 on exact reconstructed source blobs:**
  terminal event contract **34 assertions PASS**; real
  `runReadOnlyGoal` + `PromptOutbox` with injected fake Codex
  App Server and throw-only unused worktree/server constructors:
  **8/8 subtests PASS** (including original recovery, concurrency,
  malformed/failed event and restart-after-conflict). Four existing
  supervisor/storage runners were also rerun: **202 assertions PASS**
  using their stated host fixtures. Details:
  [Codex event/recovery QA](../validation/codex-terminal-event-correlation-2026-11-11.md).
- **Still not executed:** full checkout preflight, Windows
  `cargo fmt/check/test`, installed MCP pipe, live Codex CLI
  notifications or native host/QA attestation. This evidence must not
  upgrade consumer ChatGPT Classic auto-loop readiness. No release,
  CI workflow dispatch or cross-repo mutation.
- **Next canonical task:** run the full exact-SHA npm and Cargo preflight
  on an approved Windows runner, inspect native `goal_run.turn_receipt`
  against a real official Codex terminal turn, then bind independently
  authorized native/QA receipts to the existing verified goal runtime.
  Keep unresolved terminal conflicts paused for explicit reconciliation.

## Stop / risk boundaries

Never promote an earlier Windows test to a PASS on a later SHA. No force-push, merge, release, workflow dispatch, plugin installation, browser scraping, cross-repository mutation, license choice or production authorization is part of this cleanup. The selected `Harness` history branch remains intact.
