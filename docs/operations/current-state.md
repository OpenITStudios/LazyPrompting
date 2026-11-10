# Current State — Single Active Continuation Owner

## Latest ChatGPT Chat handoff

See the [full report](chatgpt-chat-handoff.md) for the product goal, Windows test evidence, probe setup, and remaining acceptance work. ChatGPT Chat has not passed the two-callback test without intervention. The five-chat success was observed in Work mode. The latest Windows probe answered locally, but ChatGPT did not connect after execution policy rejected the temporary tunnel. The original checkpoint follows below.

**State:** FOUNDATION_ARCHITECTURE
**Branch:** `Local`
**Implementation:** PROMPT_ONLY_SUPERVISOR_SOURCE_AUTHORED
**Browser runtime:** LIGHTPANDA_SELECTED_PRIMARY; NOT_INSTALLED_OR_VERIFIED
**Codex model/control integration:** OFFICIAL_HOST_CALLBACK_INTERFACE_ONLY; NO_REAL_CODEX_TRANSPORT
**QA:** PERMISSION_FUNCTION_28_OF_28_PASS; SUPERVISOR_FUNCTION_30_OF_30_PASS; CHECKPOINT_FUNCTION_22_OF_22_PASS; NATIVE_NODE_RUNNERS_NOT_EXECUTED

## Approved focus
Align all relevant OpenITStudios governance and agent rules 1:1 in engineering discipline, then build an independent LazyPrompting foundation with OpenITStudios-aligned governance, source provenance, bounded/context-aware continuation, cost-efficient deterministic decisions and Harness² evaluation design.

## Durable decisions
- ChatGPT stays the primary human-facing workspace; GitHub is canonical source.
- Follow the latest actual work context rather than sending blind "ya lanjutkan".
- Minimize controller usage: rules first, small model fallback only for uncertainty.
- Lightpanda is the selected primary browser backend; its runtime, supported destinations and compatibility are unverified.
- Complete foundation architecture and gates before implementing any autonomous browser code.

## Unresolved
- Exact supported external supervisor-to-Codex/ChatGPT transport for the desired workflow.
- Lightpanda login, UI and streaming compatibility if independently pursued.
- Runtime language, official API credentials, isolation and cost budgets.
- Real quality and usage numbers.

## Next
Next: inspect and pin Lightpanda upstream release/license and supported host architecture; request installation authorization before installing binaries or enabling browser navigation. WebView2 detection remains relevant to the embedded desktop viewer, while Lightpanda is selected for automation backend evaluation. OPERATE disabled.

## Latest bounded change
- Added source-only permission evaluator, 13 positive/negative cases, and skill admission guidance.
- Permission cases have NOT been executed against the GitHub revision; this is not runtime authorization.

## Current security correction
- Write preflight now returns ASK, not ALLOW, for a claimed approval token. Only trusted host evidence can grant a real write.
- OPERATE lane is disabled even for source reads.
- 13 cases authored; runtime results remain NOT_EXECUTED. No claim of PASS.

## Permission evidence — 2026-11-10
- Pinned source revision `d2ccfecc21b11816eaa2311315b9d853ec50da69`: 13/13 expected decisions matched in an isolated JavaScript function-level harness with exact GitHub source and config.
- See `docs/validation/permission-evaluation-2026-11-10.md` for method and limitations.
- This is NOT the native Node runner on an exact checkout and NOT a live permission broker test.

## Latest governance QA — 2026-11-10
- 28/28 permission decision cases matched expected outcomes at source ref `e7fd6cb5b6b505ae7618469fe638f73184f7f196` in isolated JavaScript function execution with exact fetched configuration.
- Added `docs/governance/trusted-tool-broker.md` as an architecture contract only; no broker implementation or native Node runner was executed.
- Current permission test scope does not establish race-condition safety or actual enforcement.

## Latest architecture/provenance iteration
- Added `docs/architecture/supervisor-state-machine.md` with context-aware decision priority, duplicate/retry safety, STOP guards and zero-model-first policy.
- Extended `docs/governance/provenance-matrix.md` with pinned skill registry, permission owner, eight-lens and Blockbench root evidence.
- No new skill or autonomous browser runtime has been installed. State machine is design only; no runtime PASS claimed.

## Latest supervisor implementation
- Pure deterministic engine committed at `src/supervisor/decision-engine.mjs` with 24 frozen scenarios and Node runner source.
- At exact source ref `0c10187c844d32f97f875618c89ebf6346cf9510`, 24/24 expected decisions passed function-level JavaScript execution; see `docs/validation/supervisor-evaluation-2026-11-10.md`.
- Native Node runner, official transport, evidence reconciler and browser runtime remain NOT_EXECUTED / NOT_IMPLEMENTED.

## Latest hardening iteration
- Source at `543af59cfd39fa46d3594cb2a4858ed922d51c56`: 30/30 decision cases passed isolated JavaScript function execution after a failed-first control-character regex correction.
- Added `docs/architecture/evidence-reconciler.md` as an unimplemented trust-boundary contract.
- See `docs/validation/supervisor-hardening-2026-11-10.md`. Native runner, broker, checkpoint persistence and transport remain NOT_EXECUTED / NOT_IMPLEMENTED.

## Checkpoint iteration — 2026-11-10
- Added `src/supervisor/checkpoint-transition.mjs` and 22 frozen replay/recovery scenarios.
- At exact source commit `ec8a1265d33bdd892a21c4a120e25e4a6dd3b77f`, 22/22 passed isolated JavaScript function execution; see `docs/validation/checkpoint-evaluation-2026-11-10.md`.
- No persistent storage, native Node runner, trusted evidence broker or browser/Codex transport was executed.

## Durable checkpoint store iteration — 2026-11-10
- Added `src/supervisor/checkpoint-store.mjs` with exclusive single-host lock directory, CAS version transitions, synced temporary file + atomic rename and restart reconciliation state.
- Authored 11 Node filesystem scenarios in `tests/run-checkpoint-store.mjs` and documented limitations in `docs/validation/checkpoint-store-proof.md`.
- This store and its filesystem tests have NOT been executed; no crash-durability or end-to-end recovery PASS is claimed.

## MCP/browser implementation — 2026-11-10
- User explicitly requested beginning MCP and browser source implementation while remaining in ChatGPT/GitHub workflow.
- Added read-only stdio MCP server with status/evaluate/checkpoint-read tools; optional Playwright adapter restricted to localhost test origins.
- Authored MCP smoke and browser origin contract tests, but neither Node runner nor real Playwright/browser session has been executed.
- MCP server is not connected to ChatGPT, Codex or an installed host; browser adapter is not exposed as an MCP tool.
- No ChatGPT-Web scraping or automatic prompting is implemented.

## Source-first implementation expansion — 2026-11-10
- User explicitly deferred local testing and requested building all system code first in ChatGPT/GitHub.
- Added remote public HTTPS allowlist browser source and optional MCP read-only browser tools, GitHub HEAD evidence adapter, official-host callback adapter, and one-step orchestrator with reserve-before-dispatch.
- Added package manifest and runtime integration documentation.
- No native execution, MCP host connection, browser session, real Codex API, trusted broker or end-to-end unattended operation has been verified.
- Browser DNS rebinding/SSRF requires host egress enforcement; source restrictions are insufficient alone.

## Source-first broker/scheduler iteration
- Added `src/governance/authorization-broker.mjs` with trusted-host grant callback, Local-only branch, exact SHA and process-local replay guard; durable replay protection is still missing.
- Added `src/supervisor/scheduler.mjs` as an explicitly invoked bounded tick controller, not a background autonomous daemon.
- Reconciliation now requires an independent `verifyResult` callback instead of accepting worker-provided `trustedEvidence` as authority.
- Added source-only broker tests and `docs/architecture/source-completion-plan.md`; no native execution or real host integration performed.

## Durable replay and receipt integration
- Added `src/governance/replay-ledger.mjs`, integrated ledger reservations into `src/governance/authorization-broker.mjs`, and added `src/integrations/receipt-reconciler.mjs`.
- Added source tests and `docs/governance/durable-authorization.md`.
- Durable replay uses single-host filesystem assumptions and trusted callbacks; no live authorization, external agent transport, or native filesystem execution was performed.

## LazyDesigner MCP reference integration
- Inspected exact LazyDesigner Local source at `4015a05518b17f978adf10d29e0374183b2a283d`, including MCP package policy, Gateway, capability discovery and specialist skill.
- Added a distinct canonical four-tool Gateway, declarative capability registry, exact-name router, MCP package policy and provenance document.
- Legacy MCP entrypoint retained as compatibility only; canonical start script now points to Gateway.
- No live MCP client connection, runtime/backend recovery or protocol conformance is verified.

## Cross-repository reuse policy and Gateway hardening
- User authorized adopting useful patterns from their other repositories where relevant; each reuse remains pinned, independently owned and evaluated.
- Added `src/gateway/input-validation.mjs`, strict capability argument type/limit checks, and corrected advertised enabled capability count.
- Added `docs/governance/cross-repo-reuse.md` and source tests. No native execution was performed.
- MCP 2025-03-26 is the currently advertised implementation version; newer 2026 specification requires separate compatibility work before claims of support.

## Gateway lifecycle and result projection source iteration
- Added `src/gateway/backend-lifecycle.mjs` for demand-driven signature-aware reconnect and bounded backoff, not yet connected to real backend.
- Added `src/gateway/result-projection.mjs` and wired bounded structured output into canonical four-tool MCP Gateway.
- Authored source tests and `docs/architecture/gateway-lifecycle.md`; no native tests or live MCP host were executed.

## Managed backend and Gateway safety iteration
- Added `src/transport/managed-agent-backend.mjs`, connecting demand-driven BackendLifecycle to a trusted host callback interface; not a real Codex transport.
- Hardened canonical Gateway public tool input schema validation before routing.
- Browser navigation now validates target before launching Playwright; host network egress protections are still required.
- Added source tests and `docs/architecture/managed-agent-backend.md`. No Node, browser, MCP host or Codex integration execution performed.

## MCP handshake and deployment source iteration
- Added explicit protocol negotiation for the supported MCP 2025-03-26 stdio handshake and wired it to canonical Gateway initialize.
- Added trusted host-binding interface with required provider callbacks and receipt field checks; this is NOT a real Codex transport or cryptographic receipt verification.
- Added deployment prerequisites and example process configuration in `deploy/README.md`.
- Added protocol contract source tests; not executed. No live MCP connection, deployment or official Codex API calls performed.

## Dispatch authorization boundary correction
- Updated `src/supervisor/orchestrator.mjs` to require trusted host authorization before reserving and dispatching, and to pass a receipt to the agent adapter.
- Updated `src/transport/official-agent-adapter.mjs` to require a trusted independent authorization-receipt verifier before submit.
- Added `tests/run-orchestrator-security.mjs` and `docs/governance/dispatch-boundary.md`; tests authored but NOT executed.
- No live Codex/OpenAI transport, trusted host composition or operational dispatch verified.

## Trusted runtime composition iteration
- Added `src/runtime/trusted-runtime.mjs` to construct the broker, durable replay ledger, checkpoint store, receipt reconciler, official-host adapter, orchestrator and scheduler from trusted injected providers.
- Scheduler now forwards grantId and receipt to the dispatch authorization path.
- Added source-only contract test and `docs/architecture/trusted-runtime-composition.md`.
- Cross-store atomicity, grant receipt provenance and real Codex transport remain unresolved. No native tests or live dispatch executed.

## Scope-bound reservation verification
- Added independent `ReservationVerifier` checking current trusted grant, exact HEAD and persisted replay reservation; wired into TrustedRuntime agent adapter.
- Broker receipts now bind goal/task/repository/branch/SHA/operation.
- Orchestrator returns RECONCILE_REQUIRED for checkpoint reservation failure after broker grant consumption; no automatic retry.
- Single-host ledger does not guarantee exactly-once remote dispatch; cross-store atomicity unresolved. Tests authored, not executed.

## Multi-workspace direction — 2026-11-10
- User expects up to ten concurrent chats with separate workstreams. Adopt one global supervisor and explicitly scoped Task Workspaces; never use a shared browser profile or global task context.
- Reviewed `M-Minecraft-Emulator` Local at `f24a1aad133ad80eb15d779545805769eca492f4`: stable identity, presentation/session separation, no stale status assertions. Historical Sandboxie/VM plans are not imported.
- Added `docs/architecture/multi-workspace-isolation.md`, `docs/architecture/workspace-context-contract.md`, pure `src/runtime/workspace-router.mjs` and source tests.
- Source routing currently restricts all workspace writes to LazyPrompting Local; general multi-repository authorization and browser context isolation remain NOT_IMPLEMENTED. No runtime test executed.

## Multi-workspace implementation and blindspot review
- Added persistent `WorkspaceRegistry` (up to 10, versioned CAS, unique session/workspace IDs), bounded `admitContext`, in-process `RepositoryWriteLease`, and `WorkspaceBrowserPool` with distinct browser processes per workspace (max two active by default).
- Added source-only tests and `docs/governance/multi-workspace-blindspots.md` with 15 unresolved security/operational risks.
- IMPORTANT: browser pool is not authenticated at the host boundary; repository write lease is in-memory only; other OpenITStudios repositories remain read-only without explicit grants; native isolation and concurrency tests NOT_EXECUTED.

