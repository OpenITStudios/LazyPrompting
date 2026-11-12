# Universal Agent Backend — optional worker source-only runtime

**Selected product boundary:** [Universal AI client → ordinary ChatGPT workflow](../../docs/architecture/universal-chatgpt-workflow.md) governs conversational goals. The modules here are optional execution-worker adapters, not MCP-client onboarding or ChatGPT consumer session control.

The modules in this folder are a **host-injected v2 foundation**. They do not
register a new public MCP tool, enable OpenCode writing, connect a real account,
or migrate approved Codex v1 checkpoints. The existing four MCP tools and
Codex v1 goal runner remain unchanged.

| Owner | Responsibility |
| --- | --- |
| `agent-contract.mjs` | Strict provider profile, exact capabilities, executable and adapter fingerprints |
| `agent-backend-registry.mjs` | Backend registration only after trusted host attestation |
| `agent-events.mjs` | Scope-bound event/receipt normalization, replay and ordering guards |
| `goal-scope-v2.mjs` | Immutable v2 goal/worker/permission/sandbox fingerprint |
| `agent-run-controller.mjs` | Read-only dispatch, observe, cancel, session recovery, durable outbox reconciliation and ambiguous reservation recovery |
| `native-agent-request-router.mjs` | Private, host-injected v2 dispatch router; resolves an approved run from native authority, never from MCP arguments |
| `adapters/codex-app-server-backend.mjs` | Codex App Server worker adapter, independent of the legacy v1 runner |
| `adapters/opencode-cli-readonly-backend.mjs` | OpenCode JSONL worker adapter; optional strict native output-candidate path requires host/process and provider-session proofs |
| `native-io-candidate.mjs` | Strict native capture candidate schema, run/dispatch/session/PID binding and domain-separated SHA-256 digest; never grants QA or dispatch |
| `adapters/opencode-jsonl.mjs` | Bounded fail-closed JSONL session and terminal event parser |

The controller uses the existing `PromptOutbox` as **the only durable
dispatch/receipt owner**. Every external action is preceded by explicit
native-host approval and a persisted reservation; a lost response holds
`RECONCILE_REQUIRED` rather than retrying. A model-provided flag does not
authenticate anything. A provider completion is **not** independent QA.

The OpenCode adapter constructs a noninteractive read-only CLI invocation
only inside a separately host-verified process. No standalone CLI launch,
default permission relaxation, account login, generic shell access or writing
is enabled by this source.

Source checks:
```sh
npm run test:universal-agent-contract
npm run test:universal-agent-runtime
npm run test:universal-agent-adapters
npm run test:universal-agent-file-backed
```

See [runtime evidence](../../docs/validation/universal-agent-source-runtime-2026-11-12.md)
and [architecture](../../docs/architecture/universal-agent-orchestrator.md).
Windows Rust, packaging and real provider integration remain separately gated.

## Native gateway bridge (source stage)

The authenticated Node gateway now recognizes private `lazyprompting/agent`
requests. The Windows `GatewaySession::request_agent` method transports only
strict actions: `status`, `start`, `observe`, `cancel` and
`reconcileReserved`. No fifth public MCP tool has been added.

The router is **deliberately unbound** until the native host supplies real
`readApprovedRun` and `authorizeAction` callbacks and the verified v2
`AgentRunControllerV2` composition. Requests for work fail closed with
`NATIVE_AGENT_RUNTIME_NOT_BOUND`; `status` reports the actual unbound
state. A renderer, client and model cannot enable this transport through
arguments or environment variables. No OpenCode process can launch through
this new source alone. This is a transport/authority boundary, not a claim
of complete native-host worker execution.

## Windows native discovery

`list_agent_worker_profiles` reports configured Codex/OpenCode executable digests without returning paths or granting execution. `agent_gateway_status` queries the authenticated private v2 RPC and reports that worker execution is not yet bound to native permissions. A source adapter is not runtime readiness.

## Prepared native scope, not dispatch

The installed Windows MCP has `agent_run.prepare/status/stop` backed by
`apps/desktop/src-tauri/src/agent_goal_authority.rs`, and only that native
host may ask the operator to approve the immutable scope. These operations
never instantiate `AgentRunControllerV2`, launch OpenCode or mint v2 worker
receipts. A matching executable digest and a clean Git checkout are only
source prerequisites. The private gateway remains unbound until the host
owns trusted provider registration, action-specific dispatch consent,
process isolation and attested worker results.

## Native callback bridge (read-only source path)

