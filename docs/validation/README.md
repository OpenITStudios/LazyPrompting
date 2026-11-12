# Validation and Evidence Router

Verification is scoped. Authored tests, static checks, Windows integration observations, and release acceptance are **different evidence classes**.

| Gate | Command / owner | What it proves |
| --- | --- | --- |
| Repository ownership and import paths | `npm run test:repository` | Static filesystem, toolchain/lockfile metadata, MCP surface, import-layer and active-document path invariants only |
| **Provider-neutral AgentBackend migration (PROPOSED)** | [Universal Agent migration gates](universal-agent-migration-gates.md) | Codex/OpenCode parity and native OS QA requirements; not test results |
| **Proposed Codex-supervised ChatGPT workspace** | [Transport/extension/continuity acceptance gates](codex-chat-workspace-gates.md) | Requirements only; NO tests executed / NO live ChatGPT automation proof |
| Focused source contracts | Relevant `npm run test:*` in root or `apps/desktop` | Only the named Node test on the exact checkout |
| Broad Windows source/native preflight | `npm run preflight:localtest` (manual) | Multiple deterministic Node suites, frontend build and Rust checks/tests on the runner |
| Installed WebView2/pipe/Codex/Lightpanda | [Desktop acceptance](desktop-acceptance-gates.md), [WebView source QA](webview2-source-qa.md) | Actual runtime behavior only when observed in that environment |
| Packaging/source readiness | [Desktop build readiness](desktop-build-readiness.md), [Localtest readiness](localtest-readiness.md) | Criteria, not automatically a PASS receipt |
| Performance/repetition and supervisor quality | [Harness plan](harness-plan.md), [Supervisor evaluation](supervisor-evaluation-2026-11-10.md) | Isolated evaluation evidence with stated limits |
| Historical integration snapshots | `checkpoint-*`, `permission-*`, `chatgpt-probe-evidence/` | Evidence at recorded revisions; not validation of later source |

[Windows controlled-localtest readiness](localtest-readiness.md) distinguishes source tests, staged gateway integrity, NSIS build, installed smoke and ChatGPT transport, with explicit stop conditions. The new read-only staging checker can be invoked after staging via `npm run preflight:gateway-stage`; its isolated regression is `npm run test:gateway-stage-verify`.

`localtest-readiness.yml` is manual-only. Never launch it as a side effect of repository cleanup. For current status read [the active checkpoint](../operations/current-state.md).

Recorded read-only source review: [repository structure audit, 2026-11-11](repository-structure-audit-2026-11-11.md). This does not report Node/CI/native PASS.

## Native v2 authority (source-only, Windows not accepted)

[Native v2 read-only scope authority](../architecture/agent-v2-native-authority.md) records the newly authored Rust prepare/status/stop surface, versioned scope storage, native peer/workspace leases, source revalidation and exact non-execution boundary. SOURCE_COMMITTED only; no Cargo, installed Windows or provider run evidence was generated for these revisions.

## Universal MCP and multi-client validation

[Universal Agent Backend source contract — 12 November](universal-agent-contract-2026-11-12.md) records the exact v1 scope source fingerprint, 21 focused deterministic Node tests, and the unimplemented native provider-attestation/worker path. Runner: `npm run test:universal-agent-contract` (added to manual Windows preflight).

[12 November universal MCP implementation and research](universal-mcp-multi-agent-2026-11-12.md) documents the two-goal admission, strict sequential MCP handshake, native process-owned workspace/goal leases, source refs, and Windows operator test gates. The four goal-admission and six handshake fixture tests ran in an isolated Node environment; the exact installed Rust revision has NOT been built or tested here.

## Chat-workspace feasibility and fixture evidence

- [Gate 0 decision, 2026-11-11](chat-workspace-gate0-2026-11-11.md) — policy/host feasibility; live ChatGPT automation remains blocked pending verified authorization.
- [Synthetic chat fixture implementation evidence](chat-fixture-2026-11-11.md) — executed Node-only deterministic assertions, no browser/native/chat proof.