## Multi-workspace hardening iteration 2
- Added trusted-host workspace admission adapter and deterministic per-workspace budget admission.
- Fixed browser pool async capacity race by reserving before validation.
- Registry now rejects task IDs duplicated across workspaces.
- Added source-only negative tests and governance review. No native QA or real host session binding executed.

## Durable writer and recovery source iteration
- Added single-host exclusive `DurableWriteLease` with workspace owner token, expected HEAD verification and fail-closed stale locks.
- Added append-only fsynced `RecoveryJournal` with ordered task stages and pending reconciliation projection.
- Added source tests and documentation. Neither module is wired to actual GitHub mutation or dispatch; cross-store atomicity and remote writer fencing remain open. No tests executed.

## Guarded writer and journal dispatch integration
- Added `GuardedGitHubWriter` source contract requiring lease verification, HEAD freshness, authorization and a host-provided conditional remote write; no real GitHub writer adapter is connected.
- Wired optional `RecoveryJournal` through trusted runtime, scheduler and orchestrator. It records intent, grant, checkpoint, attempted dispatch and ACK/reconciliation stages.
- Cross-store atomicity and remote exactly-once remain unsolved. Journal stage after external ACK can fail and require reconciliation; no automatic mutation replay. Source tests authored, not executed.

## Restart recovery gate iteration
- Added `JournalRecoveryGate` to cross-check journal, replay ledger and checkpoint before dispatch; wired to TrustedRuntime when journalPath is provided.
- Existing task identity with any journal/replay/pending state is blocked until reconciliation, never automatically resent.
- Documented that ordinary GitHub update-ref force:false is not exact old-SHA CAS. No production remote writer adapter is claimed.
- Source tests authored but not executed; transactional atomicity and live transport remain unresolved.

## Product boundary correction — prompt-only
- User explicitly clarified LazyPrompting only types contextual prompts into ChatGPT; ChatGPT itself handles GitHub and coding.
- Added deterministic prompt planner and trusted host prompt dispatch gate source; neither performs GitHub writes or browser scraping.
- GitHub writer/lease and agent-dispatch infrastructure is legacy experimental source, outside approved runtime path; retained for compatibility review, not activated.
- Prompt tests authored, NOT_EXECUTED. Actual ChatGPT conversation transport and durable prompt reservation store remain unimplemented.

## Durable prompt-only iteration
- Added `PromptOutbox` with durable per-workspace reservation and verified response completion; no auto-retry on uncertain delivery.
- Added `ResponseObserver` requiring trusted session binding and exact host response handle; response text is not GitHub execution proof.
- Updated PromptDispatchGate to fail closed on uncertain reservation and require host response handle. Tests authored, not executed.
- No real ChatGPT conversation send/observe host is connected; browser scraping remains excluded.

## Prompt budget and context iteration
- Added deterministic per-workspace prompt-count budget and two-active global capacity gate.
- Added bounded workspace-specific context projection, rejecting explicit last-response identity mismatch.
- Both modules are pure source policies; host must authenticate context provenance and serialize budget/outbox admission. No actual ChatGPT conversation transport or runtime tests.

## Atomic prompt admission iteration
- Moved per-workspace prompt-limit and global two-active capacity enforcement inside the PromptOutbox exclusive-lock transaction, instead of relying on a preflight-only policy.
- Updated PromptDispatchGate to forward budget parameters and report specific reservation denial.
- Added source-only ten-workspace capacity/replay cases. The current single-host lock fails closed under contention; tests are authored but not executed.
- Budget parameters must be supplied by a trusted host policy, not model-controlled input. Real chat transport remains unavailable.

## Prompt recovery and host policy iteration
- Added pure restart recovery classification (READY, OBSERVE_ONLY, RECONCILE_REQUIRED, BLOCKED) without automatic resend.
- Added TrustedPromptPolicy for authenticated host-owned workspace budgets and optional dispatch gate integration.
- Host policy remains optional for legacy composition; production must require it and must not trust caller-provided prompt limits. No live ChatGPT send/observe transport. Tests authored, not executed.

## Automatic Chat Handoff — preserve old chats
- User approved new chat on context exhaustion, with old chats retained (no deletion).
- Added pure handoff preparation/verification and durable single-host HandoffLedger; same workspace/task identity, new chat session only after trusted proof.
- Pending prompts block handoff; duplicate handoff reservations are rejected; old session disposition is RETAIN_ARCHIVED.
- No real ChatGPT new-chat creation, actual archival, or canonical registry session switch is connected. Tests authored but not executed.

## Handoff registry binding implementation
- Added `WorkspaceRegistry.switchSession` with version CAS, PAUSED-only transition, incremented context revision and retained previousSessions list.
- Added `HandoffCoordinator` linking capsule preparation, ledger reservation, trusted host new-session callbacks, registry switch and ledger activation. Unknown outcomes fail closed and leave workspace paused.
- No live ChatGPT new-chat creation or real archive operation is implemented; no cross-store atomicity. Tests authored but not executed.

## Multi-project metadata and handoff restart classification
- WorkspaceRegistry now permits bounded project repository/branch metadata; this grants no GitHub permissions and does not enable legacy repo-specific dispatch modules.
- Added conservative `classifyHandoffRecovery`: unknown new-session creation is not retried; committed registry switch awaiting ledger activation is distinguished from divergent state.
- Tests authored not run; no authenticated host session lookup or live chat creation connected.

## Trusted handoff restart reconciliation
- Added `HandoffReconciler` for host-verified lookup of an uncertain new chat, CAS registry switch when still on old session, and ledger activation after an already committed switch.
- Requires exact handoff ID, capsule hash, session identity and accepted-context proof; never creates or deletes a chat during recovery.
- Tests authored not executed. No supported existing-ChatGPT-chat transport connected; no live handoff claim.

## Chat session transport capability boundary
- Added `assessChatTransport` to reject unapproved, undocumented, scraping-based or incomplete host transports; requires authenticated host session binding.
- Added `ChatSessionHost` as an injected five-operation callback contract, not a real ChatGPT provider integration.
- No supported consumer ChatGPT chat transport identified or connected; no actual chat automation claim. Source tests authored, not executed.

## Repository-first continuity decision and implementation
- User approved repository as the canonical checkpoint for each project's chat handoff: ChatGPT commits progress/rules/next steps; LazyPrompting only constructs a repo-bound continuation prompt.
- Added `assessRepositoryCheckpoint` and `buildRepositoryResumePrompt` requiring exact repo/branch/commit and independent source verification, with fail-closed handling for stale HEAD.
- Old chats are retained. No real chat creation or source-verification host is connected; tests authored, not executed.

## Repository-first handoff integration
- Added `RepositoryHandoffPreflight` with injected trusted source verifier and repo-bound resume prompt.
- `HandoffCoordinator` now optionally checks the verified checkpoint before reserving a new session and passes the resume prompt to the trusted create-session callback.
- Optional integration is for legacy compatibility only; production must require preflight. No actual GitHub checkpoint writes or live ChatGPT session transport; tests authored, not executed.

## Mandatory checkpoint and interrupted-chat fallback
- HandoffCoordinator now requires repositoryPreflight; missing or unverified checkpoint blocks session creation before ledger reservation.
- Added `chooseLastVerifiedCheckpoint` for abrupt context-limit fallback; only checkpoints independently verified at current branch HEAD qualify. Uncommitted chat work remains unverified.
- No live session transport or runtime QA. Source tests authored, not executed.

## Read-only GitHub checkpoint source verification
- Added `GitHubCheckpointVerifier` with injected authenticated getBranchHead/readFile callbacks, immutable-SHA rules/status reads and HEAD recheck to detect branch movement.
- This is a source-only adapter contract; no trusted GitHub runtime client or ChatGPT create-session host is wired. Tests authored, not executed.

## User architecture correction — ChatGPT owns context
- User explicitly rejected LazyPrompting GitHub integration and repository checkpoint ownership. ChatGPT retains responsibility for context recovery, connected sources and optional GitHub tasks.
- Removed repositoryPreflight dependency from active HandoffCoordinator and repository SHA requirement from chat handoff context.
- Added minimal `prepareChatContinuation` prompt composer. Earlier repository-first modules remain historical but are not on the active handoff path; no files deleted.
- Source tests authored, not executed. No supported consumer ChatGPT session transport connected.

## Chat-only handoff bootstrap and session health
- HandoffCoordinator now composes ChatGPT-owned continuation bootstrap and passes it to trusted createSession callback before session verification.
- Added pure Session Health classification: context exhausted => prepare handoff; rate/quota limit => wait; generating => observe; uncertain delivery => reconcile; untrusted signals => pause.
- No GitHub checkpoint dependency in active handoff. Old chat retention preserved. Source scenarios authored, not executed. No real ChatGPT session transport connected.

## Multi-workspace session health scheduler
- Added pure scheduler for up to 10 isolated chat workspaces, default two PLAN_NEXT slots, duplicate signal rejection, and pending-prompt reconciliation guard.
- Context limit may prepare handoff; rate/quota limit waits; unknown host evidence pauses. No real host integration or prompt dispatch enabled.
- Source tests authored, not executed.

## Fair workspace scheduling and trusted health snapshot
- Added explicit round-robin cursor to the pure workspace scheduler and a host callback-based TrustedHealthSnapshot adapter.
- Health snapshots use workspace/session signals and pending outbox items; no GitHub integration or ChatGPT Web scraping.
- Cursor persistence, authenticated transport, real response observation and runtime QA remain unresolved. Tests authored, not executed.

## Approved non-blocking round-robin dispatch
- User approved switching to the next chat after authenticated send receipt, without waiting for the prior chat's response.
- Added pure `planNonblockingDispatch` separating per-sweep dispatch limit from cross-chat in-flight limit, preserving one unresolved prompt per chat.
- Actual sending, receipt-driven cursor advancement, durable atomic scheduling and real ChatGPT transport remain unimplemented. Tests authored, not executed.

## Non-blocking dispatch coordination
- Added source-only NonblockingDispatchCoordinator: plans a sweep, calls trusted dispatch gate sequentially, waits for acceptance receipts only, and advances cursor through injected compare-and-swap persistence.
- Requires single scheduler owner, durable outbox, trusted host policy and real session transport. Cross-store atomicity and live behavior remain unverified. Tests authored, not executed.

## Exclusive scheduler sweep lock
- NonblockingDispatchCoordinator now requires withSchedulerLease around the entire sweep; added single-host filesystem directory lock and adapted existing source scenario.
- A stale lock is not automatically cleared; uncertain delivery must be reconciled. Multi-host locking and cross-store atomicity are not provided.
- Source tests authored, not executed; no real ChatGPT host transport.

## Durable scheduling cursor
- Added single-host fsync/rename cursor persistence with expected-value guard under the mandatory scheduler lease.
- Cross-store atomicity with prompt outbox remains unresolved; unknown delivery requires reconciliation. Source tests authored, not executed; no live ChatGPT transport.

## Independent response lifecycle
- Added ResponseLifecycle to inspect acknowledged pending prompts across workspaces, invoke trusted ResponseObserver and evaluate completed responses independently of dispatch order.
- Evaluation after outbox closure still needs durable retry queue; uncertain delivery remains blocked. Source tests authored, not executed; no live ChatGPT transport.

## Adaptive event-driven planning
- Added pure event-priority dispatch planner with round-robin fallback and verified three-cycle no-progress review gate.
- Event and progress evidence must come from trusted host; no automatic sending or repository access is performed by this planner.
- Tests authored, not executed. No live event subscription, persistent progress evaluator or ChatGPT transport.

## Durable response evaluation queue
- Added minimal idempotent single-host queue for response evaluation identities, with atomic-file persistence and duplicate suppression.
- Not yet wired atomically to ResponseObserver/outbox. No task transcript stored; source tests authored, not executed.

## Durable response bridge
- ResponseObserver optionally enqueues verified response identity before outbox closure; ResponseLifecycle optionally replays pending evaluations and marks them completed.
- Production must wire the same queue to both. Legacy no-queue compatibility remains non-durable. Cross-store atomicity and evaluator concurrency remain unresolved; tests authored, not executed.

## Durable response runtime composition
- Added fail-closed source factory wiring the same durable evaluation queue to ResponseObserver and ResponseLifecycle with a single-host exclusive inspection lease.
- Source tests authored, not executed. Host callback transport, recovery content retrieval and cross-store atomicity remain unresolved.

## Durable progress review
- Added single-host persisted verified progress counters (up to ten workspaces), duplicate response suppression and three-cycle review threshold.
- Requires trusted evaluator integration; source tests authored, not executed. No live ChatGPT transport.

## Verified progress response integration
- DurableResponseRuntime can now persist evaluator-verified progress evidence by response ID before completing durable evaluation entries.
- Unverified/missing evidence leaves evaluation pending for recovery. Progress persistence is optional for legacy composition, and trusted host integration is not implemented. Tests authored, not executed.

## Uncertain delivery reconciliation
- Added read-only trusted lookup by original prompt idempotency key, with acknowledgement restoration only on matching ACCEPTED host evidence.
- NOT_FOUND or unavailable lookup never triggers resend. Host lookup capability is unverified. Tests authored, not executed.

