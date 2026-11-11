**Development authority:** `OpenITStudios/LazyPrompting` → `Local`.  
**Source reviewed:** `5869d30bb593799e7a1fb49124117a4a516b46ec` (12 November 2026), after rebasing onto `origin/Local` `f4b3f51`.  
**Evidence classification:** source commits, **executed Windows Node 24.14.1 / Rust MSVC preflight, NSIS build, installed desktop smoke and signed-in Codex CLI 0.167.0-alpha.3.2 goal runs on that exact revision**; still **no production ChatGPT consumer acceptance**.

This file owns **only the current engineering position, one next task, and stop conditions**. Historical chronological milestones were moved without changing their bytes to [11 November source progress archive](history/2026-11-11-local-progress-before-localtest.md). Older Windows history is [archived separately](history/2026-11-10-full-checkpoint.md). Archive headings saying “Next” are historical, not parallel instructions.

## Intended product and scope boundaries

The operator gives Codex one approved goal, repository/branch, acceptance criteria and budget. LazyPrompting should supervise progress using verified Codex/QA/GitHub evidence, decide whether to continue, hold, pause or finish, and persist exact workspace/response identity with no blind repeat. The selected future conversational worker is ordinary ChatGPT Chat / Personalized Temporary Chat, not ChatGPT Work. The native host owns actual permission, process identity, STOP and recovery.

- **Installed desktop architecture:** Tauri/Rust + Svelte, up to ten WebView2 workspace views; separate native Rust MCP facade and packaged internal Node gateway. See [MCP ownership](../../mcp/ARCHITECTURE.md).
- **Supported engineering path today:** bounded Codex App Server `goal_run.*` tasks/worktrees, persisted prompt outbox and report, operator-approved native goal scope. This is **not the same thing** as the desired Codex-supervised `chat_goal.*` workflow.
- **Consumer ChatGPT Chat transport remains blocked:** no permitted supported unattended result channel or prompt sender is installed. The browser fixture and arithmetic probe are tests, not an approved ChatGPT automation. See [selected architecture](../architecture/codex-chat-workspace-plan.md) and [acceptance gates](../validation/codex-chat-workspace-gates.md).

## Current implementation and evidence

| Area | Implemented in source | Proven / still missing |
| --- | --- | --- |
| Goal-run/managed Codex transport | `src/transport/codex-app-server.mjs`, `goal-codex-runner.mjs`, bounded native `goal_run.*` | 27/27 Linux Node process/event/recovery/pause subtests were executed on exact reconstructed source; actual installed Codex CLI and Windows native path not verified |
| Durable workspace/checkpoint/outbox | `WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`, scheduler lease | Real-file/fake-host integration tests and 202 additional focused supervisor/storage assertions passed; neither real native permission nor actual QA is implied |
| Terminal event and restart safety | Process-local `turn/completed` correlation, source fingerprint, ambiguous-delivery holds | 34 event assertions passed; uncertain delivery, conflicting event and old unbound scope are held for reconciliation, never blind resend |
| Cooperative `goal_run.control.pause` | Durable native marker, `PAUSE_REQUESTED`/`PAUSED` source, explicit resume, STOP precedence | Node tests and Rust **static** source checks; Cargo/installed Rust MCP tests have **not** run on the combined revision |
| GitHub/worker feedback reviewer | `StructuredWorkerFeedback`, `TrustedGoalReview`, `createVerifiedGoalRuntime`, durable review prepare/commit | Source-only host-injected composition; no deployed native attestation provider, verified production worker feedback or independent QA receipt |
| Desktop/preview/ten slots | Svelte/Tauri, shared WebView2 workspace profile; Lightpanda separate from WebView2 | Historical Windows work was recorded before recent commits; ten-slot final installed acceptance, memory/performance and latest native build not verified |
| Production ChatGPT Chat/Temporary Chat | Target design and isolated localhost fixture only | Gate 0 supported transport/compliance, final-answer result binding, automated session rollover and ten-slot live acceptance **not completed** |
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