Run `npm run test:chat-fixture` for the bounded fixture regression. Do not treat it as a ChatGPT or WebView2 acceptance test.

- [Manifest V3 fixture send/status evidence](chat-extension-fixture-2026-11-11.md) — Node-only content-script/background tests; no real WebView2 or ChatGPT session claim.

`npm run test:browser-extension-fixture` checks the source extension on a synthetic DOM. It does not install an extension on the user's system.

- [Synthetic MCP / host adapter contract](chat-fixture-mcp-bridge-2026-11-11.md) — new gateway fixture-only capabilities, source assertions and unresolved native integration. Run `npm run test:fixture-mcp-bridge` to verify the source contract; current exact-tree test status is NOT_EXECUTED.

- [Debug-only Rust/WebView2 source fixture bridge](chat-fixture-native-webview-2026-11-11.md) — two additional Node source tests executed; native Rust and installed Windows integration NOT_EXECUTED.

Commands: `npm run test:native-window-fixture` and `npm run test:native-fixture-source`.

- [Fixture extension integrity and profile isolation](chat-fixture-native-webview-2026-11-11.md#follow-up-source-hardening--fixture-profile-isolation-and-integrity) — `npm run test:fixture-extension-integrity` (Node assets only; Rust/Windows not executed).

- [Native-owned direct-send fixture](chat-fixture-direct-send-2026-11-11.md) — 167 Node/VM assertions, no Rust/Windows/live ChatGPT claims. Commands: `npm run test:native-window-fixture`, `npm run test:native-fixture-source`, `npm run test:fixture-extension-integrity` (already wired into manual preflight).

- [Scoped, read-only GitHub progress and receipt QA](github-progress-scope-2026-11-11.md) — `npm run test:github-progress-scope`: 52 fake-HTTP/Node assertions; no real GitHub call, native host or ChatGPT integration.

- [Main-goal GitHub → Codex review source and MCP QA](github-goal-review-2026-11-11.md) — `npm run test:github-goal-review` (86) and `npm run test:github-goal-mcp` (21): fixture/injected host only, no WebView2 or ChatGPT acceptance.

- [Host-attested structured worker feedback source gate](worker-feedback-gate-2026-11-11.md) — Node source tests for exact identity, no-commit feedback, rejection of unverified worker results; not live ChatGPT/Windows proof. Commands: `npm run test:structured-worker-feedback` and `npm run test:trusted-goal-review`.

- [Goal-review durable checkpoint reconciliation](goal-review-durable-reconciliation-2026-11-11.md) — `REVIEW_PREPARE/COMMIT`, exact goal/turn/branch binding, crash-point recovery; Linux Node fake-host/file-backed simulation only. Commands: `npm run test:goal-review-scope-hardening` and `npm run test:goal-review-reconciliation`.

- [Real file-backed goal-review integration, 2026-11-11](goal-review-real-storage-2026-11-11.md) — real `WorkspaceRegistry`, `PromptOutbox`, `CheckpointStore`, `GoalReviewReconciliation`; runner `npm run test:goal-review-real-storage`. Host authorization and GitHub HEAD are injected fixtures; no Windows/ChatGPT acceptance.

- [Verified Goal Runtime composition, 2026-11-11](verified-goal-runtime-2026-11-11.md) — `createVerifiedGoalRuntime` binds actual registry/outbox/checkpoint, host-attested feedback, GitHub review and reconciliation under one lease. Linux source integration: `npm run test:verified-goal-runtime`; no installed/native ChatGPT acceptance.

- [Native approved Codex turn-receipt milestone](native-codex-goal-turn-receipt-2026-11-11.md) — read-only `goal_run.turn_receipt` through existing Rust MCP pipe, source audit 29/29, Rust tests authored but Windows/Cargo NOT_EXECUTED. Script `npm run test:native-goal-turn-receipt-source` added to manual preflight.

- [Codex App Server terminal event correlation, 2026-11-11](codex-terminal-event-correlation-2026-11-11.md) — process-local `turn/completed` + status-query correlation, now hardened against malformed event status, capacity loss and auto-resume after conflicting evidence. Exact-source isolated Node: 34 terminal-event assertions and 8 goal-run/recovery subtests PASS; Rust/Windows/real Codex acceptance remains unverified. Manual preflight retains the registered source, event and runner tests.

- [Real Node subprocess/stdio App Server protocol integration, 2026-11-11](codex-stdio-process-integration-2026-11-11.md) — **nine synthetic subprocess tests** use unmodified `CodexAppServer` and goal runner via actual JSON-RPC stdio; verified with legacy runner/event tests (17/17). Does not establish live signed-in Codex CLI, Windows native MCP, or ChatGPT consumer Chat operation. Command: `npm run test:goal-run-process-transport`.

- [Codex goal-run immutable scope binding and recovery gate](goal-run-scope-binding-2026-11-11.md) — versioned SHA-256 fingerprint of approved objective, acceptance, executable/repository/data/STOP paths, budgets and coding scope, validated before resume. Linux Node: 22 focused integration subtests and existing M1 contracts 202 assertions PASS; Rust acceptance remains unverified. Manual preflight includes `test:goal-run-scope-fingerprint`.

- [Universal agent v2 source runtime](universal-agent-source-runtime-2026-11-12.md) — 49 isolated Node contract/adapter/file-backed tests, with no Windows build or live agent acceptance. See test scripts `test:universal-agent-runtime`, `test:universal-agent-adapters`, `test:universal-agent-file-backed`.

- [Goal Run cooperative pause/resume source and recovery](goal-run-pause-2026-11-11.md) — 27/27 Node subtests for read-only Codex event/process/recovery and pause, 34 terminal-event assertions and 202 existing supervisor/storage assertions; native Rust source checks only, no installed Windows verification. Commands: `npm run test:goal-run-pause` and `npm run test:native-goal-pause-source`.

- [Complete npm script entrypoint preflight validation](npm-script-entrypoints-2026-11-11.md) — covers regular `node`, `node --test`, multi-file test commands, and chained `&& node` scripts. Source: 99 npm scripts / 103 targets checked against Local tree with no missing paths. Exact isolated parser tests: 25/25 PASS; complete repository preflight and Windows CI still NOT_EXECUTED.

- [Scoped GitHub/QA evidence provider composition, 11 November 2026](scoped-goal-evidence-integration-2026-11-11.md) — binds the existing `GitHubEvidence` and `ReceiptReconciler` to one host-approved project for `createVerifiedGoalRuntimeWithGitHub`. 24 source assertions using injected HTTP/QA and 17 constructor/wiring assertions with test-only storage-owner stubs PASS; not a live native final-turn attestation or automatic ChatGPT worker. Commands: `test:scoped-goal-evidence` and `test:verified-goal-runtime-github`.

- [Consumer ChatGPT Chat transport Gate 0 outcome](chatgpt-consumer-transport-gate0-2026-11-11.md) — current `BLOCKED_COMPLIANCE / HOST_UNSUPPORTED` for unattended consumer ChatGPT worker. Official consumer terms prohibit programmatic output extraction; Codex SDK/App Server and Agents API are distinct supported programmatic alternatives that cannot be silently substituted for the selected product.

- [No-change GitHub HEAD race hardening](github-head-stability-2026-11-11.md) — confirms that an apparently unchanged branch HEAD is re-read before reporting `SOURCE_HEAD_UNCHANGED`. A synthetic branch move between reads previously produced a false no-change report; regression now fails closed. `npm run test:github-head-race` joins manual preflight (8 assertions on exact Node source; not Windows or real GitHub acceptance).