## Trusted adaptive snapshot
- Added source composition for authenticated workspace signals, pending outbox, host events, persisted verified progress counters and cursor into adaptive planning.
- Decisions are advisory; dispatch coordinator is not yet connected to adaptive plan. Source tests authored, not executed; live host transport unresolved.

## Adaptive dispatch integration
- NonblockingDispatchCoordinator now accepts an optional adaptive snapshot under the scheduler lease, revalidates candidates against current health/outbox eligibility and uses receipt-driven dispatch.
- Snapshot consistency, fairness under changing candidate sets and live transport remain unresolved. Source tests authored, not executed.

## Existing consumer chat transport feasibility gate
- Extended transport admission to require existing consumer conversation binding and authoritative idempotency-key delivery lookup; ChatSessionHost now exposes lookupDelivery callback.
- No provider is verified to meet these requirements. API conversations are not treated as existing ChatGPT chats. Source tests authored, not executed. OPERATE disabled.

## Desktop multi-browser application foundation — 2026-11-10
- Product focus shifted by explicit user direction from incremental supervisor modules to standalone desktop app and multi-browser workspace manager.
- Read-only reference: OpenITStudios/M-Minecraft-Emulator Local @ f24a1aad133ad80eb15d779545805769eca492f4; reviewed Tauri/Svelte desktop architecture and explicit lifecycle boundaries. Did not modify reference repo.
- Created `apps/desktop/` Svelte UI skeleton (Overview, Browser Manager, Prompt Queue, Settings), 10-workspace state model, responsive dark/red styling and source contract scenarios.
- UI uses temporary example state only. No native Tauri Rust host or actual browsers/ChatGPT sessions are connected; no local or native tests executed.
- Next: implement application-native lifecycle, isolated browser identities, resource budgets and admission-controlled browser binding; then connect host evidence only after capability approval.

## Native desktop shell foundation — 2026-11-10
- Added Tauri 2 Rust manifest, build/config, restricted capability, and a single read-only `runtime_status` command that reports zero browser instances, no transport, automation disabled.
- Added typed frontend status bridge with fail-closed fallback and desktop dev/build scripts. No native browser commands or session control exposed.
- Source committed only; no dependency install, Rust compile, frontend build, Windows launch, or native integration QA. No claims of actual browser management.

## Native instance registry — 2026-11-10
- Added bounded Rust in-memory registry for 10 logical workspace identities and 2 reserved preview slots; registered a read-only Tauri list command and typed frontend bridge.
- Registry register/unregister methods are internal only; no browser process is launched or controlled. Rust test authored, not run. No native build, Windows test, browser isolation proof, or ChatGPT host transport.

## Browser lifecycle admission and budget — 2026-11-10
- Added Rust evidence-gated lifecycle state machine (Unbound/Admitted/Starting/Running/Suspended/Stopping/RecoveryRequired) with provider and process identity checks; no browser launch API exposed.
- Added bounded resource reservation accounting (default capacity to be provided by caller; no CPU/RAM measurements). Rust source tests authored, not run.
- Remaining: real provider attestation, process identity observation, isolated storage, crash reconciliation, UI wiring, native build. OPERATE disabled.

## Shared login architecture correction — 2026-11-10
- User explicitly chose one account/login shared across up to ten workspace conversations, without separate profile authentication or emulator-style isolation.
- Updated desktop/native architecture and added pure shared-browser topology model; browser profile is shared while conversation bindings and queues remain logically separate.
- No credential copying, token extraction, automatic sign-in, or real ChatGPT Web control. Source authored only; no native tests or browser sessions executed.

## Shared-browser preinstall hardening — 2026-11-10
- Added pure SharedBrowserController with 10 unique conversation bindings, one visible view default, parked inactive views and verified pending state before unbinding.
- Added source-only contract scenarios and documented provider, process ownership, login/logout, crash recovery, memory pressure, security and installation gates.
- These are NOT a browser host, and no browser was installed or launched. The claim that every blind spot is eliminated is not supportable before native verification. Existing-chat automation remains blocked.

## Native shared profile registry — 2026-11-10
- Added Rust SharedProfileRegistry for ten logical conversation bindings, one selected view and pending-aware rebind/unbind; read-only Tauri projection and typed frontend bridge.
- Fixed pure controller to deny conversation rebinding with an unresolved prompt. Legacy InstanceRegistry still exists and needs consolidation; no native browser lifecycle or credentials handling is enabled.
- Source committed only; tests and native build not executed. No claim of zero remaining blind spots.

## Shared registry consolidation and tab recovery — 2026-11-10
- Removed legacy InstanceRegistry from active Tauri command/state wiring and removed obsolete frontend bridge; shared-profile registry is the sole active native workspace owner. Legacy source remains inactive.
- Added pure verified tab identity lifecycle, single-focused view rule and restart LOST reconciliation. Source tests authored, not executed.
- Browser provider, actual tab identity evidence, process ownership, browser install and native integration remain unverified. No browser installed.

## Browser provider pre-install decision — 2026-11-10
- Documented comparison of embedded WebView, externally managed Chromium and Lightpanda; WebView selected for first evaluation only, not for installation or ChatGPT automation.
- Added fail-closed provider capability admission contract and source-only tests. Caller-provided evidence must eventually be replaced by trusted broker attestation; no live provider verified.
- No installation, native test, login, performance benchmark or ChatGPT Web control executed.

## WebView pre-install verification contract — 2026-11-10
- Added platform-specific source-only preflight for runtime, shared manual login, view identity, logout propagation, restart recovery and telemetry; added tests and stepwise 1/4/10-workspace benchmark plan.
- No actual provider attestation, native build, login experiment, browser install or performance measurement. Preflight flags are not independent proof. ChatGPT automation remains disabled.

## Read-only native WebView boundary — 2026-11-10
- Added Rust WebviewProviderStatus and Tauri read-only command; platform OS string is informational, all capability/install/navigation/automation fields explicitly false.
- Added typed UI bridge and Browser Manager provider status. No actual WebView runtime detection, browser instance, login, navigation or process control.
- Source committed only; no build, tests or performance measurement. No evidence of supported ChatGPT consumer session transport.

## Windows WebView runtime discovery source — 2026-11-10
- Added Windows-only read-only EdgeUpdate WebView2 runtime registry version probe (HKCU/HKLM), no process launch, with non-Windows unknown fallback; exposed version and provenance to UI.
- Registry detection is weak installation evidence, not proof WebView starts or shares login. The source was not compiled/tested; GUID/path and platform behavior require native verification. No browser installation, login or navigation.

## WebView source defect correction — 2026-11-10
- Corrected Rust runtime status test that would falsely fail on Windows with installed WebView2.
- Corrected frontend dotted-version regex and status consistency validation; updated Browser Manager terminology to shared login.
- Added docs/validation/webview2-source-qa.md with precise unexecuted native test matrix. Source-only changes, no native build or runtime proof.

## Runtime evidence integrity correction — 2026-11-10
- Added explicit runtimeUsableVerified=false to native WebView status and frontend validation. Registry version is now labelled a weak hint, not a verified working runtime.
- This closes a misleading UI status claim; does not establish provider compatibility, OS runtime identity, shared login, or actual browser functionality. Source committed only, tests/build not run.

## Browser readiness correction and benchmark contract — 2026-11-10
- Removed unverified Windows registry product GUID lookup and its unused winreg dependency. Provider now explicitly returns runtime unknown, not a misleading installation hint.
- Added pure 1/4/10 workspace benchmark sample validator requiring platform, version, RAM, CPU and switch latency observations. This validates shape only; caller flags are not independent proof.
- Tests authored, NOT_EXECUTED. No official runtime probe, build, browser launch or measured benchmark yet.

## Desktop build source hardening — 2026-11-10
- Frontend build now runs Svelte/TypeScript checks before Vite; Tauri window label explicitly matches capability scope `main`.
- Added docs/validation/desktop-build-readiness.md for exact native verification sequence and stop conditions.
- No dependency installation, frontend build, Rust compilation, browser launch or WebView2 runtime verification was performed. Remaining blockers are execution evidence and supported host integration, not another unverified success claim.

## Security gate correction — 2026-11-10
- Fixed two browser admission/preflight evaluators that previously returned ready=true based solely on caller-provided booleans (including a claimed operator approval). They now return reviewComplete=true but ready=false pending trusted host attestation.
- Updated source-only tests to assert that untrusted evidence cannot authorize browser installation. No browser install, dependency install, build or test execution performed.
- This correction prevents a false-positive admission path in the pure source contracts; an actual trusted admission broker is still unimplemented.

## Desktop preview review — 2026-11-10
- Reviewed current App.svelte and app.css for a source-grounded interactive preview (not a Tauri screenshot or native build).
- Corrected remaining Settings language that implied per-workspace browser isolation; one shared login/profile remains canonical.
- User-facing preview is illustrative and uses ephemeral data; no browser installed, build executed, login performed or runtime QA claimed.

## Emulator-inspired UI simplification — 2026-11-10
- Read-only reference: OpenITStudios/M-Minecraft-Emulator Local pinned f24a1aad133ad80eb15d779545805769eca492f4 (LazyTesterApp.svelte and lazy-tester.css).
- Rebuilt LazyPrompting desktop UI around a compact topbar, horizontal page tabs, simple workspace rows, restrained dark semantic palette and red action/selection accents. Removed oversized KPI cards and duplicate side navigation; preserved ephemeral add/select behavior, max 10, and fail-closed provider status.
- Emulator repository was not modified. This is source-authored, NOT built or rendered in native Tauri; no browser installation or automation.

## Single-page Emulator-style UI — 2026-11-10
- User requested exactly one short, clear page. Removed separate Browser, Queue and Settings navigation; consolidated workspace list, selected workspace summary and browser connection status on one page.
- Kept add/select UI-only behavior, 10-workspace capacity, shared browser profile and fail-closed status. Removed unused multi-page styles.
- Source-only; no native build, render verification, browser installation or ChatGPT automation. Emulator repository untouched.

## One-page UI/UX refinement — 2026-11-10
- Polished Emulator-inspired single page with stronger title hierarchy, compact capacity/status toolbar, local workspace search, selected-row indicator, clearer detail panel, empty search state, responsive spacing and keyboard focus.
- Search/add/select operate only on ephemeral UI workspace state. No browser navigation, transcript access or runtime controls added.
- Source committed; Svelte/native build and visual QA NOT_EXECUTED.

## Emulator screenshot parity UI — 2026-11-10
- User approved matching the Emulator Play screen. Replaced the prior list/detail dashboard with two-row Emulator-style header, large centered preview stage, and five cards per row; Settings is the only secondary tab.
- Slot selection updates preview-stage label only. Default five slots; UI-only Settings can show ten. No fake launch button, live website, profile login, or background activity claim. Emulator repository untouched.
- Source-only implementation; no native build/render test. Exact pixel parity remains unverified.

## Functional readiness review — 2026-11-10
- Audited Emulator-style desktop source; corrected disconnected slot CTA from misleading 'Open preview' to selection-only wording.
- Added docs/validation/desktop-acceptance-gates.md with frontend, native shell, browser session, performance, and supported supervisor transport gates.
- Current status remains SOURCE_COMMITTED / NOT_EXECUTED. No native build, browser installation, real login, RAM benchmark, or live ChatGPT automation performed.
- Next requires an explicitly authorized native QA environment; native QA approval is not permission to install browser or automate ChatGPT.

## Ten-slot UI optimization — 2026-11-10
- Changed default Play view to ten logically separate slots in two rows of five on desktop, reduced card/preview-stage heights, strengthened selected-slot visibility and added narrow-screen responsive layout.
- All slot controls are selection-only; browser/session status remains disconnected and no automatic ChatGPT action is implied.
- Source-only, native render/build and real 10-connection performance remain NOT_EXECUTED. The UI supports ten slots visually, not ten verified live connections.

## MCP-friendly UX design decision — 2026-11-10
- Approved direction: compact ten-workspace control layout with optional grid and one large selected browser area; AI control must use stable IDs and typed controller operations rather than coordinate clicking.
- Added docs/architecture/mcp-ui-control-contract.md as design-only contract for observable state, safe read-only tools, revisioned UI-only actions, permissions, and error handling.
- No MCP server, browser control or ChatGPT transport implemented. Existing Emulator-style source UI remains unchanged pending full UX design review.

## MCP-friendly compact UI implementation — 2026-11-10
- Implemented a single-page compact (default) / grid ten-workspace UI, stable workspace IDs, search, selection, focus mode and local rename. Exposed semantic aria-pressed, labels and stable data-testid selectors for future UI QA/MCP adapters.
- No MCP server or shared controller adapter is implemented yet; UI state is local and ephemeral, and names are examples. Search does not change IDs or selected workspace. No browser or ChatGPT messages are accessed.
- Source committed, Svelte check/native QA NOT_EXECUTED. Next: source review and authorized frontend build validation before claiming runtime functionality.

## Ten-workspace event-driven capacity alignment — 2026-11-10
- Reused existing adaptive event supervisor and nonblocking planner rather than creating a duplicate scheduler. Default adaptive sweep is now maxDispatches=2 and maxInFlight=2, with integer limit validation. Caller overrides remain possible within 1–10 and need host-level policy gating.
- Authored additional default-capacity, pending-capacity, and invalid-limit test cases; tests NOT_EXECUTED.
- Existing source-only supervisor cannot observe ChatGPT Web responses or dispatch to them; no browser installation, login or automation enabled. Remaining gaps: trusted event source, authorized transport, durable runtime admission, measured usage and native QA.