1. **Preflight source gate:** `scripts/verify-repository.mjs` enforces `docs/operations/current-state.md` shorter than **18,000 characters**. The file is bounded and `npm run test:repository` passes on the current revision.
2. **Windows native gate:** **executed** on `5869d30` — Node preflight, `cargo fmt/check/test`, NSIS build, installed desktop browser smoke, signed-in Codex goal runs and the WSL2 Lightpanda isolation test all passed. Remaining Windows gaps are the operator-accepted native dialog, an installed pause/resume session and measured ten-slot resource behaviour.
3. **CI execution gate:** a read-only, manual Windows workflow is registered on default `main` (commit `c10f121`) and requires the exact `Local` SHA. It has **not** been dispatched. The equivalent local run above is not a GitHub Actions run; no automatic dispatch or branch promotion is authorized.
4. **NSIS staging:** base Tauri config intentionally disables bundling. Staging and `npm run preflight:gateway-stage` are **executed and passing** for the current revision. Re-stage and re-verify after every source change; a stale closure installs a gateway that does not match the reviewed code.
5. **Product integration:** authenticated native final-turn/QA/approval binding to the already authored verified goal runtime is still missing. Consumer ChatGPT Chat automation is separately blocked and is **not** tested by the Codex/NSIS smoke.

See the [four-phase controlled Windows localtest checklist](../validation/localtest-readiness.md). The repository's manual-only workflow must never be presented as having run when it has not. The earlier source-only preflight audit is archived verbatim in [history](history/2026-11-11-source-only-preflight-audit.md), and the pre-local blindspot audit in [history](history/2026-11-11-final-pre-local-blindspot-audit.md).

## M2 Scoped GitHub and independent QA source wiring — 11 November 2026

- Added a host-only, opt-in constructor that connects three formerly
  unconfigured project providers to existing real source owners:
  `GitHubEvidence` (exact branch/commit range), `ReceiptReconciler`
  (separate QA callback) and `createVerifiedGoalRuntime`. It binds an
  immutable `repository/branch`, checks the exact provider object, and
  rejects model-supplied source overrides. The original nine-callback
  factory and all public MCP tools remain unchanged.
- **Executed in isolated Node 22.16.0:** 24 source assertions for real
  GitHubEvidence/ReceiptReconciler under fake HTTP/QA, and 17 constructor
  assertions using test-only storage-owner stubs. Both exact JS source
  blobs were checked against their Git object hashes. These tests **do
  not** establish a native-host attested Codex final turn, a real QA
  provider, production GitHub authentication, or an installed worker.
- **Remaining:** the seven native host callbacks and exact identity
  handoff, independently executed acceptance QA, one fully verified
  source-to-DONE goal loop, supported consumer ChatGPT Chat transport,
  and Windows Cargo/installer/native MCP acceptance. Nothing enables
  unattended website prompts or automatic next-turn authority.

See [scope/QA evidence](../validation/scoped-goal-evidence-integration-2026-11-11.md).

## Consumer ChatGPT Chat Gate 0 decision — 11 November 2026

- Primary-source review: OpenAI's consumer terms prohibit automatic/
  programmatic output extraction. No documented authenticated external
  ordinary/Temporary Chat session and final-turn API was established.
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

## One active next engineering task

**First:** repeat the executed localtest on the **next** exact `Local` revision before trusting it — `npm run test:repository`, `npm run preflight:localtest`, re-stage, `npm run preflight:gateway-stage`, rebuild the NSIS installer, reinstall and re-run the installed MCP plus the five targeted ignored native tests. The previous revision is evidence for that SHA only.

**Operator steps that are still open:** restart the MCP client session so the
registered server is picked up again, set `LAZYPROMPTING_CODEX_EXE` and
`LAZYPROMPTING_LIGHTPANDA_BINARY` for the Windows user so an automatically
started window inherits them, and run the installed operator session —
accept and reject the native approval dialog, `goal_run.control.pause` to
`PAUSE_REQUESTED` → `PAUSED` → `resume`, STOP precedence, restart without a
second dispatch, and a false QA rejection with the original response
identity. Connect live native worker/QA provenance to
`createVerifiedGoalRuntime` only after that evidence exists. The selected
ChatGPT Chat automation remains separately gated.

## Stop and safety boundaries

- Do not switch, merge, force-push, delete or auto-promote `main` or the retained `Harness` branch. All code work stays on user-selected `Local`; other OpenITStudios projects are read-only without their own authorization.
- No browser-site output scraping, unofficial consumer ChatGPT API, unattended ChatGPT Web send, account/session impersonation, automatic plugin installation, CI workflow dispatch, release or production deployment.
- STOP, deadline, unacknowledged sending, invalid scope, stale SHA, failed QA or ambiguous external result prevent continuation. Never infer that an unverified worker turn permits a new prompt.
- Only actual commands on exact checked-out sources count as executed tests. Archive previous source/history claims instead of duplicating them as current evidence.
