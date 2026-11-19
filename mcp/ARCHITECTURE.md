# MCP Architecture and Ownership — LazyPrompting

**Canonical boundary map.** Source paths are current implementation owners; design documents are not substitutes for observed runtime proof. See [current state](../docs/operations/current-state.md) for pinned evidence and unresolved acceptance.

## Four distinct surfaces

| Surface | Entrypoint / owner | Intended caller | Scope |
| --- | --- | --- | --- |
| Installed desktop MCP | `apps/desktop/src-tauri/src/mcp_stdio_host.rs` + `mcp_capabilities.rs` (`lazyprompting-desktop.exe mcp`) | Any conforming stdio MCP client on the installed Windows host (Codex, Claude, OpenCode, Cursor, VS Code, …) | `workspace_browser.*`, Codex v1 `goal_run.*`, source-only `agent_run.*` via the local native host |
| Packaged internal gateway | `src/gateway/mcp-gateway.mjs`, `src/gateway/capability-router.mjs`, `src/gateway/capability-registry.mjs` | Desktop-owned gateway child / controlled internal client | Supervisor, checkpoint, optional browser and native-admitted Lightpanda capabilities |
| Legacy Node MCP | `src/mcp/server.mjs` | Opt-in compatibility or isolated test only | Old standalone supervisor/browser tool names; **not** the desktop public endpoint |
| ChatGPT arithmetic probe | `src/mcp/chatgpt-probe.mjs`, `src/mcp/chatgpt-probe-widget.mjs` | Explicitly configured test plugin / isolated probe | Disposable synthetic math; not a production task transport |