## Shared local UI controller — 2026-11-10
- Added apps/desktop/src/app/workspace-controller.mjs as a pure, revisioned single source for ten workspace identities, selection, rename, filtering, view mode and focus. Svelte UI now dispatches actions to it rather than mutating separate local fields.
- Added TypeScript declaration and source-authored tests for identity, stale revision, rename, search, focus, and snapshot isolation.
- This is a local UI controller, NOT an MCP server or scheduler integration. No browser operation, persistent storage, network, or ChatGPT transport. Tests and native build NOT_EXECUTED.

## Scheduler read-only UI projection — 2026-11-10
- Added source-only scheduler projection with ten-ID validation, known status enum, duplicate rejection, and two-in-flight presentation cap; Svelte displays Activity unknown and Scheduler unavailable while no host snapshot exists.
- Added six source-authored cases; NOT_EXECUTED. A caller-provided trusted boolean is NOT a trust boundary: real provenance/authentication must be established by a privileged host before wiring snapshots.
- No scheduler invocation, MCP adapter, browser navigation, prompt dispatch, or live integration. Frontend/native builds NOT_EXECUTED.

## Native scheduler admission boundary — 2026-11-10
- Added read-only Tauri command scheduler_host_status, reporting explicit NATIVE_HOST / disconnected / unauthenticated / null snapshot. Renderer validates exact unavailable schema and shows host reason.
- This is a real source-defined native command boundary, NOT a trusted live scheduler snapshot or authentication mechanism. It cannot transition to connected without a separately reviewed trusted host integration.
- No browser installation, transport, dispatch, MCP server or native tests. SOURCE_COMMITTED; build and runtime NOT_EXECUTED.

## Scheduler lifecycle and native dependency correction — 2026-11-10
- Fixed an actual source-level compile dependency mismatch: scheduler_host_status used serde_json::Value but Cargo.toml did not declare serde_json; null-only snapshot now uses Option<()> without new dependencies.
- Added generation-token read lifecycle for scheduler host status, rejecting out-of-order responses and invalidating pending reads on UI teardown/disconnect. All statuses remain fail-closed UNAVAILABLE.
- Added source-authored lifecycle tests for stale reads, disconnect, and invalid host status. TEST_AUTHORED_NOT_RUN; no native build or live scheduler integration. Browser and OPERATE remain disabled.

## Rust-TypeScript scheduler contract audit — 2026-11-10
- Reviewed Rust scheduler_host_status, TypeScript readSchedulerHostStatus, and Svelte consumption against pinned Local source.
- Added static contract test checking command registration, native unavailable shape, renderer validation, and absence of UI dispatch calls; test authored but NOT_EXECUTED.
- Explicitly documented that renderer-supplied trusted flags cannot establish provenance in scheduler projection. No live snapshot bridge, MCP, browser, or native QA. Next: run existing source tests and build checks when execution is authorized.

## Desktop source QA preparation — 2026-11-10
- Reviewed desktop App.svelte and workspace-controller TypeScript declaration; corrected a source-level type mismatch by replacing Record<string,unknown> UI actions with a typed action shape compatible with applyWorkspaceAction.
- Added npm script test:desktop-source to run four existing controller/projection/lifecycle/static bridge tests in sequence, without browser or native build.
- GitHub repo was not locally cloneable in this execution environment (network DNS unavailable); the exact checkout tests, Svelte check and Rust build remain NOT_EXECUTED. No claim of passing tests or live behavior.

## Minimal operator UI — 2026-11-10
- Replaced redundant top dashboard, grid controls and ten large cards with compact left workspace navigation and one primary browser viewer. Kept ten stable workspace IDs, search, select, rename and focus actions routed through the same local controller.
- Browser offline, scheduler unavailable and automation off are presented without implying connected capabilities. Removed unused status polling from the simplified view; native read-only commands remain available for future trusted integration.
- Grid view remains a controller capability but is not exposed in the minimal UI; no MCP adapter, browser transport, or live scheduler. SOURCE_COMMITTED; Svelte/native QA NOT_EXECUTED.

## Modern manual-first operator UI — 2026-11-10
- Codex remains the intended primary agent controller; LazyPrompting only manages visible workspace UI and browser integration status. Added minimal Connections dialog for Codex/MCP/Browser availability.
- Added explicit per-workspace manual setup confirmation, distinct from browser connected or Codex-ready proof. Open Browser is visibly disabled until native browser runtime is verified and authorized; no fake browser launch, no implicit automation or prompt send.
- Polished dark navigation/viewer, stable workspace controls, and source-authored negative tests for confirmation validation. SOURCE_COMMITTED; tests and native QA NOT_EXECUTED. Manual confirmation is ephemeral and not proof of a real session binding.

## Optional manual intervention correction — 2026-11-10
- User clarified manual ChatGPT login/session selection is optional assistance, never a mandatory precondition to Codex work. Codex remains primary controller.
- Updated UI labels to Codex-first and explicitly optional setup. The local setupConfirmed flag remains a user note, never transport authorization, session identity proof or a gate to Codex. Open Browser remains disabled until verified supported runtime.
- SOURCE_COMMITTED; no browser launch, MCP control, or native QA performed.

## Unified minimal UI and future MCP naming — 2026-11-10
- Removed redundant optional manual checkbox, controller footer, rename button/modal, and explanatory filler from the desktop UI. Connections is now labelled Connections (Status), showing only Codex/MCP/Browser availability in one modal.
- Added pure controller action SET_PROJECT_NAME producing ChatGPT NN - Project Name with immutable slot ID and revision validation. This is a future MCP/controller capability only: no automatic naming or MCP transport exists yet.
- Replaced layered CSS overrides with cohesive dark styling. Open Browser remains disabled until verified browser integration; SOURCE_COMMITTED, UI/native tests NOT_EXECUTED.

## Browser-centric UI refinement — 2026-11-10
- Renamed default slots to Browser NN and controller SET_PROJECT_NAME output to Browser NN - Project Name. Future MCP may set a verified project label through this local revisioned action; no live MCP naming integration yet.
- Removed duplicate browser disconnected subtitles, explanatory empty-state paragraphs, and decorative empty-state labels; only Open Browser remains in the viewport (disabled until runtime admission).
- Reduced sidebar width to clamp(164px,17vw,220px) on desktop, increased browser viewport, and made Connection Status a compact top-right in-app overlay rather than a separate full-width panel. UI source only; tests/native QA NOT_EXECUTED.

## Approved shell visual polish — 2026-11-10
- Preserved the approved narrow sidebar + large browser viewer. Refined hover/focus/selection, typography, borders, spacing and red accents rather than redesigning layout.
- Connection Status is now accessible through both header (including Focus Mode) and sidebar, with aria-expanded/aria-controls and an in-app compact floating status panel instead of a separate below-page block. Panel is read-only; Codex/MCP/Browser statuses remain unverified/unavailable.
- No browser launch or Codex transport enabled. SOURCE_COMMITTED; desktop/native QA NOT_EXECUTED.

## Backend zero-waste admission gate — 2026-11-10
- Goal: prevent unauthorized, repeated, unverified or over-budget work before any AI inference or browser operation.
- Added pure `apps/desktop/src/app/work-admission.mjs` admission and classification functions. Checks workspace slot, explicit authorization, verified transport, pause/block flags, attempts/steps/token/time budgets. Unchanged input skips inference; known actions route deterministically. Defaults are engineering starting limits, not measured optimum.
- Added `work-admission.test.mjs` and `npm run test:work-admission`. Tests are SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is a standalone policy module, NOT yet wired to a trusted scheduler, MCP transport or browser runtime. No autonomous dispatch enabled.
- Next smallest backend milestone: connect a single trusted, read-only status snapshot to workspace lifecycle with explicit provenance and freshness checks; then execute source tests/build and verify runtime. Never infer transport verification from renderer state or UI flags.

## Codex-only workflow correction — 2026-11-10
- User explicitly rejected any AI Candidate/model-selection lane. Codex is the only reasoning agent; LazyPrompting is a deterministic workflow coordinator, MCP/browser bridge and state observer, not a second AI.
- Changed `classifyNextStep` from MODEL_CANDIDATE to CODEX_HANDOFF and added a routing test. A handoff label is advisory only: no live Codex dispatch or unverified transport was enabled.
- Efficiency targets: skip unchanged inputs, deduplicate idempotent work, avoid unnecessary polling, reuse verified context deltas, bound retries and enforce STOP. Any token budgets are operational guardrails for Codex usage, not a separate AI budget.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Next: prove official Codex transport capability, then connect trusted state and measure avoided handoffs.

## WebView2 browser candidate detection — 2026-11-10
- Started Windows system WebView2 candidate discovery in `apps/desktop/src-tauri/src/webview_provider.rs`. Read-only fixed system-root executable presence check, no installation, executable launch, browser navigation, profile access or automation.
- Existing `webview_provider_status` native command exposes `runtimeObserved` with discovery source `WINDOWS_SYSTEM_FILES` only if a candidate executable is found. `runtimeUsableVerified`, `configured`, login and navigation flags remain false; no version is claimed.
- No new dependencies. Native Windows compile/runtime tests NOT_EXECUTED; source commit only. The browser candidate is not yet mounted in the viewer. Next: native Windows verification and WebView2 embedding/identity design, with explicit consent before navigating sites or enabling browser control.

## Browser selection correction — 2026-11-10
- User explicitly selected Lightpanda as the primary browser backend for LazyPrompting. WebView2 remains the embedded desktop web renderer; existing read-only WebView2 discovery is relevant but does not prove browser availability. Lightpanda is the separate automation backend candidate.
- Codex remains the sole reasoning AI. MCP/backend workflow should connect Codex to the chosen browser only through supported, authorized interfaces; no ChatGPT Web prompt/response scraping.
- Selection is not installation approval or execution proof. Lightpanda binary provenance, platform support, license, isolation, compatibility and permitted destinations must be verified before installation or activation. SOURCE_COMMITTED / NOT_EXECUTED.

## Embedded viewer vs automation backend clarification — 2026-11-10
- User clarified that WebView2 remains required for the embedded browser viewer in the Tauri desktop app; Lightpanda is selected for the separate automation/browser-control backend, not as the visible WebView replacement.
- Do not infer session sharing, tab identity, authentication, or visual synchronization across the two runtimes. Any synchronization requires a separately designed and verified bridge.
- No browser runtime, navigation, installation or native QA was executed. SOURCE_COMMITTED / NOT_EXECUTED.

## WebView2 native status projection — 2026-11-10
- Added `apps/desktop/src/app/webview-status.mjs`: fixed-command, read-only native status adapter and fail-closed projection. Candidate executable presence is distinct from usable WebView. It rejects unexpected native capability flags, never enables navigation or creates a window.
- Added seven source-authored Node test cases and `npm run test:webview-status`. These are TEST_AUTHORED_NOT_RUN, not a verified native bridge.
- UI remains frozen and disconnected until a real embedded WebView lifecycle is implemented and tested. Lightpanda remains the selected separate automation backend candidate, not the viewer.
- Next: run Node and native Tauri checks on exact checkout, then implement controlled embedded WebView mounting and workspace identity only after verifying Tauri API and isolation constraints.

## Native browser workspace identity hardening — 2026-11-10
- Aligned `SharedProfileRegistry` with the UI's ten exact IDs (`workspace-01` through `workspace-10`). Native bind/select/unbind now reject unknown workspace IDs instead of accepting arbitrary strings. Added negative Rust test and updated existing native registry test fixtures.
- This is a source-only prerequisite for future embedded WebView binding. No WebView creation, browser navigation, Lightpanda launch or login/session synchronization has occurred.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Next: execute Rust/Node checks on exact checkout, verify Tauri WebView child API on target Windows runtime, then implement one workspace's explicitly controlled embedded WebView lifecycle before scaling to ten.

## Desktop native WebView probe wiring — 2026-11-10
- Connected existing `readWebviewStatus` adapter to `App.svelte` via a single `onMount` read of Tauri `webview_provider_status`; no polling, navigation, browser creation or model invocation.
- Observation is stored as an internal DOM data attribute for diagnostic inspection only. The approved UI remains unchanged and the Browser connection continues to show Unavailable. Host failure remains fail-closed. Unmount prevents applying stale results.
- SOURCE_COMMITTED; native runtime and Svelte checks NOT_EXECUTED. Next: run `npm run check`, `npm run test:webview-status`, and Windows Tauri checks before any embedded WebView launch.

## Deterministic embedded WebView lifecycle coordinator — 2026-11-10
- Added `apps/desktop/src/app/view-coordinator.mjs` with ten stable workspace slots, idempotent selection, revision checks, mount/unmount phases and generation tokens rejecting stale native receipts.
- Mount requests require both host authorization and provider verification; only native evidence may confirm mounted/unmounted. This module does NOT create WebViews, navigate, share sessions or connect Lightpanda.
- Added `view-coordinator.test.mjs` and `npm run test:view-coordinator`. TEST_AUTHORED_NOT_RUN. Attempted exact repository checkout from this environment; GitHub DNS resolution failed, so native tests/build cannot be claimed.
- Next: verify Tauri child WebView API and native host evidence on Windows, then connect this coordinator to a single authorized workspace mount; do not enable browser merely from renderer-supplied booleans.