`src/gateway/native-ipc.mjs` implements the authenticated pipe callback
framing. Its `inspectPreparedRun` request is limited to the active native
`runId` and uses a random token issued by Tauri; `agentCallbackDone`
signals termination before the private RPC completes. The native host
revalidates the canonical scope/approval and returns only sanitized status.
`agent_gateway_inspect` is restricted to the main application window.
There is **no** native execution callback, prompt dispatch grant, session
attestation or OpenCode process launch through this source milestone.

## Source binding for future v2 execution admission

`agent_goal_authority.rs` now derives a worker-specific source binding
only from an approved and still-current native run. `native-source-binding.mjs`
normalizes it and calculates the ordinary v2 scope fingerprint; the main
operator UI can read the *sanitized* summary through
`agent_gateway_source_binding`. Binary paths, objective text, and local
outbox locations are never returned by the UI command.

Every runtime capability in this source-only binding is UNKNOWN/UNSUPPORTED,
not verified. The native host has **not** issued a dispatch grant or proven a
read-only process sandbox. `AgentRunControllerV2` remains unbound and cannot
launch Codex/OpenCode through the v2 gateway.

## Separate operator execution intent and native denial

The installed four-tool MCP facade now has `agent_run.review_execution`.
Its native modal stores a source-bound operator intent in the canonical
`goal-runs` directory but launches nothing. The native `executionReview`
status is carried to both authenticated gateway callback projections and
validated by the desktop bridge. It is never a runtime grant.

`evaluateAgentAction` is the authoritative private native policy callback
for start, observe, cancel and ambiguous-result recovery. It checks the exact
run, source approval, intent review and STOP and **always denies** because the
OS sandbox and host turn receipt are not established. The gateway retains
run-independent status discovery. Do not bind a worker by substituting a
model-supplied permission or by changing the enum in Node.

## Native Windows worker isolation source

The native host now owns a bounded `NativeWorkerJobs` process-tree manager
(Windows Job Object), a per-run zero-capability AppContainer profile and a
private suspended-process launcher. STOP retires any matching job and the
host closes all jobs at shutdown. The AppContainer child is not resumed,
and this code is **not** connected to the v2 gateway dispatch route.

See [Windows worker isolation source](../../docs/architecture/agent-v2-native-worker-isolation.md)
for unfinished read-only path grants, provider-network brokering, bounded
output/receipts, exact resume and native acceptance. Job Object confinement
alone is not an OS security sandbox.

## Native read-only repository inputs

`agent_run.prepare` now accepts optional `readOnlyInputs` (max 24 explicitly
selected, Git-tracked relative files). The native operator dialog shows those
paths, and the same approval digest binds them. The native-only staging path
rejects secrets/`.git`, symlinks/junctions, untracked paths and oversized
input, copying only bounded files into a per-run private snapshot. A second
module grants exact AppContainer SID read/traverse access **only on copies**.
The source prelaunch combines snapshot ownership, the suspended child and
Job Object; neither `ResumeThread` nor provider execution is called.

Source-only ACL changes are not runtime proof that an OS child can read only
those files. See [native worker snapshot and isolation
contract](../../docs/architecture/agent-v2-native-worker-isolation.md).

## Bounded native worker I/O — source only

The Windows host now contains `agent_worker_stdio.rs`, `agent_worker_io.rs`, and `agent_worker_io_pump.rs`. They prepare only three explicit child stdin/stdout/stderr handles, drain stdout/stderr concurrently with finite byte/frame/event budgets, and produce an OpenCode `TERMINAL_CANDIDATE` rather than a trusted completion. A CLI exit code or text event is not QA. No provider worker is resumed or dispatched through this new source. The canonical `PromptOutbox` remains the sole durable owner of reservations and results.

See [native worker isolation](../../docs/architecture/agent-v2-native-worker-isolation.md) for remaining native I/O, provider connectivity, receipt and sandbox acceptance.

### Native output candidate integration (still non-executable)

The OpenCode adapter can now consume a native `ioCandidate` returned by the host-injected `runIsolated` callback. The candidate includes only bounded stdout/stderr SHA-256 digests, event counts, exact run/dispatch/session/scope/profile/PID identity and a possible turn ID. Raw output is not returned in this path. `native-io-candidate.mjs` rejects extra fields, forged terminal status, foreign run/session bindings and contradictory exit evidence.

The adapter requires a separate `attestCapturedOutput` trusted-host callback and exact `reconcileTurn` proof from the provider's persisted session **before** turning a candidate into a turn reference. If any proof is absent, the task remains uncertain in the existing `PromptOutbox` and is not resent. Legacy injected stdout fixture behavior remains compatible but does not claim production sandbox/QA validation. No native worker is resumed or dispatched by this addition.
