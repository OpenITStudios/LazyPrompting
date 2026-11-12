# Universal Agent Orchestrator — provider-independent design v1

**Status:** Architecture remains proposed; the provider-neutral v2 controller and Codex/OpenCode read-only adapters are now implemented **as host-injected source only**, not as an accepted installed worker. See [source runtime evidence](../validation/universal-agent-source-runtime-2026-11-12.md).  
**Source authority:** OpenITStudios/LazyPrompting, branch `Local`, pinned baseline `f6b4df15a5e6c4f5fb1a2f33e2cfcaeac6470e8e` (12 November 2026).  
**Owner:** `docs/architecture/` for future contracts; `mcp/ARCHITECTURE.md` remains the current surface/trust map; `docs/operations/current-state.md` remains the only live next-step owner.

## Source Gate 1 — contract foundation (12 November 2026)

The `src/agent/` source-only modules now define an immutable adapter manifest and capabilities, host-attested registration, exact task/turn receipt binding, monotonic event validation and an independent v2 scope fingerprint. The existing `src/transport/goal-run-scope.mjs` v1 function and native Codex dispatch path are **unchanged**. The new registry is not wired to MCP or `goal_run.start`; a callback supplied by a real trusted native host, a persistent receipt ledger, an OS sandbox and provider adapters are still required. `AgentEventCursor` is intentionally process-local, and its terminal observation never grants QA/DONE or further dispatch.

Evidence and limits: [Universal Agent contract source gate](../validation/universal-agent-contract-2026-11-12.md). The 21 focused Node subtests PASS on an isolated exact-source copy; Windows/Cargo, installed OpenCode and live host attestation remain **NOT_EXECUTED**. These modules cannot be activated by sending a `workerProfileId` through an existing MCP tool.

## 1. Product objective and strict boundaries

Build one LazyPrompting control plane whose **MCP clients**, **agent workers**, **browser providers** and **OS-native hosts** can vary independently. Preserve existing official Codex App Server functionality and four public MCP tools. A Codex client must be able to supervise an OpenCode worker, an OpenCode client must be able to supervise a Codex worker, and later adapters may support Gemini CLI / Claude Agent SDK / ACP-compatible agents with verified feature parity.

"Universal" means a common orchestration contract and explicit capability negotiation; it **does not** mean all providers have the same features, one model login authenticates another provider, an arbitrary desktop IDE exposes a supported worker API, that a source-only implementation works on all operating systems, or that consumer ChatGPT Web can be automated.

Existing prohibitions stand: no unattended consumer ChatGPT Web scraping/send, no implicit cross-repository write, no automatic merge/push/release/CI dispatch, no unapproved third-party extension installation, and no model-generated authorization.

Three independent axes:

1. **Client:** an MCP-capable app (Codex, OpenCode, Claude Code, Cursor, VS Code, Zed, MCP Inspector), with a verified connection to LazyPrompting's host. A client is not necessarily a worker.
2. **Worker:** a supported runtime that can actually execute tasks and return authenticated host-observed progress/turns (Codex App Server; proposed OpenCode V2; later Gemini CLI, Claude Agent SDK; ACP-compatible runtime by explicit probe).
3. **Execution host + browser:** OS-bound native consent, process authentication, scoped worktrees, verifier and browser provider (Windows WebView2 and separate Lightpanda today; alternative native host/browser providers later).

**Standards are complementary:** MCP = client-to-tools. ACP = editor/client-to-coding-agent session protocol. A2A = agent-to-agent interoperability for remote/delegated agents. Do not label an MCP client as an ACP/A2A worker without a supported protocol adapter.

## 2. Current dedicated-to-Codex inventory and destination