## WebView mount trust-boundary correction — 2026-11-10
- Identified a source-level security gap in `view-coordinator.mjs`: caller-supplied `hostAuthorized`, `providerVerified` and `nativeEvidence` booleans could be mistaken for trusted native proof and advance a UI lifecycle.
- Closed mount and mount-confirmation transitions until a native-owned Tauri bridge with authenticated host-side lifecycle evidence exists. Workspace selection remains functional and idempotent; no browser launch or UI redesign.
- Updated six negative/selection tests to enforce fail-closed behavior. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; native Windows runtime and embedded WebView API still not verified.
- Next: verify supported Tauri child WebView API on a Windows host, implement host-owned mount command and lifecycle receipts, then permit projection only from host-owned state (not renderer-supplied booleans).

## First embedded WebView native proof source — 2026-11-10
- Verified Tauri 2 documentation: desktop child WebViews require the `unstable` feature, and Windows child creation must avoid synchronous command deadlock. Source references: https://docs.rs/tauri/latest/tauri/window/struct.Window.html and https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html .
- Enabled Tauri `unstable`, added `embedded_webview::mount_browser_01` async native command and a fixed local `browser-preview.html` proof page. Native command rejects non-main parent, uses fixed child identity and URL, does not accept arbitrary external destinations, and avoids duplicate child creation.
- This proof uses fixed native bounds and is NOT yet aligned to the selected viewer's actual measured geometry; the command is registered but is NOT invoked by the Svelte UI. The approved UI remains unchanged. No user session, browser automation or Lightpanda connection.
- SOURCE_COMMITTED; Cargo build, Windows execution and actual child WebView rendering NOT_EXECUTED. Before exposing Open Browser, verify exact Tauri API compile, host permissions, positioning/resizing, lifecycle cleanup, navigation restrictions and WebView2 availability. No claim of a working embedded browser.

## Source-first mandate and browser native evidence — 2026-11-10
- User explicitly requested continuing all feasible implementation in ChatGPT/GitHub without requiring local tests during this stage. Native verification is deferred, not presumed passed.
- Repaired a literal escaped-newline syntax defect in `view-coordinator.mjs` and removed an unreachable transition after the fail-closed mount guard.
- Added `browser_01_snapshot` as a native Tauri command that queries the actual child WebView registry on the `main` window. This is a host-owned observation of presence, NOT proof of successful rendering, page load, login or automation. Renderer cannot set its `mounted` value through arguments.
- Source-only commit; Windows/Cargo/Svelte tests and Lightpanda integration remain NOT_EXECUTED / NOT_CONNECTED.
- Next source milestone: replace fixed native proof bounds with verified viewer geometry and native-owned mount/unmount lifecycle; wire UI only after reliable status/permissions and coordinate handling are established.

## Ten-slot embedded WebView source integration — 2026-11-10
- User explicitly requested direct ten-workspace implementation rather than one-by-one iteration. Replaced Browser 01-only native commands with generic `mount_embedded_view` and `embedded_view_snapshot` for exact `workspace-01`…`workspace-10`, each mapping to a unique `browser-01`…`browser-10` child label.
- Native mount remains opt-in, fixed local preview URL and fixed proof geometry. No external navigation, automatic browser creation, shared WebView/Lightpanda session or UI status promotion.
- Added renderer-side ten-slot bridge, strict native snapshot shape validation and read-after-mount verification, seven Node scenarios and test script.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. These are source contracts, not verified native integration. Known unresolved: real viewer bounds, child visibility/selection, resize/move, cleanup, Windows build/API compatibility and actual WebView2 runtime. Do not activate all ten overlapping child views or claim full runtime integration.
- Next: implement dynamic viewer geometry and single-visible-child lifecycle, then wire explicit UI controls with native evidence and run native checks when a Windows host becomes available.

## Ten-workspace embedded viewer control — 2026-11-10
- Extended native `mount_embedded_view` to accept validated viewer geometry and enforce single-visible-child behavior; added `hide_embedded_views` command. Existing mounted views remain retained for switching. All ten workspace IDs use the same native implementation.
- Wired explicit Open Browser local-preview action to selected workspace in Svelte, with measured DOM bounds and native read-after-mount. Switching workspace hides other children, and stale switch callbacks are rejected by generation. No automatic launch on startup.
- Updated JS bridge geometry validation and tests. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Windows Tauri compilation, actual layout alignment and runtime rendering remain unverified. Current mount shows a fixed local preview page only, not external websites or ChatGPT Web.
- Remaining: native UI resize/focus geometry updates, robust async switch serialization and cleanup, Tauri API verification, real host runtime evidence, Lightpanda integration. Do not claim production-ready browser or login/session synchronization.

## Serialized ten-workspace viewer switching — 2026-11-10
- Added a shared last-intent-wins `viewer-queue.mjs` to serialize native hide/show commands and avoid overlapping async workspace switches. Queue close hides children and rejects future work.
- Wired Svelte workspace selection and explicit Open Browser local preview through the queue; added ResizeObserver-driven geometry refresh and unmount cleanup. Added three source tests and npm script.
- All operations still target the fixed local preview page; no external navigation or browser automation. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; native WebView rendering and Svelte/Rust build remain unverified.
- Known remaining risk: ResizeObserver can trigger multiple queued operations during continuous resizing; batching/debouncing and host-side atomic visibility remain future hardening. Browser mount identity/authorization and UI-ready status still require trusted native runtime proof.

## Viewer queue deduplication and failure propagation — 2026-11-10
- Hardened ten-workspace `viewer-queue.mjs` to coalesce identical selected workspace and viewer bounds; distinct geometry causes a refresh. Native show must return true; failed hide/show invalidates the cached intent so retries are possible.
- Updated Svelte caller to pass measured geometry keys and return actual read-after-mount success rather than silently treating any completed Promise as success. Added three JS source test cases for coalescing, geometry refresh and retry.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; native rendering and Svelte/Rust compilation NOT_EXECUTED. No Lightpanda or Codex transport activated. Next source milestone: host-side atomic visibility and lifecycle receipts, plus release-safe cleanup before claiming runtime-ready.

## Viewer queue reliability hardening — 2026-11-10
- Corrected a source-level failure mode where duplicate hide-only intent could resolve true despite no visible browser. Queue now preserves last actual result, catches native hide/show exceptions, invalidates failed intent for retries, and makes close idempotent.
- Added three negative regression cases. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; this is NOT a Windows runtime pass or a Lightpanda connection.
- Next highest-impact source work is native-host-owned atomic visibility/cleanup, followed by Lightpanda transport capability discovery and gated integration. Avoid redundant UI redesign or one-workspace-at-a-time duplication.

## Native child visibility and preview navigation hardening — 2026-11-10
- Updated the shared native mount path for all ten workspace IDs to hide other child views BEFORE showing the selected child; a failed hide aborts rather than intentionally exposing two views.
- Restricted proof navigation to the fixed `/browser-preview.html` path and the configured local dev origin `http(s)://localhost|127.0.0.1:1425` or Tauri local origin. This closes prior broad localhost origin allowance, which could otherwise permit navigation to unrelated local services. Added Rust negative URL test cases.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is not atomic at OS level and does not prove page rendering or production asset URL compatibility; verify actual Tauri URL scheme, Windows WebView behavior and Cargo compilation at final native validation. No Lightpanda connection or external browsing enabled.

## Lightpanda backend boundary introduced — 2026-11-10
- Added read-only Tauri `lightpanda_host_status` and renderer `lightpanda-host.mjs` projection. This is the independent Lightpanda CDP backend lane, separate from WebView2 child viewers. Status is explicitly NOT_CONFIGURED / disconnected / unverified / automation disabled.
- Added fail-closed ten-workspace admission rules; renderer-provided approvals/verification booleans cannot authorize automation. Native host admission, operator scope, compliance and real transport evidence remain required. Added seven source tests and npm script.
- No binary installation, CDP socket, process spawn, browser navigation, MCP connection, Codex invocation or ChatGPT Web automation was performed. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN.
- Next: design/implement a host-owned Lightpanda transport only after explicit endpoint/installation and supported CDP protocol are verified; no inferred session sharing with embedded WebView2.

## Lightpanda loopback endpoint configuration discovery — 2026-11-10
- Added native-only optional environment configuration `LAZYPROMPTING_LIGHTPANDA_CDP_ENDPOINT`, accepting a numeric IPv4 loopback `127.0.0.1:<port>` only. Rejects DNS names, remote addresses, malformed ports, paths and credentials; does not connect, spawn or enable CDP.
- Extended native status with `endpointConfigured`, and renderer projection preserves the distinction between configured and connected/verified. Added Rust and Node negative test cases.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No Lightpanda installation, CDP handshake, MCP or Codex integration performed. Next: implement a bounded, explicit host-side CDP health check only after installation/endpoint authority is established; do not infer session sharing with WebView2.

## Explicit bounded Lightpanda reachability probe — 2026-11-10
- Added opt-in native `lightpanda_probe` command. It only attempts one TCP connection to a validated numeric IPv4 loopback endpoint with a 350ms timeout, using a blocking worker so the async Tauri command is not blocked. No polling, process spawn, CDP messages, external addresses or browser navigation.
- Added renderer projection and tests separating `tcpReachable` from `cdpVerified` and `automationEnabled`; both latter fields remain false regardless of TCP result. Registered the native command but did not wire automatic invocation.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No Lightpanda runtime probe was actually executed, and a reachable port alone cannot prove Lightpanda/CDP compatibility. Next: protocol-level identity/handshake with strict bounds and explicit operator scope before any automation admission.

## Bounded read-only CDP discovery — 2026-11-10
- Added explicit `lightpanda_discover` native command to request `GET /json/version` only from the validated 127.0.0.1 endpoint, with 350ms connect/read/write timeouts, an 8KiB response cap, no redirects, no process launch and no WebSocket connection.
- Parses JSON and checks required CDP discovery fields. A matching response is classified `discoveryShapeValid` only, never proof of Lightpanda identity, CDP WebSocket handshake, authorized automation, or WebView2 session sharing. Added serde_json dependency, renderer projection and negative JS tests.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Native compatibility, HTTP framing behavior and real Lightpanda discovery are unverified. Future work: stricter protocol framing and verified CDP identity before enabling any automation.

## CDP discovery HTTP validation hardening — 2026-11-10
- Refactored native discovery response parsing into a bounded pure validator: exact HTTP 200 status, JSON content type, single Content-Length matching body bytes, reject transfer encoding and duplicate length, body <=4KiB / full response <=8KiB, and parseable JSON.
- WebSocket debugger URL must parse as ws://127.0.0.1 on the exact configured port with no credentials, query or fragment and a /devtools/browser/ path. The returned URL is inspected only, never opened. Added Rust positive/negative framing and remote URL cases.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Rust compiler unavailable in the current execution environment; no native Windows or Lightpanda protocol handshake was executed. Discovery response validity is not identity verification, and automation remains disabled.

## CDP discovery stream framing correction — 2026-11-10
- Updated read-only CDP discovery to stop reading after the declared Content-Length instead of waiting for the server to close the socket. This avoids a false timeout for HTTP keep-alive servers while retaining the 8KiB response and 4KiB JSON limits.
- Rejects missing or duplicated Content-Length during incremental reads, surplus bytes, and empty WebSocket browser target paths. Corrected CRLF escape handling in negative Rust fixtures.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No WebSocket handshake, Lightpanda identity proof, native Windows compilation or automation activation. The endpoint remains discovery-only.

## CDP discovery correctness and time-budget hardening — 2026-11-10
- Repaired the positive Rust HTTP fixture header separator; prior source could produce a false negative for a valid JSON discovery response.
- Added a 700ms total read deadline (in addition to bounded connect/read/write calls), stricter exact JSON media-type validation, and regression coverage for duplicate content type. HTTP keep-alive remains accepted when Content-Length is satisfied.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This iteration deliberately did not claim a WebSocket handshake: native runtime and Lightpanda identity are still unverified. Next implementation must use a vetted WebSocket client with proper random handshake key and response verification rather than ad hoc protocol claims.

## One-shot CDP WebSocket upgrade diagnostic — 2026-11-10
- Added tungstenite WebSocket handshake dependency and native `lightpanda_handshake` command. The explicit diagnostic first revalidates local CDP discovery, then attempts a single bounded WebSocket upgrade to the validated loopback browser debugger URL and closes it. No CDP commands, session retention, page navigation, process spawn, MCP or Codex actions.
- Native response distinguishes `websocketHandshake` from `identityVerified` and `automationEnabled`, both permanently false. No automatic invocation; source implementation is NOT_EXECUTED and Cargo dependency/API compatibility is unverified.
- Next: verify Rust compilation and actual Lightpanda handshake on Windows; only then design identity challenge and native-owned authorization. Do not infer that a successful upgrade is Lightpanda identity or permission to automate.

