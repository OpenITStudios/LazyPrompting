# Universal Agent Backend — source-only runtime

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
| `adapters/opencode-cli-readonly-backend.mjs` | OpenCode JSONL worker adapter, requires host-proven read-only OS sandbox |
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
