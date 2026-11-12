# Native Agent v2 scope authority — source implementation (12 November 2026)

**Branch:** `OpenITStudios/LazyPrompting` → `Local`. **Source milestone:** `fb8381383f6cbaddcf95be44f83a19b02792bfd3`, `e459c52f0b1b05c16e0303e701f7ba578d0f5771`, `64a1793fe5d4467203898eb93724e593fc2336f9`, `052d69efd1656f7cce490ec301883d80d0f84a79`, `26e9fff30292cd44b48e6baf20dc2ea430c05bea`. **Proof class:** SOURCE_COMMITTED. The operator requested no tests; no Rust compilation, installed app or actual worker acceptance is claimed.

## Canonical owners

- `apps/desktop/src-tauri/src/agent_goal_authority.rs`: native read-only **scope/approval/STOP** for v2. Does NOT own dispatch or create a second outbox.
- `apps/desktop/src-tauri/src/agent_worker_profiles.rs`: allowlisted Codex/OpenCode executable path resolution, canonical path, finite-byte SHA-256 and pre-approval revalidation. A binary hash is diagnostic and immutable scope metadata, **not** auth.
- `apps/desktop/src-tauri/src/mcp_stdio_host.rs`: same four top-level MCP tool names. Additional capability names `agent_run.prepare`, `agent_run.status`, `agent_run.stop`.
- `apps/desktop/src-tauri/src/browser_mcp_pipe.rs`: authenticated installed-stdio-client identity, read-only v2 goal lease, same-client workspace lease. This does **not** isolate browser cookies.
- `apps/desktop/src-tauri/src/goal_runs.rs`: Codex v1 canonical owner remains unchanged except that v2 request UUID collisions fail and its trusted Git helper is reused by v2.
- `src/agent/agent-run-controller.mjs`: future host-attested worker dispatch and `PromptOutbox`; **not called by v2 prepare/status/stop**.
- `src/agent/native-agent-request-router.mjs`: private v2 gateway RPC, remains **UNBOUND** until real native host callbacks exist.

## Public v2 prepare / status / STOP contract

`agent_run.prepare` requires `schemaVersion=2`, UUID `requestId`, `workspaceId` (01–10), `workerProfileId` (`codex-local` or `opencode-local`), existing absolute `repositoryPath`, `baseRef`, bounded `objective` and exactly one `acceptance` item. An optional `limits` object defaults to 1 active task, up to 2 turns and 30 minutes. **There is no `codingTasks`, custom shell argv, arbitrary executable path or optional model-granted permission.** Every unknown input field is rejected by Rust deserialize.

The native host selects the configured `LAZYPROMPTING_CODEX_EXE` or `LAZYPROMPTING_OPENCODE_EXE` itself. The operator dialog displays worker identity, executable digest, workspace, repo/branch/SHA, objective and limits; it explicitly states that no agent is launched. On approval, a digest-bound immutable approval marker is published. If the executable changes while the native operator dialog is open, a non-grant decision is stored and the scope requires reconciliation rather than waiting indefinitely. Binary inventory hashing runs off the Tauri UI thread. It does not grant worker dispatch; an active worker will need **separate operator consent** and verified process sandbox.

Scope is stored in the existing `goal-runs` host directory under `<uuid>.v2.json`, with `<uuid>.v2.decision` and `<uuid>.v2.stopped`. Legacy Codex v1 uses `<uuid>.json` and is not parsed, replayed, upgraded or auto-resumed as v2. A single UUID cannot create both run versions. A duplicate with identical scope/profile retrieves the original record; changed input is a `REQUEST_CONFLICT`.

`agent_run.status` returns only bounded scope identity, workflow state, SHA metadata and an explicit `executionReady=false`, `nextPromptAllowed=false`, `qa=NOT_EXECUTED`. States are `AWAITING_OPERATOR`, `APPROVED_SOURCE_ONLY`, `DECLINED`, `STOPPED`, `RECONCILE_REQUIRED`. An approved state is **rechecked** against the canonical executable digest, the exact Git branch ref and checked-out HEAD SHA, and clean working tree on each status query. Any drift produces `RECONCILE_REQUIRED`. The hash marker detects accidental scope changes but is NOT a secret key or proof against a same-user filesystem attacker.

`agent_run.stop` publishes an immutable STOP marker and never resumes or dispatches anything. The same live MCP peer cannot control a goal claimed by another live installed client; the native goal and workspace leases use separate namespaces.