| Current owner (exact source path) | Codex binding / debt | Universal destination | Priority |
| --- | --- | --- | --- |
| `apps/desktop/src-tauri/src/codex_controls.rs` | Native `managed_codex`, UI approval text, preview tool routing | `agent_controls` host approval + Codex-specific preview adapter; keep old command as a compatibility facade | P2 |
| `apps/desktop/src-tauri/src/goal_runs.rs` | `LAZYPROMPTING_CODEX_EXE`, "Start Codex goal", `request_codex`, Codex turn receipts | Native `GoalRunAuthority` selects host-approved worker profile, versioned scope and normalized receipts | P1 |
| `apps/desktop/src-tauri/src/gateway_session.rs` | Private `request_codex` / `lazyprompting/codex` | Authenticated `request_agent` / versioned `lazyprompting/agent`, with old Codex route preserved during migration | P2 |
| `apps/desktop/src-tauri/src/mcp_stdio_host.rs` | Capability description still says Codex turn | Keep 4 public MCP names and existing `goal_run.*`, extend exact schema carefully with `workerProfileId` + `schemaVersion` | P1 |
| `src/gateway/mcp-gateway.mjs` | Hard-coded `createDesktopCodexRuntime`, `runReadOnlyGoal`, `codex` session variable | Native-only `AgentRuntimeRouter` + fair bounded goal admission + per-worker lifecycle | P2 |
| `src/transport/desktop-codex-runtime.mjs` | Exact Codex version, thread/turn protocol, managed workspace | Preserve as `CodexBackend`; move shared scheduling and state to `src/agent/` | P2 |
| `src/transport/goal-codex-runner.mjs` | `CodexAppServer`, Codex turn status/event mapping and retry policy | `GoalRunner` calls `AgentBackend`; Codex protocol contained in `CodexAdapter` | P2 |
| `src/transport/codex-app-server.mjs` | JSON-RPC App Server dialect, vendor error identifiers | **Remain Codex-only** behind adapter. Do not rename or force other agents into its wire format | P2 |
| `src/transport/codex-terminal-events.mjs` | `turn/completed`, `threadId`, `turnId` | Codex event parser feeding `NormalizedAgentEvent`; retain exact provenance | P2 |
| `src/transport/managed-codex-workspace.mjs` | Codex turn reserve, observe, interrupt and receipt checks | `ManagedAgentSession` generic host/outbox state; Codex result mapping stays adapter-local | P2 |
| `src/transport/codex-preview-tools.mjs` | Codex-specific dynamic tool callbacks and tokens | Generic `ToolGrantBroker`; Codex bridge remains specialized | P3 |
| `src/transport/goal-worktrees.mjs` | `server.runCommand`, Codex sandboxPolicy, Windows PowerShell check | Host-owned `WorktreeAuthority` + `IsolationVerifier` + `TrustedCommandRunner`; worker adapter never grades its own QA | **P0** |
| `src/transport/goal-run-scope.mjs` | v1 digest includes Codex executable but no provider manifest | v2 immutable digest includes worker ID, adapter version, approved executable digest, sandbox/permission policy, scope + limits | **P0** |
| `src/transport/managed-agent-backend.mjs` | Generic lifecycle seam exists but only dispatch/observe, not full runner | Keep `BackendLifecycle`; implement full versioned `AgentBackend` interface around it | P1 |
| `src/transport/official-agent-adapter.mjs` | Repository/branch hard-coded to this project's `Local` | Host-derived approved repository+branch binding; **do not** relax present user-selected Local write authority | P2 |
| `src/prompt/structured-worker-feedback.mjs` | Provider allowlist `CODEX_APP_SERVER` / generic callback | Versioned provider registry; attested adapter identity and normalized events, not arbitrary provider strings | P1 |
| `src/prompt/trusted-goal-review.mjs` / `verified-goal-runtime.mjs` | Host-injected compositional pipeline (not a live deployed worker provider) | Retain canonical evidence/QA boundaries; use verified generic worker receipts | P2 |
| `apps/desktop/src/App.svelte`, `apps/desktop/README.md` | "Codex browser access", single-provider setup/help | Neutral Agent / MCP / Worker status with per-provider readiness and unambiguous badge | P3 |
| `tests/goal-run-*.test.mjs`, `tests/run-codex-*.mjs`, native ignored Cargo tests | Codex fixtures and version-specific expectations | Keep all Codex regressions; add per-adapter conformance fixtures and native cross-client multi-worker gates | P1 |

Additional installed Windows source (`browser_mcp_pipe.rs`, `mcp_workspace_leases.rs`, `active-goal-registry.mjs`) recently gained concurrency/ownership logic, but is **NOT Windows-build verified** at this baseline. No adapter project may treat those source commits as production approval. At present there is a single shared WebView2 browser login profile: distinct tab control leases do not isolate credentials/cookies.

## 3. Proposed boundaries / dependencies

```text
MCP Client(s) -> stable Rust desktop MCP facade -> Native Host Auth/Consent
                                            |
                versioned AgentRun API (host-owned, private)
                                            v
    +------------------- LazyPrompting Core --------------------+
    | GoalAuthority | FairScheduler | ScopeRegistry | Outbox    |
    | Checkpoint/Replay | VerifiedEvidence | QA | STOP/PAUSE   |
    +-------------------------+--------------------------------+
                              |
                  AgentBackendRegistry (versioned)
                  /            |              \
        CodexAppServer    OpenCode V2        future official
         Adapter           Adapter           worker adapters
           \                 |                    /
        WorkerProcess/Session + provider-specific event mapper
                              |
               Native sandbox + WorktreeAuthority +
               independently executed approved QA commands
```