## WebSocket upgrade projection and regression guards — 2026-11-10
- Added `projectLightpandaHandshake` and explicit `handshakeLightpandaOnce` renderer bridge. A successful native WebSocket upgrade cannot elevate `identityVerified` or `automationEnabled`; malformed, forged, or failed responses remain fail-closed. Added four Node test cases.
- Repaired duplicate Content-Type negative fixture CRLF escaping in native Rust tests. No automatic invocation, CDP command, session persistence, MCP or Codex action.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Current Rust tungstenite integration still needs Cargo compilation and Windows runtime verification. Next: evidence-first compile/API verification and actual Lightpanda handshake before adding any CDP method transport.

## Lightpanda status contract consistency — 2026-11-10
- Corrected the native-unavailable renderer status projection to retain `endpointConfigured:false` consistently, and fail closed when endpoint/reachability claims conflict with native reason codes. Added three regression cases.
- Local environment capability check found Node.js but no `cargo` or `rustc`; therefore Rust/Tauri native compilation remains NOT_EXECUTED. No Lightpanda runtime is connected, and no CDP commands, MCP operations or Codex calls were activated.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Next milestone remains actual Rust compilation and native Lightpanda handshake verification before CDP command transport.

## Ten-workspace queue stale-intent correction — 2026-11-10
- Reviewed shared viewer queue while native Rust/Cargo compilation remains unavailable. Fixed a race where an identical queued intent could inherit a successful result after being superseded by a newer workspace selection; duplicate results now require the same generation and an open queue.
- Close now records actual native hide result rather than unconditionally reporting success on subsequent close calls. Added two regression test scenarios for superseded duplicates and closed viewer state.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; no Windows native validation, Lightpanda handshake or CDP automation executed. Keep backend integration gated until Rust compiler/runtime evidence is available.

## CDP HTTP Content-Length fail-closed parsing — 2026-11-10
- Identified a parser ambiguity: a malformed first Content-Length could leave the parsed value unset, allowing a later duplicate valid header to be accepted. Fixed both full-response validation and incremental framing to track header presence independently of parse success and reject malformed/overflowing lengths immediately.
- Added negative Rust fixtures for malformed and overflowing duplicate lengths. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; no Rust compiler, Windows runtime, actual Lightpanda handshake or MCP/Codex transport evidence. Avoid expanding CDP commands until native compile and transport checks pass.

## Pre-localtest consolidation — 2026-11-10
- User requested complete readiness before moving to local testing. Added `npm run preflight:localtest` deterministic gateway/desktop/Rust checks, manual-only Windows GitHub workflow, and explicit readiness gates in `docs/validation/localtest-readiness.md`. No workflow was dispatched.
- Added one-shot read-only native CDP `Browser.getVersion` probe over the previously validated loopback WebSocket; no general CDP command transport, no persistence or navigation. Added fail-closed JS projection and three regression cases.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is **not yet ready** for the user's requested end-to-end local test: no Windows Cargo build evidence, no installed Lightpanda runtime, no native MCP-to-Lightpanda command bridge, and no Codex browser-tool integration. Do not claim ready or prompt user to start localtest until these blockers are resolved.
- Next owner: establish verifiable native build and protocol compatibility, then scoped MCP browser operations with permission, cancellation and audit; run deterministic checks before reporting readiness.

## Opt-in CDP workspace adapter — 2026-11-10
- Added `src/browser/lightpanda-cdp-adapter.mjs` as an isolated, opt-in Playwright `connectOverCDP` adapter for numeric 127.0.0.1 endpoints, ten canonical workspace IDs, distinct browser contexts, local-origin route allowlist, bounded navigation/title snapshots and cleanup. It never launches Lightpanda, does not read ChatGPT Web and is not automatically wired into the MCP gateway.
- Added mocked deterministic contract tests and included them in `preflight:localtest`. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Lightpanda's support for Playwright context creation and CDP interoperability is NOT_VERIFIED. This is not a production-ready browser backend.
- Remaining critical path: install/compile dependencies, verify Lightpanda CDP interoperability, native host ownership and scoped MCP admission, Codex connection, cancellation/recovery, UI status, Windows build and end-to-end tests. User explicitly does not want localtest until preparation is complete.

## Lightpanda workspace operation serialization — 2026-11-10
- Corrected the opt-in CDP adapter to serialize operations within each of ten workspace slots. Concurrent open/close no longer race on context ownership. Navigation failures now dispose the failed workspace context and allow a clean retry. Adapter close waits for pending slot operations before releasing contexts and the CDP connection.
- Added deterministic open/close concurrency regression scenario. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; this adapter remains unconnected to native MCP authorization and no real Lightpanda/Windows execution has been observed. Next: scoped gateway admission and integration tests, then native build proof.

## Scoped Lightpanda gateway routing — 2026-11-10
- Added three opt-in gateway capabilities: `lightpanda.open`, `lightpanda.snapshot`, `lightpanda.close`, all requiring canonical workspace IDs and an injected native-host admission callback. Default MCP gateway constructs neither adapter nor admission callback, so all Lightpanda capabilities remain DISABLED in the shipped runtime.
- Injected adapter and native-admission callback can exercise the routing in deterministic mocks; forged renderer admission is denied. Added gateway regression script and preflight registration; updated catalog assertion.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is a safe integration seam, not a working native authorization bridge or connected Codex browser tool. Remaining: implement native-issued scoped authorization and revocation, bind gateway transport to native host, run tests and Windows compilation, verify real Lightpanda CDP and official Codex interface. No localtest readiness claim.

## Gateway Lightpanda concurrency gate — 2026-11-10
- Added fail-closed per-workspace in-flight admission guard to the opt-in Lightpanda capability router. A second overlapping call for the same workspace now returns `WORKSPACE_BUSY` instead of entering the adapter concurrently; gateway shutdown rejects subsequent calls with `GATEWAY_CLOSED`. Added deterministic contention and shutdown regression cases.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. The injected callback is a **test seam**, not a secure proof of native host origin; its `source` field can be forged by an untrusted caller if exposed incorrectly. The production MCP gateway still does not configure it. No claim of native authorization, live CDP operation or readiness for end-to-end localtest.

## Gateway shutdown drain correction — 2026-11-10
- Fixed the gateway close race: after rejecting new Lightpanda calls, close now awaits all already-admitted per-workspace operations before closing the browser adapter. Repeated close calls share one promise; cleanup runs once. Added regression coverage for in-flight snapshot vs close ordering.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This does not implement trusted native authorization or production Codex connectivity. Native Windows build, actual Lightpanda CDP compatibility and end-to-end runtime proof remain blockers before the user's requested localtest.

## Gateway late-admission shutdown race — 2026-11-10
- Fixed a time-of-check/time-of-use race: an asynchronous native-admission callback could return approval after gateway shutdown began, then start a Lightpanda browser. The router now rechecks shutdown state immediately after admission resolves, before adapter operations.
- Added deterministic regression case where shutdown races a delayed approval; no adapter start/open may occur. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Native authorization remains a non-production injection seam; no actual native trust binding, Codex integration or Windows build proof.

## CDP connection lifecycle — 2026-11-10
- Fixed a multi-workspace connection race: concurrent adapter `start()` calls now share one pending CDP connection, and close awaits pending connection establishment before releasing the browser. A late connection after shutdown is closed and rejected. Added deterministic coalescing regression.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This improves source lifecycle only; native authorization, actual Lightpanda compatibility, Codex connection, Rust/Windows compilation and end-to-end evidence remain unverified. Not ready for the user's localtest.

## CDP preview navigation boundary — 2026-11-10
- Narrowed the opt-in CDP adapter from any page on allowed localhost origin to the fixed `/browser-preview.html` path with no query/fragment; after navigation, reject unexpected final URL and dispose the context. This aligns with the Tauri embedded WebView local-preview boundary and avoids exposing other local application routes through the experimental MCP capability.
- Added negative tests for local `/admin` and preview query strings before context creation. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No live browser, native host authorization, official Codex connection or Windows compile proof; not localtest-ready.

## Native-only admission policy foundation — 2026-11-10
- Added Rust `lightpanda_admission.rs` as a native-only module compiled into the Tauri host, with explicit operator, transport, compliance, stop, workspace and local-preview URL gates. No Tauri command exposes an approval setter or policy flags to the renderer. Added Rust negative and positive contract tests.
- This is a policy function, **not** an authenticated IPC bridge, persistent native grant store, revocation channel or live gateway integration. There is no path currently providing verified native transport/operator approval to the MCP process; production Lightpanda tools remain disabled. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; no Rust build or Windows runtime evidence. Next: design and implement host-owned authenticated IPC with scoped, expiring, revocable grants before enabling browser capabilities.

## Native Lightpanda single-use grant store — 2026-11-10
- Added native-only `lightpanda_grants.rs` for in-memory, capability/workspace/URL-scoped, single-use grants with maximum 30-second TTL, bounded grant count, revocation and terminal stop clearing. Added Rust tests for replay, scope mismatch, expiry, revocation and denied native gates.
- No grant issuance or consumption is exposed through Tauri commands; no random grant ID generator or authenticated IPC channel is implemented. Caller-supplied IDs are a data-store key only, not secure bearer credentials. The store is not yet instantiated as runtime state, and does not confer real browser permission.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Next critical task is authenticated native-owned IPC and securely generated opaque grants with process binding, then actual integration and Windows compilation. Production MCP/Lightpanda remains disabled; do not initiate localtest yet.

## OS-backed native grant IDs — 2026-11-10
- Added `getrandom` 0.2 dependency and `LightpandaGrantStore::issue_secure`, producing 256-bit opaque grant IDs from the operating system's cryptographic random source; failure to obtain randomness fails closed. Added Rust uniqueness, length and single-use tests.
- This removes caller-selected IDs on the new issuance path, but the legacy `issue` method remains for internal contract tests. The grant store is not instantiated as Tauri state, and no authenticated IPC channel, process binding or production MCP grant verification exists. Do not treat generated IDs as an authenticated transport.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; no Cargo toolchain or Windows native runtime available here. Next proof must be actual Cargo compile/test and secure native IPC design/implementation, not further status-only changes. Not localtest-ready.

## Grant issuance API restriction and execution blocker — 2026-11-10
- Restricted `LightpandaGrantStore::issue` (caller-selected IDs) to a private method; external native modules can only call `issue_secure` for new grants. Existing in-module tests still cover the internal validation helper.
- Checked execution environment: Node.js v22.16.0 available, but Cargo is not installed and direct GitHub git transport fails DNS resolution. Connector read/write is available. No Rust or full-repository tests were run; this is SOURCE_COMMITTED, NOT_EXECUTED.
- Do not add another fake admission callback or claim native IPC complete. Next required work: obtain verifiable Cargo/Windows build evidence and implement a process-authenticated IPC channel with host-owned authorization; production Lightpanda tools stay disabled. User has explicitly withheld localtest until readiness.

## CDP context creation vs shutdown — 2026-11-10
- Fixed an asynchronous lifecycle race: if native CDP context creation, route installation or page creation finishes after shutdown begins, the adapter now refuses to publish the slot and disposes the new context. Added a synchronized regression test that deliberately pauses context creation while close starts.
- Purpose: prevent leaked browser contexts and unintended post-shutdown navigation under ten-workspace load; this is resource and safety hardening, not an increase in model calls.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Node exists, but the repository is only accessible through the GitHub connector in this session; direct raw GitHub DNS lookup fails, so the exact test suite was not executed. Rust/Cargo and Windows runtime are unavailable. No authenticated IPC, live Lightpanda integration or official Codex browser-tool transport has been demonstrated. Do not mark localtest-ready.

## CDP snapshot navigation integrity — 2026-11-10
- Fixed an origin-only check in `LightpandaCdpAdapter.snapshotInternal`: a workspace could navigate to another local path after initial opening, then snapshot its title/URL. Snapshot now enforces the fixed preview path and rejects/cleans up changed local navigation. Added a deterministic regression fixture.
- Purpose: prevent a permitted preview workspace from reading unrelated local application routes. SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Native IPC, real Lightpanda compatibility, Codex transport and Windows compilation remain blockers. No end-to-end localtest readiness claim.

## Authenticated native IPC implementation contract — 2026-11-10
- Locked the Windows host↔MCP authorization design in `docs/architecture/system-contract.md`: host-owned child process, restricted named pipe, verified child PID, per-run challenge-response, scoped one-use grants, replay/revocation, bounded framing, and ordered acceptance gates A–F. This resolves a design ambiguity: neither a renderer flag nor an injected `source:"NATIVE_HOST"` object is proof of native origin.
- SOURCE_COMMITTED (design only). No IPC code was installed, no process launched, no test executed and no runtime permission granted. The currently shipped MCP gateway remains fail-closed for Lightpanda. Next implementation unit is Gate A (host-owned child process lifecycle) with Windows build proof; do not enable tools or mark localtest-ready before the remaining gates.

## Gateway child lifecycle source foundation — 2026-11-10
- Added `apps/desktop/src-tauri/src/gateway_child.rs` and registered the Rust module. It owns a single child handle behind a mutex, refuses duplicate launches, exposes PID observation, and provides explicit stop/reap and Drop cleanup. Launch requires absolute existing Node executable and .mjs script paths supplied by a trusted native caller; no shell interpolation, renderer command or automatic startup. Added negative-path and idempotent-stop Rust tests.
- **Scope limitation:** this is a source-level Gate A foundation, not a completed Gate A. The packaged Node executable and script provenance are not verified here; the module is not wired to application lifecycle, and stdout/stderr handling, child liveness, process-tree cleanup, authenticated IPC and Windows runtime tests are outstanding. No gateway process was started.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Lightpanda capabilities remain disabled in the shipped MCP entrypoint. Next: package verification and Windows compilation, then implement and test host-owned process startup/shutdown and pipe authentication before enabling browser operations.