## Authenticated native callback broker — source milestone

The private Node gateway now uses the **already authenticated** host-owned
Windows named pipe to inspect a prepared v2 run. The native host owns both
the authoritative `<requestId>.v2.json` file and its approval marker.
`GatewaySession::request_agent` adds a fresh 128-bit correlation token to the
private `lazyprompting/agent` request; the Node child makes an
`inspectPreparedRun` callback over the authenticated pipe; the native host
checks the operation, token and **exact original run ID** before reading the
canonical record.

The broker allows at most eight frames and enforces bounded I/O/deadlines.
A terminal `agentCallbackDone` frame is required before the native gateway
reads its stdio JSON-RPC reply, avoiding a host/child wait cycle. The same
native operation lock serializes these callbacks with existing Lightpanda
grant handling. Cross-run inspection, an unknown callback operation, missing
token or malformed frame fail closed; a connection error requires gateway
reconciliation, never automatic dispatch retry.

The operator's main application window may use the typed Tauri
`agent_gateway_inspect` command. Browser workspace windows cannot call it,
and it returns no executable path, credential, approval key or prompt
transcript. The `SOURCE_INSPECTED` response exposes **read-only**
native scope state and always reports `executionReady=false` and
`qa=NOT_EXECUTED`. This is a real source path for status inspection,
**not** a live native/Windows acceptance result.

The `NativeAgentRequestRouter` is still unbound for `start`, `observe`,
`cancel` and `reconcileReserved`; registering an executing backend
requires a host-verified provider profile, OS-enforced sandbox, independent
worker receipt source, and separate action consent. No other callback kind
can be called yet.

## Immutable source-binding projection — source milestone

The native host can now derive a source-only `readApprovedSource` binding
from the existing `<requestId>.v2.json` record. It requires the source
approval marker, exact pinned branch/checkout SHA, clean Git tree and the
same SHA-256 executable identity. The response includes the native-chosen
worker profile, repository and STOP/outbox paths, scope and limits, plus
versioned **source intent** permission/sandbox fingerprints. No model-supplied
profile, executable or policy enters this native operation.

The binding carries `runtimeVersion=unverified` and
`openSession/submitTurn/observeTurn/readOnlyIsolation=UNKNOWN` (write
is explicitly `UNSUPPORTED`). These are intentionally **not**
`SUPPORTED_VERIFIED`, so `AgentBackendRegistry` cannot admit the profile
as an executing worker. The source-intent policy SHA-256 values do not prove
any OS sandbox and are not grants.

`src/agent/native-source-binding.mjs` validates the full native payload,
rejects any inflated capability statuses, computes the ordinary
`fingerprintAgentGoalScopeV2` and produces a sanitized
`SOURCE_BOUND_NO_EXECUTION` summary. The full executable path, objective
and workspace directory stay inside the authenticated internal Node gateway.
A main-window-only Tauri command `agent_gateway_source_binding` exposes
only that summary via the TypeScript runtime bridge. The existing
`agent_gateway_inspect` and source-binding commands share one run-ID
validator and gateway admission path. Neither executes a provider turn.

The callback operation remains restricted by a fresh host-issued token,
exact native `runId` and fixed action `source`. The native broker rejects
`readApprovedSource` for status, inspect, start or any other action.
The final `agentCallbackDone` frame is still mandatory.

## Native v2 execution-intent review — source milestone

After `agent_run.prepare` has been separately approved, `agent_run.review_execution` can request one more **native operator dialog** to record intent for a future read-only agent execution. This second review is bound to the immutable source approval digest and therefore to the exact worker profile, executable SHA-256, repository/branch/base SHA, scope and limits. It records no executable grant.

The host first persists `<uuid>.v2.execution-pending`, preventing simultaneous modal duplication. The eventual operator outcome is persisted once in `<uuid>.v2.execution-review` using the same atomic file publication procedure. After a crash the pending state is intentionally held for operator reconciliation, never auto-approved or silently retried. Rejected review is `DECLINED`; a changed binary/source while the dialog is open yields `RECONCILE_REQUIRED`. STOP always takes precedence.

The review state is distinct from source state and admits only `NOT_REQUESTED`, `PENDING`, `REVIEWED_NO_EXECUTION`, `DECLINED`, `STOPPED`, and `RECONCILE_REQUIRED`. Rust, the authenticated gateway source binding and the desktop TypeScript runtime projection preserve this exact vocabulary. All responses remain `executionAuthorized=false`, `executionReady=false`, `nextPromptAllowed=false` and `qa=NOT_EXECUTED`.

