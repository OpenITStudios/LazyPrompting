# Current State — Single Active Continuation Owner

**Development authority:** `OpenITStudios/LazyPrompting` → `Local`.  
**Source reviewed:** `603d76de1e8ab7cb8404cdb0551fcb0f2de399bb` (11 November 2026), before the current-state compaction.  
**Evidence classification:** source commits plus narrowly scoped Linux Node execution; **no current-revision native Windows, signed-in Codex or production ChatGPT acceptance**.

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

## Immediate blockers to localtest

1. **Preflight source gate:** `scripts/verify-repository.mjs` enforces `docs/operations/current-state.md` shorter than **18,000 characters**. Before this compaction the file had **43,575 characters**, so the structural preflight was guaranteed to fail even if Node/Rust binaries were correct. This commit archives that old checkpoint verbatim and replaces it with this bounded active owner; rerun `npm run test:repository` on the complete checkout for full verification.
2. **Windows native gate:** there is no `cargo`/Rust toolchain in the current isolated execution environment and no current SHA Windows Cargo, named-pipe, installer or authentic Codex result run. No retrospective PASS claims.
3. **CI registration gate:** `.github/workflows/localtest-readiness.yml` exists on `Local`, but default `main` contains no workflows. GitHub manual `workflow_dispatch` requires a workflow registered on the default branch. **Do not modify `main` or dispatch CI without separate explicit authorization.** Windows can run `npm run preflight:localtest` locally when a runner is available.
4. **NSIS staging:** base Tauri config intentionally disables bundling. To build NSIS, explicitly stage the checksum-pinned Windows Node 24.14.1 binary/license and use `tauri.gateway.conf.json`. Verify with `npm run preflight:gateway-stage`; source-only tests cannot prove the staged resources or installer exist.
5. **Product integration:** authenticated native final-turn/QA/approval binding to the already authored verified goal runtime is still missing. Consumer ChatGPT Chat automation is separately blocked and is **not** tested by the Codex/NSIS smoke.

See the [four-phase controlled Windows localtest checklist](../validation/localtest-readiness.md). The repository's manual-only workflow must never be presented as having run when it has not.

## Latest source-only preflight audit — 11 November 2026

- Manual Windows workflow is registered on default `main`, restricted to
  a supplied exact `Local` HEAD. The connected GitHub tool set cannot
  create a new workflow dispatch; neither this conversation nor earlier
  commits constitute a Windows CI run.
- Static GitHub tree verification scanned all **110 active documentation
  files**, **196 relative links**, **92 `src/` JavaScript modules**
  and **81 relative imports**, with no missing paths or transport-to-gateway
  dependency inversion found. This is not an executed npm/Cargo suite.
- The old repository checker skipped test entrypoints written as
  `node --test ...` and later commands in `&& node ...` chains.
  Its validation now traverses **all declared Node entrypoints** instead
  of only the first simple script path. A separate isolated Node parser
  suite passed 25 assertions. All **99 existing npm scripts with 103
  entrypoints** passed a static tree/source check, before adding the
  new parser test script. See
  [validation evidence](../validation/npm-script-entrypoints-2026-11-11.md).
- **Next:** one user-triggered Windows Actions preflight is still
  required to obtain real Cargo, Vite and Node exit evidence on the
  pinned `Local` commit. No automated ChatGPT Chat website operation is
  enabled by this source validation.

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

## One active next engineering task

**First:** run `npm run test:repository` and then the full `npm run preflight:localtest` on the **exact, clean `Local` revision** using an approved Windows runner. Record SHA, command outputs, Windows/Rust/Node versions and exact failed gate. If this is unavailable, complete narrowly scoped source-only checks and report `NOT_EXECUTED` for native validation; do not enlarge this status file with chronological logs.

**After the gate passes:** stage and independently verify Windows gateway files, produce the NSIS installer, then perform a disposable installed MCP and signed-in Codex goal-run smoke including `pause → PAUSED → resume`, STOP, restart, false QA rejection and original response identity. Connect live native worker/QA provenance to `createVerifiedGoalRuntime` only after that evidence exists. The selected ChatGPT Chat automation remains separately gated.

## Stop and safety boundaries

- Do not switch, merge, force-push, delete or auto-promote `main` or the retained `Harness` branch. All code work stays on user-selected `Local`; other OpenITStudios projects are read-only without their own authorization.
- No browser-site output scraping, unofficial consumer ChatGPT API, unattended ChatGPT Web send, account/session impersonation, automatic plugin installation, CI workflow dispatch, release or production deployment.
- STOP, deadline, unacknowledged sending, invalid scope, stale SHA, failed QA or ambiguous external result prevent continuation. Never infer that an unverified worker turn permits a new prompt.
- Only actual commands on exact checked-out sources count as executed tests. Archive previous source/history claims instead of duplicating them as current evidence.