## Gateway process stop ownership correction — 2026-11-10
- Fixed a Gate A process-lifecycle defect: `GatewayChild::stop` previously removed the child handle before `try_wait`, `kill` and `wait`; if any failed, the host lost the handle and could not retry cleanup. The child handle now stays owned until the process has exited and been reaped.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is a narrow safety fix, not working process integration. Gate A still requires packaged executable provenance, stdio ownership (unread stdout pipes may block), native app lifecycle wiring, Windows process-tree termination and actual Cargo/Windows tests. Authenticated IPC and Codex transport are not implemented; no localtest readiness claim.

## Gateway MCP stdio ownership seam — 2026-11-10
- Added `GatewayChild::take_stdio` to atomically transfer child stdin/stdout once to a future dedicated MCP transport, rejecting absent/exited children and repeated transfer. Added a negative test for taking pipes before spawn.
- Purpose: avoid two readers/writers racing on the MCP protocol and provide an explicit owner for draining stdout. The consumer, bounded message framing, request correlation, timeouts, and Tauri lifecycle wiring are **not** implemented. Merely transferring pipes does not fix a blocked/unread stdout until a real consumer is attached.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No gateway process launched, no Cargo/Windows test, no authenticated native IPC and no Codex/Lightpanda runtime integration. Gate A remains incomplete; do not mark localtest-ready.

## Bounded MCP stdio framing codec — 2026-11-10
- Added `gateway_stdio.rs` as a native-only bounded newline-delimited JSON-RPC 2.0 codec (1 MiB max), strict envelope parsing, request/response ID matching helper, and deterministic unit tests. Registered module in Tauri native build. This codec is for MCP stdio, **not** the separate authenticated Windows named-pipe channel.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. The codec is not connected to the transferred child pipes; no asynchronous reader, request correlation table, read deadline, backpressure, process startup or authenticated IPC is implemented. Blocking reads must not be invoked on the Tauri UI thread. Rust/Windows compilation and runtime remain unverified. Gate A and end-to-end localtest readiness remain blocked.

## MCP single-flight correlation state — 2026-11-10
- Added a bounded single-flight `RequestTracker` to the native stdio codec: monotonic request IDs, reject overlapping requests, ignore notifications/unmatched responses, clear only on matching JSON-RPC result/error, and explicit cancellation. Added deterministic unit tests.
- Function: prevent a stale or unrelated gateway response from being mistaken for completion of a different request, without spawning extra agent work. This is only a policy helper, **not** an operational reader/writer loop; it has no I/O deadlines, worker thread or child-pipe wiring.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Rust/Windows compilation, native process startup, authenticated IPC and Codex/Lightpanda integration are not verified. The production gateway remains fail-closed. Do not mark localtest-ready.

## MCP request timeout state — 2026-11-10
- Extended the native `RequestTracker` with bounded monotonic deadlines (8-second default, 30-second maximum), explicit timeout detection and rejection of responses arriving after expiry; timeout clears the outstanding request so future IDs can progress. Added a deterministic short-deadline test.
- Purpose: prevent indefinite logical request ownership and stale completion after a deadline. **This is not an I/O timeout**: blocking `read_message` can still wait indefinitely until a worker/pipe cancellation mechanism is implemented. The runtime transport is not wired to this tracker.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Rust/Windows compilation, authenticated IPC, native lifecycle wiring, Codex and Lightpanda runtime integration remain unverified. Not localtest-ready.

## Expired request recovery — 2026-11-10
- Fixed a deadlock in the logical MCP single-flight tracker: after deadline expiry with no response at all, `begin` previously kept returning `MCP_REQUEST_BUSY` forever because expiration was only cleared by `accept`. New requests now reclaim an expired slot before assigning the next monotonic ID. Added a regression for recovery without any response.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This is a pure request-state fix; it does not interrupt a blocked OS pipe read or implement native I/O workers. No Cargo/Windows runtime evidence, authenticated IPC or Codex/Lightpanda operation. Not localtest-ready.

## Dedicated bounded MCP stdout reader — 2026-11-10
- Added `gateway_reader.rs`: a dedicated background thread parses bounded JSON-RPC messages from an owned stdout reader and forwards them through a capacity-16 synchronous channel. Consumers can wait for parsed results with a bounded timeout without blocking the Tauri UI thread. Added in-memory reader/EOF/timeout tests and registered the module.
- **Critical limits:** `recv` timeout does not cancel a blocked OS pipe read; owner must stop/reap the child (closing stdout) before calling `join_after_child_stop`. The worker is not yet wired to `GatewayChild::take_stdio`; no request writer, cancellation protocol, process-tree termination, native IPC authentication or Codex transport is operational. A full queue can block the worker until the receiver drains or drops.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Rust/Windows compilation and actual gateway process lifecycle unverified. Do not mark Gate A complete or localtest-ready.

## Bounded reader shutdown deadlock fix — 2026-11-10
- Fixed `GatewayReader::join_after_child_stop`: the bounded producer could block forever on `sync_channel::send` when the 16-message queue filled and the consumer joined without draining. Shutdown now drops the receiver before joining the worker, unblocking the producer. Added a regression fixture with more frames than queue capacity.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. This fixes only the full-queue shutdown path after the child has already stopped and its stdout is closed. A live blocked OS pipe read still requires child termination; actual process wiring, Rust/Windows tests, authenticated IPC and Codex/Lightpanda integration remain outstanding. No localtest-ready claim.

## P0 gateway integration pass — 2026-11-10
- Added native-only `gateway_session.rs`, registered from `main.rs`. It composes existing `GatewayChild`, `take_stdio`, `GatewayReader`, `write_message` and `RequestTracker` into one host-owned lifecycle with single-flight JSON-RPC request/response, bounded logical deadlines, cleanup on failed start, stop and prior-exited-session restart.
- The session is intentionally NOT exposed as a Tauri renderer command; method allowlist is limited to `initialize`, `ping` and `tools/list`. This does not authorize browser actions or connect Codex/Lightpanda. No automatic startup; packaged Node/script provenance and host startup ownership still need implementation.
- SOURCE_COMMITTED / NOT_EXECUTED. Per operator instruction, do not dispatch GitHub tests or localtest during integration work. No Rust/Windows compilation proof. Remaining P0: trusted launch provenance and app lifecycle, robust I/O cancellation/timeout on OS pipe, authenticated native IPC, scoped grants, Lightpanda runtime binding and official Codex transport. No claim of functional end-to-end integration.

## Tauri-owned gateway session state — 2026-11-10
- Registered `GatewaySession::default()` as a native Tauri managed state in `main.rs`. This gives the application one shared native owner for the previously composed child/stdio/reader/request lifecycle; it remains inaccessible as a renderer command. The state has Drop cleanup, but there is still no trusted packaged executable resolver or automatic gateway startup.
- SOURCE_COMMITTED / NOT_EXECUTED. Per operator instruction, no Local Test or GitHub tests. App exit cleanup, Windows process-tree handling, blocking OS pipe cancellation, native IPC authentication, Lightpanda binding and Codex integration are not yet verified. Next engineering unit should connect a verified packaged gateway launcher to this state, not create parallel session owners.

## Tauri exit lifecycle wiring — 2026-11-10
- Changed the Tauri builder to use an explicit application event callback and call the single native-owned `GatewaySession::stop()` on `RunEvent::Exit`. The existing session stop sequence closes stdin, stops/reaps the child, then joins the reader. No renderer command was added and no gateway is launched automatically.
- SOURCE_COMMITTED / NOT_EXECUTED. Operator has suspended Local Test and GitHub tests until P0 integration is complete. This source change has no Rust/Windows compilation proof. Stop is synchronous on exit; production readiness still needs process-tree handling, OS-level blocked I/O cancellation, packaged executable/script provenance, authenticated native IPC, Lightpanda and Codex integration. Keep browser capabilities disabled.

## Native gateway startup resource gate — 2026-11-10
- Connected the single native `GatewaySession` to Tauri `setup`: the host looks only for `gateway/node.exe` (Windows) or `gateway/node` and `gateway/mcp-gateway.mjs` under Tauri's application resource directory, then attempts native session startup. It does not accept renderer-provided paths or search PATH. On absent resources it does nothing; on launch error it remains fail-closed. Exit cleanup is already wired.
- **Not complete:** `tauri.conf.json` still has `bundle.active=false`, and the expected resource files are not packaged. Presence checks alone are NOT cryptographic provenance, symlink protection, or signed binary verification. The current gateway script also imports adjacent modules and cannot work as a standalone copied `.mjs` without packaging dependencies. No authenticated IPC or Codex/Lightpanda connection is enabled.
- SOURCE_COMMITTED / NOT_EXECUTED. Operator requested no Local Test or GitHub test during P0 integration. Next: produce a reproducible bundled gateway distribution with dependency closure, verified executable provenance and native lifecycle failure reporting; then finish native IPC. Do not claim startup actually works or localtest readiness.

## Gateway resource staging source — 2026-11-10
- Added `scripts/stage-gateway-resources.mjs` to stage the gateway's recursively discovered static relative ESM imports under the Tauri resource directory and copy a caller-supplied Node executable only after exact SHA-256 verification. It writes an entry shim and a manifest; rejects out-of-repository paths, bare imports, unknown dynamic imports and mismatched Node hashes. It never downloads binaries.
- SOURCE_COMMITTED / NOT_EXECUTED, per user instruction no Local Test or GitHub test. This is staging source, not a complete bundle: the import scanner is intentionally conservative and may reject unsupported syntax; dynamic `playwright` imports and external packages need an explicit audited distribution decision. The generated manifest is informational, not a runtime signature; no runtime hash verification yet. `bundle.active=false` remains unchanged, Tauri resource registration is not enabled, and no binary has been staged. Next integrate resource packaging and host verification only after dependency provenance is resolved. IPC/Codex/Lightpanda remain disabled.

## Gateway staging overwrite guard — 2026-11-10
- Corrected `stage-gateway-resources.mjs` to reject an existing staged gateway directory instead of recursively deleting it. This prevents accidental destruction of a prior package during repeated staging. No tests or workflow runs were initiated per operator instruction.
- SOURCE_COMMITTED / NOT_EXECUTED. The script still needs transactional staging (partial output on write failure), complete dependency closure and release provenance before enabling bundle resources. No executable was staged or gateway launched; IPC, Codex and Lightpanda remain unintegrated.

## Transactional gateway resource staging — 2026-11-10
- Updated `scripts/stage-gateway-resources.mjs` to write all gateway files to a unique sibling staging directory, publish by rename only after successful writes, and clean up its own temporary directory on failure. Existing published target remains protected from overwrite.
- SOURCE_COMMITTED / NOT_EXECUTED. No Local Test or GitHub tests by operator instruction. Resource closure and Node provenance are still not sufficient for a working bundle: Tauri resource declaration, runtime signature/hash verification, external package decisions and Windows packaging are pending. Native IPC, Codex and Lightpanda remain unintegrated.

## Gateway staging manifest integrity — 2026-11-10
- Corrected the staged gateway entrypoint's newline escaping and upgraded the staging manifest to record SHA-256 for every collected ESM source and the entry shim, alongside the pinned Node executable digest. This creates the material needed for a future native runtime integrity gate rather than merely listing file names.
- SOURCE_COMMITTED / NOT_EXECUTED. Per user instruction no Local Test or GitHub test. Manifest hashes are not signatures, and no trusted native verifier currently checks them; do not interpret this as authenticated packaging. Resource declaration, full dependency closure, Node provenance, native IPC and Codex/Lightpanda binding remain outstanding.

## Native gateway integrity gate — 2026-11-10
- Added `gateway_integrity.rs` and `sha2` dependency. Tauri startup now requires a staged `manifest.json` with SHA-256 digests for Node and every declared ESM file; rejects invalid/missing/oversized manifest, unsafe relative paths, canonical paths escaping the resource root, and hash mismatches. If verification fails, gateway is not started.
- SOURCE_COMMITTED / NOT_EXECUTED. No Local Test or GitHub tests per operator instruction. **Security limitation:** manifest and files are co-located; an attacker able to edit both can replace hashes. This is accidental-corruption detection, not signed package provenance. Runtime check/read and subsequent process spawn are not atomic (TOCTOU); Windows signing/immutable packaging is still required. External ESM dependency closure, resource bundle declaration, authenticated IPC, Codex and Lightpanda integration remain P0 blockers.

## Native IPC bounded framing foundation — 2026-11-10
- Added and registered `native_ipc_frame.rs`: distinct from MCP stdio, uses a version byte plus big-endian u32 length, enforces 16 KiB before allocation, rejects invalid JSON and non-object envelopes. Includes authored in-memory unit tests.
- SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. No Local Test or GitHub test per operator instruction. **This is only a codec**: no Windows named pipe, ACL, PID binding, challenge-response/HMAC, replay defense, transport deadlines, host-grant binding or gateway client. Never use the codec as proof of authentication or enable Lightpanda browser tools. Next work must implement the actual authenticated host/child channel rather than additional standalone framing helpers.