Keep `src/transport/codex-*.mjs` vendor-specific, not as universal base classes. Extract only provider-neutral behavior out of `goal-codex-runner.mjs` and `managed-codex-workspace.mjs` into `src/agent/`; preserve the existing `src/prompt/`, `src/supervisor/`, `src/runtime/`, `src/governance/` owners. Do not create a second checkpoint/outbox/permission store.

### 3.1 Provider capability discovery (not parity fiction)

Every adapter returns a signed/host-verified **local provider manifest** with `adapterId`, `adapterContractVersion`, `runtimeVersion`, installed binary identity/hash, auth/readiness, platform and machine-scoped capabilities. Examples:

- `startSession`, `resumeSession`, `submitTurn`, `observeTurn`, `cancelTurn`
- Optional: `streamEvents`, `toolPermissionCallback`, `verifiedResume`, `readOnlyIsolation`, `workspaceWriteIsolation`, `trustedToolExecution`, `tokenUsage`, `contextCompaction`, `forkSession`.
- A feature is `SUPPORTED_VERIFIED`, `SUPPORTED_UNVERIFIED`, `UNSUPPORTED` or `UNKNOWN`, separately scoped to source/unit/native/integration proof.
- Missing capability causes `UNSUPPORTED_CAPABILITY` or `HUMAN_ACTION_REQUIRED`, never simulated success or a silent relaxation of policy.

**Pilot backend order:** Codex App Server (compatibility), OpenCode V2 CLI JSON-event read-only pilot, OpenCode SDK/embedded host only after package/runtime compatibility is proven, then workspace-write. Gemini CLI headless JSON/stream-json and Claude Agent SDK are potential additional backends, subject to real API/permission/cancel/resume tests. Cursor/VS Code/Zed are **clients only** unless they expose a separately verified headless agent interface.

ACP may offer an alternate runtime protocol where the actual agent supports a stable, tested version. A2A may be added for **remote agents only** after authenticated HTTP+task semantics are implemented. Both are optional adapters, not a replacement for the internal goal/outbox contract.

## 4. Proposed versioned `AgentBackend` contract

This is **illustrative TypeScript**, not an implemented module. Every method is invoked by trusted orchestration/host code, never directly with unvalidated model input.

```ts
type AdapterId = "codex-app-server" | "opencode-v2" |
                 "gemini-cli" | "claude-agent-sdk" | string;
type Receipt = {
  goalId: string; taskId: string; dispatchId: string;
  adapterId: AdapterId; sessionId: string; turnId: string;
  hostProcessIdentity: string; sourceSha: string;
  scopeHash: string; eventCursor?: string;
};
type TurnResult =
  | {state: "RUNNING"; receipt: Receipt}
  | {state: "COMPLETED"; receipt: Receipt; resultRef: string}
  | {state: "CANCELLED"; receipt: Receipt}
  | {state: "FAILED"; receipt: Receipt; reason: string}
  | {state: "UNKNOWN"; receipt?: Partial<Receipt>; reason: string};
interface AgentBackend {
  probe(): Promise<CapabilityManifest>;
  openSession(scope: HostApprovedScope): Promise<{sessionId: string}>;
  resumeSession(binding: VerifiedSessionBinding): Promise<{sessionId: string}>;
  submitTurn(request: HostAdmittedTurn): Promise<Receipt>; // no auto retry
  observeTurn(receipt: Receipt): Promise<TurnResult>;
  cancelTurn(receipt: Receipt): Promise<"CONFIRMED" | "UNKNOWN">;
  close(): Promise<void>;
}
```

A response or event from a model is never a `Receipt` by itself. Host confirms the exact owned process/transport identity, adapter version, session/task/turn correlation and approved scope. Provider-specific correlation IDs remain opaque, never recast as global goal IDs. `submitTurn` must reserve/persist a `dispatchId` **before** calling provider. If submission times out without a guaranteed provider acknowledgment, return `UNKNOWN` and **reconcile**, never blindly call `submitTurn` again.

### 4.1 Normalized event envelope (v1 design)