**Source-only planned adapter (not a fifth live surface):** `src/mcp/chat-goal/` now defines strict, four-operation ChatGPT in-thread plugin contracts, a host-injected authentication/native delegate, and widget send-request handling. It registers no actual endpoint; `ChatGPT probe` stays disposable and separate. The new module owns **no** scheduler, durable file, conversation identity or authority; host grant/STOP/PromptOutbox owners remain native. Never infer chat completion from an accepted `ui/message` request or a model-supplied `DONE_PROPOSED` report. OAuth resource-server integration and native dispatch remain unbound and blocked for live work. See [MCP entrypoints](README.md#goal-bound-chatgpt-plugin-bridge--source-only-19-november-2026).

Codex preview tool calls also use `src/transport/codex-preview-tools.mjs` as a **host-scoped bridge**, not a fifth interchangeable MCP endpoint.

## Code Mode ownership (source integration)

Both Rust MCP facade and internal Node gateway advertise
`code_mode.catalog` and `code_mode.execute` as capabilities behind the
same **four** public MCP tool names. Their other catalogs remain distinct.
Rust routes code through the trusted named pipe and host-owned packaged
gateway. The internal gateway interpreter parses a JavaScript subset and
calls its existing router's explicit read/pure allowlist, plus one
host-owned manual draft through a separately scoped native effect callback.

Acorn is a parser, not a sandbox. The source interpreter has no JS eval
or arbitrary globals. Code Mode cannot navigate a workspace browser,
read its page contents or cookies, reach ChatGPT, dispatch Codex/agent V2
workers, mutate checkpoints, run arbitrary commands or send ChatGPT
messages. The sole integrated effect is an operator-reviewed manual draft.
A native-only `code_mode.execute.workspaceId` may project the selected
**HTTPS supporting-tab origin** (not path/query/fragment or protected main)
through `tools.workspace.location()`. It requires a pre-existing owner lease,
rechecks native tab identity and refuses stale results after navigation.
An optional native-only `code_mode.execute.runId` uses the same verified MCP
peer and **pre-existing owner lease** as Codex V1. Native `goal_runs.rs`
checks persisted approval and emits only a bounded, sanitized status snapshot;
the generated program reads it with `tools.goal.status()` (no arguments).
Code Mode does not acquire a lease, read raw reports, or grant authority.

The native V1 report is a projection of the existing sanitized status.
An optional, exact `receipt:{taskId,turnId}` is correlated by
`goal_runs.rs` under the same pre-owned V1 lease and persisted approval,
then stripped of worker thread IDs, prompt text, paths and any QA grant.
The separate `agentRunId` requires an existing `agent:` namespace lease
and projects `agent_goal_authority.rs` V2 source-only status without
dispatch. The Node `checkpoint.summary()` uses the configured canonical
CheckpointStore; it publishes fixed recovery indicators only.
Public Node `code_mode.execute` cannot supply native bindings.

The installed Rust MCP now projects its canonical **22-capability catalog**
to native Code Mode (name/description/effect/permission/optional alias)
instead of requiring separate discovery calls. All raw native actions
advertise `invocableFromCode:false`; these are not execution grants.
`tools.capabilities.native()` is read-only metadata discovery.

A typed deterministic Git read through `tools.repo.status()` is bound
to an existing **V2** source-approved agent lease plus optional
`repositoryStatus:true`; unlike legacy V1 mode markers, V2's native
digest binds repository and SHA. Native revalidates approved scope
before and after reading and returns only counts and base-SHA equality.
It does not offer shell, workspace writes, provider dispatch or QA PASS.
The Code Mode engine is the selected *future sole AI composition route*,
while the current compatible facade still admits old native operations;
migration of effectful execution is not yet complete.

**V2 per-effect native policy inspection:** Owner-leased
`code_mode.execute.agentRunId` plus `effectPolicy:true` projects
the four fixed action denial decisions from the *existing* Rust
`evaluate_agent_action` policy owner through
`tools.agent.effect_policy()`. It never reserves, dispatches or
grants an effect. Rust rechecks lease and unchanged policy after
Code Mode. The durable `ReplayLedger`, `RecoveryJournal`,
`CheckpointStore` and `PromptOutbox` remain specific canonical
owners for their respective dispatch/prompt workflows; they are
not interchangeable with the session-only manual draft inbox.

**Native Effect Broker — first contained effect:** `handoff.prepare`
uses an authenticated per-request pipe token and one-effect limit.
Only `workspace_chat.prepare_handoff` is admitted under the original
MCP-client workspace lease; it reuses the existing native formatter,
deduplicated pending draft inbox and operator review event. The
interpreter requires the effect to be its terminal awaited return;
it receives a small fingerprint rather than the raw draft. An
uncertain outcome is held for inbox reconciliation, never retried.
`tools.handoff.reconcile()` reads only the original
`PendingManualHandoffs` inbox under the same verified workspace lease.
Rust rechecks state consistency after read-only composition and confirms
an acknowledged draft against the live fingerprint. This owner is
**session-memory only**; `EMPTY_UNVERIFIED` is not a safe retry grant,
and no second durable ledger/outbox has been created.
Other effectful capabilities remain unavailable from Code Mode.
Host identity, the existing leases, native STOP, approvals and independent
QA gates remain mandatory for their original operations. See
[Code Mode runtime](../docs/architecture/code-mode-runtime.md).
Rust/NSIS/installed checks on this source revision: **NOT_EXECUTED**.

## Two separate client paths

```text
Any local MCP client (Codex / OpenCode / Claude / other)
   -> Windows desktop stdio facade (Rust; 4 public tools)
   -> same-user/session-checked native named pipe
   -> Tauri host
       -> browser_mcp_pipe.rs -> embedded_webview.rs -> workspace WebView2
       -> goal_runs.rs -> operator scope review -> bounded Codex/worktrees

Desktop-owned, packaged internal gateway (separate session)
   Tauri gateway_session.rs -> authenticated Node child
   -> src/gateway/mcp-gateway.mjs (4 public discovery/invocation tools)
   -> capability-router.mjs -> trusted native grant / scoped backend
   -> private Lightpanda preview (not a WebView2 tab)

Opt-in experiments (neither is the installed desktop MCP):
   src/mcp/server.mjs           legacy standalone MCP
   src/mcp/chatgpt-probe.mjs    synthetic ChatGPT plugin transport probe
```

## ChatGPT plugin boundary — current source only

The hosted plugin now defines data-only, read-only `goal.status`,
plus `goal.bind`, `goal.report`, app-only `turn.claim`
and `turn.delivery`. These are
distinct from the installed desktop's four-tool MCP facade.
No production HTTPS MCP/OAuth server, native Codex receiver
or consumer-chat final-turn channel has been connected.

**Authority:** OAuth principal verification must happen
independently of native operator approval. Rust must
atomically check workspace, goal, chat, epoch, STOP and
the one-use `PromptOutbox` receipt at each effect;
`authorize` alone never grants execution. Only
`reserve`, `bind`, `hold` and read-only `pending`
exist on the dormant private gateway. No public
MCP actor may invoke these.

**Read-only status:** `goal.status` has empty input, OAuth/native
admission, an exact host-owned status projection, and
`readOnlyHint:true`. An authorized same-principal operator
may inspect native STOP without granting any effect. Native
STOP outranks an older Codex RUNNING status. Successful
`structuredContent` follows its exact output schema; errors
return `isError:true` with text only. All permission and QA
flags remain denied.
It has no widget template and calls the private host once;
there is no production host callback or active MCP endpoint.
Status does not verify a ChatGPT turn or authorize an effect.

**Communication:** One optional `nextAction` with
`CONTINUE` yields a bounded, untrusted
`CHATGPT_CODEX_REVIEW_PROPOSAL` with native-selected
scope. The private original receipt stays out of the
Codex packet. Its deterministic content fingerprint
is not proof of identity, permission, completion or
at-most-once delivery. The 16 KiB upper byte ceiling
handles schema-valid Unicode, not an instruction to
produce large reports.

**Native review receiving:** `chat_plugin_codex_review.rs` is a
private, read-only projection that verifies the packet's schema,
canonical cross-language fingerprint, trusted native V1 reviewed
goal/source SHA and live saved-chat digest. Its host-supplied epoch
must match; it never grants worker execution, validates a report
receipt, or receives an authenticated final ChatGPT result.
It is not a Tauri/public MCP command or a live plugin callback.

**Recovery:** Native `chat_plugin_scope_preflight`
checks an approved, terminal Codex V1 read-only source
and saved/live ordinary chat URL without creating a
grant. `chat_plugin_pending_status` reads only existing
outbox holds through the authenticated packaged gateway,
even when WebView is closed. All recovery statuses deny
send/retry/automatic release. Claim consumption,
Codex execution binding, final-turn correlation and
safe terminal release are **NOT_IMPLEMENTED**.
Source tests are authored, **NOT_EXECUTED**;
see [current-state history](../docs/operations/current-state.md).

## Public-tool contract

Both the installed Rust facade and the internal Node gateway expose the four **names** `status`, `search_capabilities`, `describe_capability`, `invoke_capability`. Their capability catalogs and trust channels **differ**; sharing these names does not make the endpoints interchangeable.

- Rust desktop capabilities: `workspace_browser.open`, `navigate`, `location`, `back`, `forward`, `reload`, `release`; **read-only `workspace_chat.prepare_handoff`** (native-leased, manual draft only); Codex v1 `goal_run.start/status/report/control/turn_receipt`; source-only v2 `agent_run.prepare/status/review_execution/stop` with no worker dispatch.
- Node gateway capabilities: `supervisor.*`, `checkpoint.read`, allowlisted `browser.*`, and separately granted `lightpanda.*`. Registry and routing are owned by `src/gateway/`.
- Legacy `supervisor_status`, `supervisor_evaluate`, `checkpoint_read`, and `browser_*` are compatibility-only. Never publish these alongside the canonical four-tool production facade.
- ChatGPT probe tools are synthetic and opt-in, with separate setup, transport, ephemeral state and consent. Never infer that ChatGPT Web automation or conversation scraping is permitted.

## One owner per layer

| Concern | Canonical source | Forbidden coupling |
| --- | --- | --- |
| Desktop user interface | `apps/desktop/src/` | Must not mint native approval or host trust |
| Host, install, IPC, Windows MCP | `apps/desktop/src-tauri/src/` | Must not trust renderer flags as operator consent |
| Internal MCP protocol and discovery | `src/gateway/` | Must not own authored browser pages or source-of-truth goal state |
| Browser adapters | `src/browser/` | Must not grant permissions or silently share WebView2 sessions |
| Codex transport and worktrees | `src/transport/` | Must not treat agent claims as trusted verification |
| Decisions/checkpoints and orchestration | `src/supervisor/`, `src/prompt/` | Must not own MCP public schemas |
| Grants, replay, durable scopes | `src/governance/`, `src/runtime/` | Must not infer authorization from prompt contents |
| GitHub receipts / external evidence | `src/integrations/` | Must not self-certify external test results |

Rust's private helper modules `goal_run_projection.rs` and
`gateway_result.rs` implement pure projections and owned JSON result
extraction only. `goal_runs.rs` retains Codex approvals, STOP/pause, storage
and scope checks; `gateway_session.rs` retains IPC authentication,
single-flight requests and uncertain-effect handling. Seven private
object-result calls share one native-authenticated request path, and the
Code Mode structured result is moved from its owned JSON envelope after
status validation. No new host authority or public MCP tool is introduced.

Shared demand-driven backend lifecycle belongs to `src/runtime/backend-lifecycle.mjs`; `src/gateway/backend-lifecycle.mjs` is only a compatibility re-export. The Codex transport imports the runtime owner directly, avoiding a transport → gateway back-edge.

## Native stdio timeout boundary

The Rust gateway session uses one `RequestTracker` deadline for
synchronous stdin writing, private callback windows and the response
reader. A request-scoped watchdog attempts to stop the owned Node child
when a write or callback remains blocked past that deadline. Native
Code Mode, Agent and Lightpanda callbacks are rejected before a new
effect when the remaining request budget is exhausted. This adds no
permission, queue, retry or replacement state owner. Child termination
does not roll back an uncertain effect, and cannot forcibly interrupt a
synchronous callback already running. Exact-head Windows/native testing
is still required before claiming an absolute wall-clock bound.

## Safety and lifecycle invariants

1. The operator selects branch and approves mutations. No inferred cross-repository write, merge, release, CI dispatch or browser-session extraction.
2. Native host owns consent, process identity, bounded workspaces, revocation and private browser grants. Stdio `initialize` is **not** authentication.
3. Do not replay uncertain mutations or unacknowledged Codex turns; reconcile exact receipts first. Stop/pause and branch boundaries are authoritative.
4. WebView2 and Lightpanda have separate process/session identities; the experimental probe is a third, unrelated transport.
5. Static/source checks are not native or live acceptance. See [system contract](../docs/architecture/system-contract.md), [goal-run contract](../docs/architecture/goal-run-mcp.md), [security](../docs/governance/security-and-compliance.md) and [validation router](../docs/validation/README.md).

## Universal MCP clients → ordinary ChatGPT target — NOT AUTOMATED

The operator-selected [canonical chat-first product](../docs/architecture/universal-chatgpt-workflow.md) accepts **any actually verified compatible MCP client** for an authorized goal, while the conversational destination remains **ordinary persistent ChatGPT Chat (non-temporary)**. Client, optional planner/worker, native host and ChatGPT session are separate identity and capability domains. The existing browser MCP can open WebView2; this is not a supported arbitrary consumer ChatGPT send/result API. Legacy `goal_run.*` remains Codex V1; `agent_run.*` V2 is preparation/status only; planned `chat_goal.*` and `workspace_chat.submit` are **not registered**. See [universal acceptance gates](../docs/validation/universal-chatgpt-acceptance.md). No ChatGPT Web auto-loop is enabled.

## Synthetic MCP-to-host fixture (source-only, not normal desktop runtime)

The opt-in `workspace_chat.fixture_submit` and `workspace_chat.fixture_status`
backend is **test-only** behind the existing four public Node gateway tools.
It is enabled only if trusted test code constructs `CapabilityRouter` with an
explicit `ChatFixtureHostBridge` provider; normal Node gateway startup and
the installed Rust desktop MCP **do not inject or enable the Node provider**. Separately, the Rust desktop now includes debug-only `workspace_chat.fixture_send` / `workspace_chat.fixture_status` behind `LAZY_FIXTURE_BRIDGE_ENABLE=1`. These Rust fixture commands are disabled on normal/release startup, only address owned loopback fixtures, and have no verified Windows runtime transport. Admission and
execution callbacks are supplied by the trusted fixture host, not by a page or
model; only loopback `/fixture-chat/` is accepted. The bridge's status does
not return user input or assistant response text. It is not a functioning
native IPC or WebView2 integration. See [acceptance evidence](../docs/validation/chat-fixture-mcp-bridge-2026-11-11.md)
and [planned host integration](../docs/architecture/codex-chat-workspace-plan.md).

## Debug-only Rust fixture stage — NOT Windows accepted

The installed Rust MCP facade still exposes **four public tools**. Its
deferred `workspace_chat.fixture_send` and
`workspace_chat.fixture_status` commands route through the existing
session-/executable-checked Windows named pipe, then use Tauri/WebView2
on **owned loopback pages** only. This code is compiled only under the
Windows module and is gated off in normal/release operation. The
native host sends an embedded script through its own `Webview.eval`
interface directly to the owned fixture; the former page-visible
`window.postMessage` command channel was retired. The extension still
observes fixture status; browser status is **not** an authenticated
response completion or GitHub evidence. No production ChatGPT transport
is installed.

Status is observational and cannot unlock the next prompt. Rust
compilation, the installed shared-profile extension lifecycle, named-pipe
request delivery and actual WebView2 callback behavior are all
`NOT_EXECUTED` / `NOT_VERIFIED` against this source revision.
See [verification limits](../docs/validation/chat-fixture-native-webview-2026-11-11.md).

## Host-injected GitHub goal progression review (Node gateway, read-only)

The internal Node `CapabilityRouter` now optionally exposes
`chat_goal.progress_review` under its unchanged
`status/search_capabilities/describe_capability/invoke_capability`
public interface. **No default startup injects `goalReview`.**
If provided by a trusted host, the read-only
`GitHubGoalReview.inspect` checks the existing durable
workspace/outbox and separately verified GitHub/turn/QA evidence,
then calls the existing deterministic supervisor. It **does not**
commit source, release a pending prompt, authorize new dispatch,
rebind a Temporary Chat, or read consumer ChatGPT Output.

This is a **different internal path** from the installed Rust stdio
desktop MCP. No Rust desktop capability was added in this milestone.
See [validation](../docs/validation/github-goal-review-2026-11-11.md).
All site-specific host/permission constraints remain in effect.

The existing `createVerifiedGoalRuntime` composition now exposes
`sourceProgress({workspaceId,maxCommits})` through the same leased
`GitHubGoalReview.inspectSourceProgress` owner. It reports source changes
without consuming the `PromptOutbox`, attesting a ChatGPT response, marking
DONE or allowing a next prompt. It requires a separately authenticated
host with actual source/QA callbacks; the default gateway has not injected
that host and public UI GitHub reads are not trusted QA.

## Durable goal-review reconciliation (source-only; no installed host injection)

`src/prompt/goal-review-reconciliation.mjs` composes an internally
host-authorized verified GitHub review with the existing file-backed
registry/outbox/checkpoint owners. The checkpoint holds
`REVIEW_PREPARE -> RECONCILE_REQUIRED -> REVIEW_COMMIT` while the
exact verified response is reconciled. Recovery is idempotent and
never sends another prompt. This does **not** add another public MCP
tool or turn on a production reviewer: the native authority, shared
scheduler lease, authentic source head reader and runtime provider
must still be injected and tested on the installed host.

See [focused source tests](../docs/validation/goal-review-durable-reconciliation-2026-11-11.md).

## Trusted structured worker feedback boundary (source only)

The separate `StructuredWorkerFeedback` + `TrustedGoalReview` classes
bind a host-verified final worker result to exact goal/workspace/session/
task/prompt/response/source identity. They replace caller-supplied
`proposal` with an attested bounded result for read-only GitHub review,
and preserve a short verified explanation when there is no source commit.
A result claim does not establish QA PASS. Durable
`GoalReviewReconciliation` now requires a worker feedback fingerprint
before any prepared review may advance.

**No default Node gateway or installed Rust desktop MCP injects this
composition.** Four public MCP tool names are unchanged. This work
does not enable a consumer ChatGPT sender, output capture, automatic
session rollover or production dispatch. See
[feedback architecture](../docs/architecture/worker-feedback-trust-boundary.md)
and [scoped tests](../docs/validation/worker-feedback-gate-2026-11-11.md).

## Codex App Server terminal notification correlation — source milestone

The existing `goal-codex-runner.mjs` now records `turn/completed`
notifications from its **owned Codex App Server child process** in a bounded,
process-local `CodexTerminalEvents` instance. Before persisting a completed
turn, it correlates the notification with the same `threadId`/`turnId`
returned by the official turn status query. A conflicting completed/failed/
interrupted notification blocks result release. If a process was restarted or
no matching notification arrived, the report explicitly records
`TURN_STATUS_QUERY_ONLY` rather than inventing a live notification.

The native `goal_run.turn_receipt` reader checks any persisted
`terminalObservation` against the exact task thread and turn and surfaces
`processNotificationObserved` and `turnObservationKind`.
**Both are informational, untrusted until independently checked by an
authenticated native host.** The existing `finalTurnHostAttested=false`,
`qa=NOT_EXECUTED`, `acceptancePassed=false` and
`nextPromptAllowed=false` remain unchanged. No new store, MCP public tool,
runtime dispatch or consumer ChatGPT Web transport was added.

See [focused evidence](../docs/validation/codex-terminal-event-correlation-2026-11-11.md).

## Native goal-run legacy recovery admission (source-only)

The existing `goal_run.control.resume`, automatic Windows startup recovery,
and native goal-run status now check whether a persisted incomplete
`report.json` has a versioned runner scope fingerprint. Old/missing/invalid
bindings are held in `RECONCILE_REQUIRED`; the Node
`runReadOnlyGoal` verifies fingerprint **equality** with the exact
approved objective, repo/executable/data/STOP paths, limits and coding
file/QA-command scope before creating the Codex process. A stored SHA-256
hash is not a native credential or permission grant, and the Rust format
check is not independent attestation. This does not widen
`goal_run.turn_receipt` or activate `chat_goal.*`. Windows/Rust
execution remains NOT_VERIFIED on the combined source.
See [scope-binding validation](../docs/validation/goal-run-scope-binding-2026-11-11.md).

## Native Goal Run cooperative PAUSE — source only

Within the existing four-tool Rust desktop facade, `goal_run.control`
now implements cooperative `pause` and `resume` for the **already
approved** Codex goal-run path. The native host creates an exclusive
`<stopFile>.pause` marker; the Node goal runner stops starting new turns,
reconciles an acknowledged in-flight turn where safe, and persists
`PAUSED`. STOP and time limits still take precedence. The host
requires an exact paused checkpoint before clearing the marker and
restores it if a resume launch fails. Legacy scope fingerprints, uncertain
sends or conflicting terminal evidence are not silently cleared.

This neither activates `chat_goal.*` nor adds a public MCP tool,
a second durable state owner, a browser transport, or a free-standing
permission grant. Rust source/Node test coverage does **not** prove
Windows installed/native acceptance. See
[Goal Run pause QA](../docs/validation/goal-run-pause-2026-11-11.md).

## Multi-client source milestone — 12 November 2026

The **four top-level MCP tool names are unchanged**. Rust now defers desktop startup until the first privileged call; a Windows named mutex serializes concurrent cold starts. The native pipe accepts bounded parallel sessions (24 active requests with listener headroom) rather than processing every client sequentially. Workspace and goal operations use a host-derived Windows process identity (verified executable path, PID and creation time), with exclusive ownership and dead-process reclamation. Browser leases can be released explicitly without closing the WebView2 tab. These measures do not isolate cookies because all ten workspace views still share a WebView2 profile.

The internal Node goal gateway now admits two concurrent **read-only** approved Codex goals and rejects duplicate durable paths and simultaneous writers on the same checkout. This is not a second worker engine: OpenCode is currently a conforming MCP *client*, not a replacement goal execution backend. A future OpenCode worker needs its own host-verified permission sandbox, process/report format, recovery semantics and acceptance tests; the OpenCode default edit/shell permissions are too broad to inherit implicitly.

Sources, risk boundaries, executed Node fixture proof and Windows operator gates: [12 November universal MCP evaluation](../docs/validation/universal-mcp-multi-agent-2026-11-12.md). Rust changes are **SOURCE_COMMITTED / NOT_EXECUTED** until rebuilt and tested on Windows. No production ChatGPT Web transport, remote HTTP endpoint or OpenCode Browse integration was activated.

## Proposed universal worker architecture — not implemented

The current installed facade already supports more than one **client**, but goal execution is still Codex-only. The reviewed provider-independent design is [Universal Agent Orchestrator](../docs/architecture/universal-agent-orchestrator.md), with [migration QA gates](../docs/validation/universal-agent-migration-gates.md). Future implementations must preserve these four public tool names and the old Codex v1 behavior until each v2 adapter is independently verified. A client connection is not worker readiness; neither ACP nor A2A is silently enabled.

## Provider-neutral source runtime (12 November 2026)

The [v2 source runtime](../docs/validation/universal-agent-source-runtime-2026-11-12.md) now implements a host-injected read-only controller and Codex/OpenCode adapter source, using the canonical `PromptOutbox`. Native Windows source now exposes read-only Codex/OpenCode executable digests and routes a private v2 status query over the authenticated gateway. The source-only `NativeAgentRequestRouter` remains **unbound**, so actual worker dispatch stays blocked pending native approved-run lookup, per-action authorization, provider attestation and OS sandbox. Codex v1 remains unchanged. This is source/fake-host evidence, not native runtime acceptance.

## Native v2 prepared-scope source (12 November 2026)

The installed Rust MCP now exposes `agent_run.prepare/status/stop` as *capabilities* behind the same four tools. Native `agent_goal_authority.rs` persists a versioned read-only scope in the canonical `goal-runs` directory using the non-overlapping `.v2` filename. It requires a clean Git checkout and fixed repo/branch SHA, an allowlisted binary and SHA-256 digest, a real operator dialog, durable STOP, and source revalidation. `APPROVED_SOURCE_ONLY` does **not** give permission to dispatch or prove sandbox/QA readiness. v1 Codex data and old lifecycle remain unchanged. The authenticated internal `NativeAgentRequestRouter` is still unbound. See [Native Agent v2 authority](../docs/architecture/agent-v2-native-authority.md).

## Native-gateway callback bridge — source only

`GatewaySession::request_agent` now pumps up to eight bounded callbacks over
its existing authenticated Windows named pipe while awaiting one private
`lazyprompting/agent` stdio reply. A fresh request token and exact approved
`runId` prevent cross-request/cross-goal reads; the Node child must signal
completion before Rust waits for the stdio result. Only
`inspectPreparedRun` is implemented and it returns a sanitized status
projection from `agent_goal_authority.rs`. The main app window can query
this via `agent_gateway_inspect`, and the source-only `NativeAgentRequestRouter`
remains **unbound for worker execution**.

No public top-level MCP tool was added, no native execution grant is minted,
and no source/installer/native acceptance is implied. [Native v2 authority
owner](../docs/architecture/agent-v2-native-authority.md).

## Native source-to-gateway worker binding — source only

The source-only native `readApprovedSource` callback now carries one
host-derived, approved v2 worker/scope binding through the authenticated pipe.
Node validates the complete payload with `src/agent/native-source-binding.mjs`,
calculates the existing v2 scope fingerprint, and returns a sanitized
`SOURCE_BOUND_NO_EXECUTION` status to the main operator window. Binary
paths and objective text are never returned by that command. The requested
run ID and callback action are checked again by native Rust.

All provided runtime capability states are UNKNOWN/UNSUPPORTED, and the
policy hashes label unimplemented source intent: **no execution approval,
OS sandbox, native receipt attestation or independent QA is implied**.
Worker dispatch remains blocked. [Canonical native authority
owner](../docs/architecture/agent-v2-native-authority.md).

## Native execution-intent and action policy — source only

`agent_run.review_execution` is an additional **capability** behind the
existing four public MCP tools. It displays a native operator dialog and
persists one exact source-bound *intent* record under `goal-runs`, without
launching an agent. Native `executionReview` is separate from source
approval and remains non-executable even when `REVIEWED_NO_EXECUTION`.

For each private v2 start/observe/cancel/reconcile action the Node gateway
now requests native `evaluateAgentAction` on the existing authenticated,
run-bound callback pipe. The native policy returns only structured denials
until true OS sandbox enforcement, per-action execution consent and verified
provider receipts exist. Global read-only `status` remains available.
The original Codex v1 runner is unaffected. See [native authority owner](../docs/architecture/agent-v2-native-authority.md).

## Native unified compact browser observation — source only

The existing installed desktop executable now implements the direct
`browser observe workspace-XX [compact|delta]` CLI command. The command
and `workspace_browser.observe` MCP capability use the **same native
pipe**, authenticated process identity, workspace lease and host-owned
WebView2 AX observation. The Tauri operator must choose **Desktop only**
or **Workspace MCP/CLI client only** before granting one capture of a
selected HTTPS supporting tab after its native page-load Finished event.
Finished does not establish HTTP success, authentication or complete content.
The consent is bound to
workspace, native label, exact URL and page fingerprint, expires in
60 seconds and is consumed once. Neither CLI nor MCP can arm itself.

Only a bounded compact/delta accessibility-label projection is returned.
`#N` identifiers are display positions, not actionable browser refs.
Main ChatGPT, credential/value capture and unattended ChatGPT Web
automation remain excluded; accessible labels may still contain private
text and no full egress/DNS containment is claimed. Source tests are
authored, **not run**; installed Windows native and client acceptance are
pending. See [native browser implementation](../docs/architecture/browser-and-mcp-implementation.md).

## Unified selected-tab browser controls — source only

Installed `workspace_browser.*` MCP and direct CLI commands now use
the existing native `BrowserSupportTabs` router. `location` reads
the selected tab. MCP/CLI `navigate/back/forward/reload` operate only
on a selected support tab; main ChatGPT mutation is denied.
`open` creates/opens the ordinary ChatGPT main view, while an
external URL is held for the operator as `OPERATOR_TAB_OFFER_PENDING`.
Native pending offers survive a late desktop UI listener and are
resolved only by an explicit open/dismiss. No new public MCP tool,
external browser runtime, permission store or daemon is introduced.

Tab/workspace lifecycle changes revoke unused observation and download
grants. A browser snapshot is untrusted data, never an agent's
authenticated turn or independent QA result. Older installed MCP
receipts do not prove this revision works on Windows.

## Change policy

Add a capability to the canonical owner, update directly affected contracts and tests, then validate the smallest layer first. Keep the four tool names fixed unless a separately approved compatibility migration proves otherwise. Do not relocate Rust/Node entrypoints solely to make folder names look alike.