## Windows named pipe transport foundation — 2026-11-10
- Added Windows-only `native_ipc_pipe.rs` and scoped Tokio net dependency. The native listener uses `ServerOptions` to create a first-instance, local-only Windows named pipe with a strict `\\\\.\\pipe\\lazyprompting-<hex>` naming convention; async connect must run outside UI thread. Registered the module without starting a listener or exposing a renderer command.
- SOURCE_COMMITTED / NOT_EXECUTED. No Local Test or GitHub tests per operator instruction. **This is not authenticated IPC:** default Windows pipe ACL is not a verified user/session ACL; no connected-client PID verification, CSPRNG name generation, HMAC challenge, replay defense, deadlines, host-owned grant issuance or Node gateway client exists. Do not start listener or enable browser actions until all are wired. Rust/Windows compilation is unverified.

## Host-side HMAC IPC challenge primitive — 2026-11-10
- Added `native_ipc_auth.rs` and `hmac` dependency: CSPRNG host nonce, PID/session-bound direction-separated HMAC-SHA256, 10-second challenge expiry, one-use child verification, constant-time proof check and host proof gated on successful authentication. Registered native-only module, not a renderer command.
- SOURCE_COMMITTED / NOT_EXECUTED. Per user instruction no Local Test or GitHub tests. **This is not an authenticated live pipe:** host secret delivery, verified Windows pipe client PID, restricted ACL, live framing/handshake, replay/session ownership and grant wiring are missing. Challenge must never be issued to an unverified process; do not enable browser operations. No compilation proof.

## FINAL HANDOFF TO LOCAL TEST — 2026-11-10
- User explicitly ended ChatGPT-side development and will take branch `Local` to local testing. STOP further source iterations until new instruction.
- Final source cleanup: removed incomplete gateway auto-launch from Tauri startup. The native `GatewaySession` remains managed with shutdown cleanup; gateway integrity and IPC modules remain in source, but **no gateway, browser automation or Codex integration is enabled**. Corrected generated gateway entrypoint newline escaping in staging script.
- **Evidence:** SOURCE_COMMITTED; NOT_EXECUTED. Per user instruction, no Local Test, GitHub Actions, Rust compilation or native runtime tests were run here. Do not claim readiness or operational integration.
- **Local handoff priority:** (1) Windows Cargo compilation and Svelte build, (2) correct packaging/resource dependency closure and trusted Node distribution, (3) complete Windows pipe ACL/client PID/secret delivery/HMAC handshake and grant lifecycle, (4) wire official Codex MCP transport to authorized Lightpanda CDP, (5) verify 10-workspace behavior. Gate browser actions fail-closed until authentication and permissions are proven.
- **Known source risks:** Tauri source may have compile errors; `gateway_session` blocked I/O cancellation/process-tree cleanup incomplete; staging ESM import scanner may miss dependencies or reject external packages; manifest is not a signature; no installed Lightpanda compatibility proof. No changes to UI/UX or other branches.

## Goal and GitHub README alignment — 2026-11-10
- Rewrote root `README.md` to clearly present the Codex-only primary goal, deterministic continuation loop, Tauri/WebView2 versus Lightpanda boundaries, MCP/native authorization architecture, actual source/runtime readiness, and honest local handoff checklist.
- Reconciled `CONTEXT.md` as the stable project mission and locked choices, removing obsolete model-fallback expectations. The active checkpoint remains **this file**; earlier historical status sections above are retained as history and do not supersede the final handoff.
- SOURCE_COMMITTED / NOT_EXECUTED. Documentation-only changes. No Local Test, GitHub Actions, release, branch merge or UI changes. ChatGPT-side development remains stopped until explicitly reopened.

## Windows checkout and managed Codex transport

- Reopened local development from `Local` at `21f3f33`. The Windows desktop baseline builds after fixing the Svelte diagnostics and supplying the Windows icon from the existing project SVG. The npm and Cargo lockfiles pin the dependencies used for this baseline.
- EXECUTED_TEST_PASS on Windows x64 with Node 24 and Rust MSVC. `npm run preflight:localtest` completed, including the Svelte build and 24 Rust tests. The supervisor and checkpoint runners passed 30 and 22 cases respectively. The desktop scheduler and adaptive planner runners passed after fixing source and test-contract errors.
- A debug NSIS x64 installer installed into a temporary directory under the current Windows user. The installed executable opened a responsive LazyPrompting window and the uninstaller exited successfully. From `apps/desktop`, rebuild the baseline installer with `npm run build:app -- --debug --bundles nsis --config '{"bundle":{"active":true,"icon":["icons/icon.ico"]}}'`.
- LIVE_INTEGRATION_VERIFIED for the standalone stdio transport. With Codex CLI `0.167.0-alpha.3.2` signed in, `node tests/live-codex-app-server.mjs <absolute-codex-executable>` completed one read-only turn and resumed the same thread after restarting App Server. Desktop session binding, durable dispatch and supervisor-driven continuation remain outstanding.
- EXECUTED_TEST_FAIL in the expanded Windows suite. Directory `fsync` returns `EPERM` in the outbox, scheduler cursor, evaluation queue, progress review, workspace registry and replay ledger. This also prevents dependent recovery scenarios from passing. Keep authorization and recovery fail-closed while resolving Windows persistence semantics.
- Next: fix Windows persistence and prove reserve → dispatch → observe → reconcile with an authorized disposable workspace. Gateway packaging, authenticated named-pipe wiring, live Lightpanda and ten-workspace acceptance remain open. The debug installer contains the desktop baseline.

### Windows persistence repair

- Windows accepts file sync and replacement but rejected directory sync with `EPERM`. State publishers now flush the temporary file and use Win32 write-through replacement on Windows. Existing JSON files and lock semantics are preserved. The current Windows implementation uses system PowerShell as the Win32 bridge.
- All 71 deterministic Node runners returned exit code zero on Windows, including the ten-workspace outbox fixture. The outbox test also reopened a persisted reservation from a path with spaces and Unicode and confirmed that another reservation was refused. Physical power-loss behavior and live ten-workspace dispatch remain unverified.
- Next: bind the managed Codex transport to a persisted workspace and verify a single authorized reserve → dispatch → observe → reconcile loop across a process restart.

### Managed Codex receipt recovery

- The managed workspace now uses the persisted workspace registry for thread and task binding, the trusted prompt policy for admission and budgets, and the durable outbox for reservation and turn receipts. Managed dispatch refuses a previously reserved task ID even after its response has been verified.
- The live App Server smoke test exercises a read-only workspace through reservation, dispatch, process restart, exact turn and item lookup, reconciliation, and rejection of a duplicate dispatch. A second real turn simulates loss of its acknowledgment before persistence and remains held after restart. Codex history is used to read an acknowledged turn, never to guess the identity of an unacknowledged reservation.
- The managed workspace is still exercised from the opt-in test harness. Next: wire this path into the desktop runtime and compose the supervisor follow-up from verified evidence.

### Packaged Windows MCP gateway

- Stage the official Windows x64 Node 24.14.1 binary with `node scripts/stage-gateway-resources.mjs <absolute-node-executable>`. Staging checks the executable against the Node release checksum, captures the gateway's local modules, and omits the optional Playwright backend. The native child starts with a cleared environment. The desktop build embeds the staged manifest digest and verifies resource contents before starting Node.
- From `apps/desktop`, build the debug installer with `npm run build:app -- --debug --config src-tauri/tauri.gateway.conf.json`. On Windows, open Connections to run the native MCP probe. Cargo can also exercise the staged gateway with `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml packaged_gateway_initializes_and_stops -- --ignored` from the repo root.
- LIVE_INTEGRATION_VERIFIED for the installed desktop's read-only MCP discovery. A fresh temporary installation showed MCP Gateway Ready after `initialize` and `tools/list`. Process inspection found the packaged Node executable as a desktop child. Closing the window stopped that PID and the QA installation was uninstalled. The initial failure reproduced as `MCP_EOF` with Tauri's verbatim Windows path and passed after normalizing the Node entrypoint argument.
- The gateway probe exposes discovery only. Native authorization over the named pipe, scoped Lightpanda tool execution, Node redistribution notices, the installed Codex loop and live ten-workspace isolation remain open.

### Authenticated Windows gateway channel

- The verified packaged gateway now authenticates before the native host negotiates MCP. The host creates one unpredictable local pipe restricted to its logon SID, matches the kernel-reported client PID against the retained gateway child, and sends the per-launch secret over the private bootstrap frame on child stdin. The pipe then performs a deadline-bounded mutual HMAC challenge. The authenticated pipe remains attached to that gateway session and is closed on stop.
- The staged Windows integration test started the real packaged Node process and completed authentication, MCP discovery, repeated probing with the same PID and shutdown. Native tests rejected a mismatched PID before challenge, an invalid proof for a matching PID, replay across challenges and oversized frames. Windows preflight passed with 27 native tests. The staged integration test was run separately.
- Next: connect authenticated capability requests to native one-use grants and a host-verified Lightpanda process. No browser grant is issued by the handshake.

### Native grant exchange and private Lightpanda relay

- The named pipe now returns an authenticated session that owns its grant store. Grant consumption checks the host's expected grant ID, operation, workspace, URL and expiry. A mismatched or malformed request retires the pending grant. The live Windows pipe test passed correct-scope consumption and denial of replay or cross-workspace use.
- A private WSL2 network namespace now hosts the checksum-pinned Lightpanda 1.0.3 binary and the local preview. The relay seals the verified binary bytes before launch and carries CDP over inherited stdio. The desktop host therefore connects to its own child instead of an arbitrary Windows loopback service. A real Windows/WSL2 test created a context, navigated to the fixed preview, read its title and disposed the context.
- All 30 Rust tests, including the staged MCP and private WSL2 integration tests, passed with the pinned Lightpanda fixture. Run them with `LAZY_LIGHTPANDA_TEST_BINARY` pointing to the release binary in Ubuntu. The release is `lightpanda-io/browser` tag `1.0.3`, asset `lightpanda-x86_64-linux`.
- Lightpanda 1.0.3 returned a CDP error when a second context was created on the same WebSocket. Next: allocate a separate CDP connection per workspace in the private relay, connect the grant exchange and scoped preview operations to MCP, and wire managed Codex into the installed desktop.

### Scoped Lightpanda tools through MCP

- One verified WSL2 Lightpanda process now accepts ten separate CDP connections over framed private stdio. Each workspace owns its connection and context. Native browser operations are limited to opening the fixed preview, returning its URL and bounded title, or closing that workspace.
- Host-originated MCP calls carry a one-use grant in private metadata. The packaged gateway returns it with the exact operation scope over the authenticated pipe. Rust checks and consumes the grant before invoking the private browser and returns the scoped result through MCP. A standalone gateway still leaves the backend disabled.
- The live Windows integration test opened ten workspaces through MCP, wrote a unique localStorage marker in each same-origin context, closed one and verified the other nine markers before closing them. It also rejected an unapproved open, a non-preview URL, and a snapshot after closure. This exercised staged gateway resources and actual Lightpanda, outside the installed UI.
- Next: connect the native capability invocation to operator controls and managed Codex, then verify the combined path from the installed application, including stop and recovery.

### Installed Lightpanda controls

- The Windows desktop exposes open, read and close controls for the selected workspace. A native Yes/No dialog defaults to No and grants only the named operation for that workspace. Renderer IPC accepts an operation and workspace ID. The host selects the fixed preview URL, resolves the operator-configured WSL binary and owns the gateway and private browser lifecycle.
- The rebuilt x64 debug installer opened successfully. Installed UI QA confirmed the three controls and the missing-binary refusal. The positive operation path was verified through the 30-test native suite with real WSL2 Lightpanda and the packaged MCP gateway. The installed native approval dialog was not accepted during automated UI QA.
- Next: connect installed managed Codex dispatch, evidence-based follow-up, restart recovery and the scoped browser tool bridge. See the desktop README for installation and Lightpanda setup.

### Managed Codex desktop dispatch

- The Windows desktop now has per-workspace controls for individually approved read-only dispatch, result recovery and stopping. Native confirmation shows the selected workspace, canonical local directory and exact task. The verified gateway accepts the private Codex control method only after native bootstrap and starts the pinned CLI with the operator's sign-in. A Windows job object owns the gateway process tree.
- The packaged gateway integration exercised a real Codex turn, waited for the exact stored turn to complete, restarted the gateway, refused a duplicate while the outbox was pending, and recovered the same receipt and result. After another restart it also recovered the already reconciled response. All 31 native tests passed, including the real ten-workspace Lightpanda test. Standalone MCP refuses the private Codex RPC.
- The debug NSIS installer was installed and opened on Windows. UI QA confirmed the Managed Codex controls and the missing-executable refusal. The real dispatch and restart test passed again against the gateway files from that installation. Dispatch approval was exercised through the trusted native harness, without accepting the dialog in automated UI QA. All 71 deterministic Node runners returned zero.
- Next: wire evidence-based supervisor follow-up and the per-turn Codex-to-MCP browser bridge. This increment enables operator-directed turns and result recovery.