Required: `eventVersion=1`, host-issued `goalId`/`taskId`/`dispatchId`, `adapterId`, `sessionId`, `turnId` if known, process-generation ID, monotonic per-session cursor/sequence if provided, received-at time, provider event type, normalized state, source provenance and payload digest. Bounded redacted content only; do not persist raw credentials/transcripts.

Suggested stable normalized states: `SESSION_READY`, `TURN_ACCEPTED`, `TURN_RUNNING`, `TOOL_APPROVAL_REQUIRED`, `TURN_COMPLETED`, `TURN_FAILED`, `TURN_CANCELLED`, `OUTCOME_UNKNOWN`, `WORKER_DISCONNECTED`. A stream disconnect is **not** `TURN_COMPLETED`; absent terminal events lead to `RECONCILE_REQUIRED`.

Final report provenance tiers: `MODEL_CLAIM` < `PROVIDER_RESPONSE_OBSERVED` < `HOST_ATTESTED_RESULT` < `INDEPENDENT_QA_VERIFIED`. Only the last tier plus locked acceptance checks can produce `DONE`.

### 4.2 Compatibility and scope v1 -> v2

Preserve current four public MCP tools unchanged and default browser capability names. Keep `goal_run.start/status/report/control/turn_receipt` names; avoid duplicate public APIs solely to rename Codex. `goal_run.start` v1 (no schemaVersion) remains strictly **Codex-only** during migration. It must not silently choose a different worker.

New `goal_run.start` v2 adds `schemaVersion=2`, `workerProfileId` (operator-created host inventory key; **not** arbitrary binary/path/command from MCP) and an optional constrained model profile if authorized. Existing `requestId`, objective, repo, branch, acceptance, coding tasks, and resource limits continue. The host resolves the worker profile to a pinned adapter, binary/hash, native permission policy, runtime auth identity, and sandbox. These values are bound into the new immutable `scopeFingerprintVersion=2` alongside exact scope, budget, STOP path, worktree scope and QA argv. Never infer a v2 approval from an old `read-only-v1`/`worktree-write-v1` decision file.

Persist `workerProfileId`, `adapterId`, `adapterContractVersion`, `runtimeVersion`, executable digest, per-goal permission/sandbox-policy digest, original repository SHA, dispatch receipts and provider event cursor. A resumed goal must revalidate all bindings. A stored sha256 digest is **not** a native permission grant.

Old v1 checkpoints/outboxes remain on the existing Codex reader and recovery path. They cannot be silently rewritten to v2, assigned to OpenCode, or retried under a different worker. Cross-provider handoff is only allowed at a verified terminal task boundary with a new explicitly approved worker profile, an immutable verified context bundle, a fresh provider session, and no unacknowledged predecessor turn.

## 5. Security / isolation matrix

| Concern | Enforced by | Required rule |
| --- | --- | --- |
| MCP client identity | Native host local IPC; later OAuth/TLS for remote | Client-provided session headers, agent labels and model tool arguments never authenticate |
| Worker profile / executable | Native host | Installed, pinned, allowlisted executable and runtime/adapter version; sanitized environment; no model-controlled argv |
| Repository+branch | Existing native approved scope / Git evidence | `Local` remains the sole authorized write branch for this repository; no inferred cross-repo writes |
| Filesystem mutation | Native worktree + OS-level process sandbox | No write/shell outside approved paths even if worker defaults say `allow` |
| Approval | Native operator confirmation / host-owned grants | Worker or client may request, never mint, extend or bypass |
| QA | TrustedCommandRunner + independently verified diff | Worker self-report and provider tool exit claim do not establish QA PASS |
| Workspace/browser | Host leases plus provider-specific browser profile rules | Shared WebView2 cookies are acknowledged; no implicit profile isolation |
| Credentials | OS vault/host-managed provider auth | Never expose tokens/cookies to agent outputs, MCP fields, logs or handoff |
| STOP/PAUSE | Host ledger and process control | STOP outranks pause, deadline and retry; pause is cooperative if adapter cannot suspend active turn |
| Multi-agent context | Namespaced registry/outbox/cache | No implicit cross-run transcript/credential reuse; explicit sanitized artifact handoff only |
| Network/remote agents | Future authenticated, origin-validated service | Do not bind a public endpoint merely because MCP HTTP is supported |

In particular, OpenCode V2 permission defaults may allow edit and external-directory access. Policy config helps but cannot substitute for an **independently enforced OS write boundary**. Codex-specific `runCommand` sandbox probes and QA currently live in `goal-worktrees.mjs`; separating them from the worker is a precondition for a writable OpenCode adapter.

