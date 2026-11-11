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

## Stop / risk boundaries

Never promote an earlier Windows test to a PASS on a later SHA. No force-push, merge, release, workflow dispatch, plugin installation, browser scraping, cross-repository mutation, license choice or production authorization is part of this cleanup. The selected `Harness` history branch remains intact.