### Native action admission — explicitly fail closed

The private Node gateway now asks the authoritative native host for `evaluateAgentAction` before it could call any v2 `start`, `observe`, `cancel` or `reconcileReserved` operation. The native host re-reads its exact approved run and STOP marker through the existing run-bound authenticated pipe, then returns a structured **denial**:

- `AGENT_STOPPED`: permanent STOP marker
- `AGENT_V2_SOURCE_NOT_APPROVED`: no valid current source or executable identity
- `AGENT_EXECUTION_REVIEW_REQUIRED`: no separate operator intent review
- `AGENT_OS_SANDBOX_NOT_VERIFIED`: the requested start cannot be isolated yet
- `AGENT_HOST_TURN_RECEIPT_REQUIRED`: observe/cancel/reconcile has no host-authenticated worker receipt

**Every response is `admitted=false`.** The gateway separately preserves run-independent `status` discovery; a health request cannot authorize any work. A fabricated `admitted=true` response is rejected by the Node callback validator. Future positive execution admission requires an explicitly versioned, trusted, OS-enforced sandbox receipt and a separate native grant bound to the exact task, not a changed status flag or a reused intent marker.

### Windows sandbox source choice

Windows restricted tokens and job objects provide different boundaries, and a job object alone is **not** filesystem/network isolation. The supported AppContainer model offers security-checked per-resource capabilities, but the newer `Experimental_CreateProcessInSandbox` interface is explicitly experimental and cannot be selected as a production assumption without Windows capability verification. Sandbox implementation must also address model-network access via a scoped host proxy without granting arbitrary egress.

Primary Microsoft documentation:
- https://learn.microsoft.com/en-us/windows/win32/secauthz/restricted-tokens
- https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
- https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer
- https://learn.microsoft.com/en-us/windows/win32/secauthz/createprocessinsandbox

The source design remains **not native-tested** and cannot be described as a working sandbox or agent launch.

## Windows worker process isolation source

The new [native worker isolation owner](agent-v2-native-worker-isolation.md)
contains bounded Job Object tree management and cleanup, a unique per-run
zero-capability AppContainer profile, and a private `CreateProcessW` launcher
that validates the host-selected executable and creates only a **suspended**
AppContainer child with scrubbed environment and actual token verification.
The native job owner retains the child process, thread and container profile,
and v2 STOP retires the matching job after durable STOP publication.

No real worker is resumed or dispatched through MCP. File ACL grants, a
restricted provider-network broker, bounded output receipts, authenticated
resume and independent QA remain explicit source blockers. Source code is
not native enforcement proof without actual Windows compilation and
security fixtures.

## Explicit remaining SOURCE work

1. **Positive native execution authority:** the authenticated broker now has an *always-denying* `evaluateAgentAction` policy; implement a separately versioned, host-verified sandbox + dispatch grant and `readApprovedRun`, `verifyApprovedScope`, `verifySession`, `attestTurnReceipt`, `attestObservation`, `reconcileReservedDispatch`, and `authorizeCancel`. The current operator review is not a runtime grant.
2. **Provider profiles:** read-only registry must resolve pinned adapter version, CLI/runtime version and host-verified capability manifest. No arbitrary executable or model-selected sandbox.
3. **Windows read-only execution isolation:** Job Object + suspended AppContainer source exists. Complete explicit read-only filesystem ACL/snapshot grants, restricted provider I/O, verified resume after job assignment and native security proof. OpenCode `explore` alone remains insufficient.
4. **Exact provider observability:** native host session/dispatch identity, ambiguous request recovery, durable outbox correlation, and no replay of uncertain results. OpenCode `step_finish` absence must not be equated to completion.
5. **Host-owned source/diff/QA:** independently verify Git change digest and approved QA commands. Agent claims never certify source or tests.
6. **Windows source/build/native acceptance:** deferred by explicit user direction. When permitted, pin the exact final Local SHA; do not reuse old Windows evidence.

## Safety and compatibility

The four MCP public tools and legacy `goal_run.*` v1 remain stable. Read-only scope approval cannot authorize a future write operation, plugin installation, account login, browser scraping, GitHub push or CI run. Unattended consumer ChatGPT web automation remains disabled. `main` and retained `Harness` are outside this work.