## 6. Concurrency, budgets, and lifecycle

Separate `maxConfiguredWorkspaces=10`, `maxActiveGoals` (source experiment currently 2), `maxActiveWorkersByProvider`, `maxConcurrentToolCalls`, `maxBrowserSessions` and per-provider token/cost/time budgets. None implies 10 active model processes. The scheduler uses fair bounded queues and per-repository write locks; disjoint file lists alone cannot establish OS-level isolation against a malicious/misconfigured worker.

A backend may contain its own subagents; the host treats it as **one accountable parent run** until it can independently verify child identity, budget, permissions and output. A provider's internal subagent tasks cannot consume global LazyPrompting capacity without admission.

Lifecycle: `PROPOSED -> SCOPE_APPROVED -> RESERVED -> DISPATCH_PENDING -> ACKNOWLEDGED -> OBSERVING -> RESULT_ATTESTED -> QA_PENDING -> QA_VERIFIED -> DONE`. Branches: `PAUSE_REQUESTED -> PAUSED -> RESUME`; `STOPPED`; `BLOCKED`; `RECONCILE_REQUIRED`. No repeated dispatch on unknown outcomes. On adapter crash, look up the exact persisted provider turn using supported official APIs; if evidence is insufficient hold for operator. Do not interpret a lost stdout handle or a browser idle indicator as terminal completion.

UI should show **Client**, **Worker**, **Worker version**, **Scope**, **Approval**, **Session**, **Verified QA**, **Risk/Blocker** as different fields. "Connected MCP" must never be displayed as "worker ready" or "QA passed".

## 7. Host portability — separate from agent portability

**Windows is the active implementation target.** The current native host, named pipes, peer PID/creation verification, Codex PowerShell sandbox probes, WebView2 specifics, WSL2 Lightpanda bridge and NSIS bundle are Windows-bound. Although Tauri supports Windows/macOS/Linux, this application's verified integration does not yet.

Proposed `HostPlatformAdapter` owns only OS-specific functions: verifyPeerIdentity, spawnIsolatedProcess, approveOperatorScope, getSecret, worktreeSandbox, runTrustedVerifier, terminateWorkerTree, acquireGlobalLease and createBrowserInstance. Windows implementation retains current behavior behind the interface; macOS/Linux require separate peer-credential secure local IPC and sandbox implementations and dedicated packaging/QA. Platform unavailable => `UNSUPPORTED_PLATFORM` / read-only limited mode, never trust fallback.

Browser provider is **not** an agent worker: WebView2 (Windows UI), WKWebView (future macOS UI), WebKitGTK (future Linux UI), separate Lightpanda automation and optional OpenCode Browse/Chromium extension. Browse's real-browser login handoff, tab lending and network capture require explicit installation/pairing and provider-specific permission checks; no unattended credential transfer or assumed shared tab identity.

## 8. Feature / adapter rollout matrix (targets, not verified support)

| Candidate | MCP client | Worker adapter | Native write sandbox | Resumable/terminal verification |
| --- | --- | --- | --- | --- |
| Codex App Server | Already exercised on earlier Windows installer | Existing production candidate, compatibility refactor | Existing Codex scope; re-test latest native | Source implemented; old installed evidence only |
| OpenCode V2 | Earlier agent/client integration observed | **First new worker pilot** via official noninteractive CLI / later SDK | MUST implement & prove before write | Map official session/events; prove reconciliation |
| Claude Code / Agent SDK | MCP client possible; own agent-session QA missing | Future adapter using documented Agent SDK | Gate separately | Gate per documented callback/event/session behavior |
| Gemini CLI | MCP client only if verified for this deployment | Future headless JSON/stream-json adapter | Gate separately | Gate exact exit + session + event receipt |
| ACP-compatible agent | ACP agent-client bridge (not MCP itself) | Optional protocol adapter after version negotiation | Host still owns OS sandbox | Probe v1/v2 separately |
| A2A remote agent | Remote A2A endpoint, not merely local MCP client | Deferred remote worker transport | Remote sandbox attestations | Auth/task state/events/STOP verified |
| Cursor, VS Code, Zed, Windsurf | Client MCP registration | Not assumed to be headless workers | Not applicable until official backend proven | Client QA alone is insufficient |

No provider is deemed "unsupported forever": capability and official API review may change the matrix after tests. Do not hardcode "all backends support pause, resume, tools, browsing" in schemas.

## 9. Phased migration / hard gates

**Gate 0 — prerequisite (P0):** pin current `Local`, run full Node static suite, Windows `cargo fmt --check` / `cargo check` / `cargo test`, stage, rebuild and re-install, inspect three-client handshake, native approval, workspace/goal leases, pause/resume/STOP and false QA rejection. Fix native regressions before changing provider engine. Do not reuse evidence from earlier SHA.

**Gate 1 — extract contract (P1):** add `AgentBackend` versioned manifest, normalized events and v2 fingerprint as source-only modules. Build fake-provider conformance tests for accepted, rejected, lost, duplicate and stale turns. Keep old Codex path intact.

**Gate 2 — Codex wraps universal runner (P2):** adapt Codex App Server to `AgentBackend`; swap `runReadOnlyGoal` orchestration to call adapter, but preserve exact Codex behavior and all old receipts. Compare old-vs-new reports at same tasks. Host-controlled verifier and OS sandbox are separated before any new writer.

**Gate 3 — OpenCode read-only worker (P2):** use official CLI structured output or verified SDK, host-owned process; session start, text result, abort, observe and recovery. Deny tools/write/shell via independent enforceable restrictions; run disposable fixtures. No automatic task continuation without final host-observed evidence.

**Gate 4 — OpenCode worktree-write (P0 permission gate):** only after OS-level sandbox probe demonstrates writes outside the approved worktree, sibling task, base repo, .git metadata and secrets are impossible; host independently executes approved QA argv and binds digest to result. Do not rely solely on provider config policies.

**Gate 5 — true mixed-provider multi-agent:** run Codex + OpenCode concurrently on disjoint approved scopes, test same-repo contention, budgets, STOP/pause, crashed adapter, stale event, double dispatch, model-proposed scope escalation and transfer of sanitized evidence. No automatic merges or cross-branch promotion.

**Gate 6 — additional worker ecosystems:** Claude Agent SDK, Gemini CLI, and then optional ACP/A2A adapters, each with pinned official documentation, auth/contract/protocol provenance, a fake-server contract test, one real read-only fixture and isolated write QA before promotion.

**Gate 7 — macOS/Linux:** adapter-specific local IPC/process identity/sandbox, browser provider and packaging verified separately. Do not label them supported based on Tauri being cross-platform.

**Rollback:** feature flag `agentBackendV2=false` defaults false until Gates 0–2; v1 Codex runner remains the stable option. On any v2 regression disable new dispatch, persist reconciliation state, leave existing approved v1 checkpoint unchanged, require operator review before restarting an interrupted turn.

### Acceptance metrics

- Four original public MCP tools, existing `goal_run.*` v1 behavior and Windows Codex verified fixtures remain unchanged.
- One read-only task executes independently under Codex and OpenCode with exact host-observed and independently inspected receipts.
- Concurrent cross-provider tests never permit unauthorized shared worktree mutation, browser workspace control or foreign receipt reads.
- Zero lost/duplicate dispatch across disconnect/restart/timeout fixtures. Unknown is explicitly held, not reported as PASS.
- Every write path has independent native OS sandbox proof, scoped Git diff and host-run QA. Model-reported success is never `QA_VERIFIED`.
- Each adapter and OS target has its own evidence label and commit SHA, with no simulated production PASS.

## 10. Primary official references (as checked 12 Nov 2026)

- MCP transport and authorization: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports and https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- MCP evolving session model (draft; do not assume released support): https://modelcontextprotocol.io/specification/draft/changelog
- Codex App Server: https://learn.chatgpt.com/docs/app-server
- OpenCode official embedded SDK: https://opencode.ai/docs/build/sdk
- OpenCode CLI/JSON events: https://docs.dev.opencode.ai/docs/cli/
- OpenCode V2 permissions and policies: https://opencode.ai/docs/permissions/ and https://opencode.ai/docs/policies/
- OpenCode Browse (separate browser provider): https://opencode.ai/product/browse
- Claude Agent SDK vs CLI vs API: https://platform.claude.com/docs/en/cli-sdks-libraries/overview
- Gemini CLI headless mode: https://geminicli.com/docs/cli/headless/
- Agent Client Protocol v2 (versioned, do not mix with older ACP): https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v2/overview.mdx
- A2A 1.0 protocol: https://a2a-protocol.org/v1.0.0/
- Tauri v2 system webviews: https://v2.tauri.app/reference/webview-versions/

**Final status:** design only. No CLI/SDK installed, no code refactoring or Windows acceptance executed by adding this document.
