# Code Mode–First — Confined Gateway and Native Effect Broker

**Status:** Source-authored Code Mode; no current-revision installed/native/runtime acceptance.
**Owner:** `src/gateway/code-mode-runtime.mjs` (interpreter), existing
`capability-registry.mjs` / `capability-router.mjs` (call admission), and
`apps/desktop/src-tauri/src/` (authenticated client/host transport).
This is NOT an installation of the upstream OpenCode interpreter.

## What is implemented

`code_mode.catalog` and `code_mode.execute` are discoverable **capabilities**
behind the existing four MCP tools on both Node and installed-desktop source.
The Rust stdio facade forwards to its authenticated native host; the host
checks/starts the packaged gateway and uses a private native-originated
`lazyprompting/code` JSON-RPC route. A standalone client cannot access that
private method, although it can invoke the ordinary public Code Mode capability
of the standalone Node gateway.

Acorn 8.15.0 parses a limited JavaScript syntax. A repository-owned interpreter
walks its syntax tree; **it does not execute JavaScript through eval, Function,
node:vm, an OS shell or WebView**. Language support intentionally includes:
const/let declarations (no reassignment), top-level return, awaited calls,
arrays/objects, safe property reads, comparisons, Boolean expressions,
if statements, bounded for-of loops, local array push/slice/includes,
Object.keys, Array.isArray and arithmetic. Unsupported syntax fails closed.
This is not full JavaScript/TypeScript, nor a general-purpose sandbox for
arbitrary imported packages.

Code Mode can invoke only these two registered read/pure capabilities:
- `tools.supervisor.status()`
- `tools.supervisor.evaluate({input:{...}})`

An **installed native MCP client that already owns an approved Codex V1 goal
lease** may also supply the exact `runId` as an optional field on
`code_mode.execute`. Only then does `tools.goal.status()` become available
inside that one program. It accepts **no arguments**, so generated code cannot
select a different goal. This reads a bounded host-projected snapshot; it
does not start, pause, resume, STOP, dispatch, write or accept a goal.

Native Rust rechecks the process identity and the existing goal lease without
claiming a new lease, then verifies the canonical V1 record and persisted
operator approval. It projects the already-sanitized task states/check outcomes.
The gateway receives only `runId`, `baseSha`, `state`, `mode`,
`checkpointRevision`, `taskCount` and bounded task state/check fields with
`qa:"NOT_VERIFIED"`, `chatTurnVerified:false`,
`nextPromptAllowed:false`. Repository paths, acceptance/objective text,
worktrees, raw verifier changes, thread IDs, and agent messages remain native.
STOP/RECONCILE states cannot authorize continuation.

This goal binding exists **only on the installed native Rust MCP path**. The
standalone Node public `code_mode.execute` schema rejects `runId`; it cannot
obtain or fabricate a native goal.

An optional `workspaceId` in the native `code_mode.execute` requires the
**same client's pre-existing workspace lease**. Rust resolves the selected
supporting tab through the canonical native tab registry, rejects main ChatGPT
and unsupported HTTP/login origins, and projects only a bounded
`{source,workspaceId,tabId,origin,chatContentRead:false,nextPromptAllowed:false}`.
The gateway's `tools.workspace.location()` is a **zero-argument,
metadata-only read**, not a browser control API. Path, query, fragment and
page content never enter Code Mode. Native rechecks the lease and unchanged
origin before returning. Switching the active tab or changing the HTTPS origin during evaluation
invalidates the result. Same-origin path changes are intentionally not tracked
because paths are excluded from the projected data.

The public Node `code_mode.execute` schema also rejects `workspaceId`.
This extra binding does not expose Lightpanda, transfer credentials, grant
permission to visit a URL, or make ChatGPT consumer automation available. The private native-to-Node transport
accepts only the host-supplied bounded projection. Source unit tests may
inject synthetic projections, which do not prove real native authorization.

The metadata functions describe the **Node Gateway capability catalog**,
not every native Rust MCP capability. Catalog inspection is distinct from
permission to access an installed browser or an approved goal.

The Code Mode-only metadata functions (not independently registered MCP
capabilities) are:
- `tools.capabilities.search({query:"supervisor",limit:4})` — searches the
  existing gateway catalog with the same availability filtering as the
  public `search_capabilities` tool
- `tools.capabilities.describe({name:"supervisor.evaluate"})` — reads
  an existing capability's schema, effect, and readiness via the same owner
  as the public `describe_capability` tool

Metadata results cannot be invoked by name from inside Code Mode unless
separately present on its explicit read/pure allowlist. These metadata
functions share the same eight-call and result-size budgets, including when
looking up disabled or effectful capabilities.

Only existing router read/pure handlers and native-scoped read projections
(goal status and supporting-tab HTTPS origin) are reachable. **No browser
navigation/page read, Codex worker execution, file, GitHub, plugin, network,
checkpoint mutation, ChatGPT consumer Web or V2 worker effect is available
through Code Mode**. Adding a new capability to the general
MCP catalog does not make it callable from code. This runtime's allowlist, the
existing schema validator and native client process identity are independent
gates. Future effectful calls require separate native grants, STOP, durable
idempotency/reconciliation, and independent QA.

## Native-only ChatGPT goal health composition — 20 Nov 2026

The existing Rust stdio MCP facade adds the optional `goalWorkspaceId`
argument to `code_mode.execute`. It is **not** a selector available to
generated JavaScript: Rust requires the same MCP client to own that
workspace lease before and after the program, reads the canonical
per-workspace `CheckpointStore` from the native-bootstrapped gateway,
and injects only its validated status projection, including the monotonic `checkpointVersion` for stale-read detection. The interpreter
exposes `tools.workspace_goal.status()` (zero arguments).
Standalone Node Code Mode has no native goal binding and denies the call.

Example after an operator-approved `workspace_goal.prepare` and the
same client's workspace lease:

~~~javascript
const goal = await tools.workspace_goal.status();
const host = await tools.supervisor.status();
return {phase:goal.phase,revision:goal.goalRevision,
  review:goal.requiresReconciliation,
  qa:goal.qa,next:goal.nextPromptAllowed,host:host.gateway};
~~~

The installed native call uses `goalWorkspaceId:"workspace-01"` beside
the `code` string through the **existing four-tool MCP facade**.
No raw contract, ChatGPT transcript, cookie, branch secret, password,
worker launch or send authorization reaches generated code. Changed
status during evaluation invalidates the result, rather than reporting
stale READY. All new statuses deny ChatGPT delivery, source proof and
next-prompt authority. Code Mode's limits are not increased.

A synthetic `test:workspace-goal-native` compares an equivalent
multi-read structured output with one composed result. That measures
logical outer round trips only; no token/latency/RAM saving is claimed.
For a single status read, the direct MCP capability may remain cheaper.

**Gateway reuse:** the native `goalWorkspaceId` flow now probes and
authenticates the packaged gateway during its first status read, then uses
that **same** gateway for Code Mode and final status recheck. A missing
child/IPC at any subsequent step is a hold, never a silent restart between
source snapshots. This saves two repeated `tools/list` probes on that
source path, not two model calls. Native lease and status matching remain
mandatory. No latency/token saving has been measured.

**Protocol compatibility:** the Rust stdio MCP facade negotiates
`2025-03-26`; it intentionally still includes a JSON text fallback
beside `structuredContent` for older clients. This source change does
not claim to halve the MCP wire payload. Code Mode's advantage is
the bounded data projection when combining multiple permitted reads.

## Read-only expansion: V1 report/receipt, V2 status and recovery

**Codex V1 report:** `tools.goal.report()` is derived only from the
already owner-leased, approved, sanitized `tools.goal.status()` snapshot.
It returns recorded task/check states, the approved SHA and checkpoint
revision. These are runner records, not independently verified QA.

**One Codex V1 turn receipt:** Native `code_mode.execute` accepts
`receipt:{taskId,turnId}` only alongside the exact `runId`.
Rust validates the existing client lease, native approval and correlation
through its canonical `goal_run.turn_receipt` owner, and projects a
bounded receipt. Generated code calls `tools.goal.receipt()` with **no
arguments**; it cannot select a different turn. The response exposes
`recordedCompleted` and process-notification provenance but excludes
thread/prompt ID, worktree, agent text, credentials, and all claims of
`finalTurnHostAttested` or independent QA. STOP or invalid report scope
remains blocking. The same goal lease is rechecked before the MCP reply.

**Agent V2:** Native `agentRunId` (separate `agent:` lease namespace)
binds `tools.agent.status()` to `agent_goal_authority.rs`. Only V2
source/approval/reconciliation fields are returned. It cannot dispatch a
provider, produce evidence of actual execution, or upgrade
`executionReady:false`. Native status is rechecked before returning.

**Checkpoint recovery:** `tools.checkpoint.summary()` is available only
when the Node Gateway's original `CheckpointStore` is configured by the
host. It reads the existing recovery API, then returns a fixed projection:
`source`, `state`, `version`, `pendingTask`,
`requiresReconciliation`, `nextPromptAllowed:false`. No goal IDs,
repository paths, checkpoint payload, authorization or stored prompt text
reach Code Mode. A missing store is denied.

Each of these is a **Code Mode-only builtin**, not a new public MCP tool.
Public Node `code_mode.execute` cannot accept native `runId`,
`agentRunId`, `receipt` or `workspaceId`. Native access is restricted
to preexisting owner leases; no lease is created from generated code.

### Modular binding validation and workflow fixtures — 19 Nov 2026

`src/gateway/code-mode-bindings.mjs` owns only the schema-exact validation
of detached native snapshots; `code-mode-runtime.mjs` retains the
Acorn interpreter, capability allowlist and the existing import/re-export
surface for native validators. The new module does not mint host leases,
permissions, checkpoints or effect receipts. Gateway packaging already
follows relative ESM imports through its Acorn import graph.

`tests/run-code-mode-workflows.mjs` uses synthetic V1 goal/receipt
and checkpoint recovery to assert compact
read-only composition and denied foreign/public/forged bindings. It
keeps dispatch, ChatGPT output and independent QA outside the fixture. The existing `test:code-mode` entrypoint includes it.

### Source-only usage baseline

`npm run test:code-mode-usage` is an authored Node fixture comparing
separate MCP calls with one composed read-only program for supervisor
and canonical checkpoint recovery fixtures. It records JSON UTF-8 request/
response bytes and outer round trips, **not actual provider
token usage, latency, or user-PC behavior**. It asserts semantic output
equivalence, and does not assert any percentage saving; small programs may
cost more bytes than the separate calls. Real usage acceptance still needs
matched host/provider/tokenizer evidence at the exact checked-out revision.

## Code Mode–First full-migration target and native capability discovery

**Approved target:** All *AI-orchestrated* actions eventually flow through
Code Mode composition, with existing MCP tool names retained as
compatibility interfaces. This does not replace Rust host approval, the
Codex App Server, typed CLI adapters, the canonical checkpoint/outbox,
or native STOP. Effectful dispatch is NOT migrated in this source revision.

`tools.capabilities.native({query,limit})` exposes installed Rust MCP
capability metadata in the Code Mode interpreter. Its source is the
original Rust `CAPABILITIES` table and one native policy classifier,
not a second independent capability store. Each item includes an effect
class, required native permission gate and optional already-supported
Code Mode read-only alias. Every item says `invocableFromCode:false`:
discovering or describing a native effect does not grant it. Standalone
Node Code Mode has no installed-host catalog binding.

**Deterministic CLI step:** The native-only `tools.repo.status()` requires
the invoking MCP client to own an existing `agentRunId` (V2) and pass
`repositoryStatus:true` through the native `code_mode.execute` facade.
V2 native source authority checks its full approved scope digest,
worker identity, repository checkout, pinned branch/SHA and clean status
before the existing Git helper is called. Read-only `git status` is
fixed by the host (no model-selected CLI argv), and V2 scope/STOP is
revalidated after the command and after the Code Mode response.
The gateway gets only a bounded changed-entry count, whether the HEAD
equals approved SHA, and explicit `qa:"NOT_EXECUTED"` /
`nextPromptAllowed:false` flags. It never receives filenames, paths or
raw Git output. V1's older approval markers cannot grant this access.

**Effectful migration boundary:** `goal_run.start/control`,
`agent_run.prepare/review_execution/stop`, native browser navigation,
one-shot observation and debug fixture writes still belong to their
current native owners. The system needs a host-enforced, per-effect
durable reservation/consent/recovery contract before Code Mode may call
them. Passing a name in `tools.capabilities.native` is not an invocation.

## Native Effect Broker — first host-scoped action

The installed Rust facade advertises `code_mode.execute` as
`READ_OR_HOST_MANUAL_DRAFT` in capability discovery. Its native
effect classifier is `COMPOSITION_OR_HOST_DRAFT` under
`NATIVE_EFFECT_BROKER`. The standalone Node capability remains
read-only because it has no authenticated native callback.

The two permitted native Code Mode draft effects are
`tools.handoff.prepare({goal,acceptance,...})` for an initial draft and
`tools.handoff.continue({previousFingerprint,reply,nextStep?})` for
continuing the **exact pending** draft. Both require the outer native
`handoffWorkspaceId` and the invoking client's existing workspace
lease. The continuation reply is *caller-supplied, unverified text*;
neither its source nor ChatGPT session identity can be inferred from
the MCP client. Code Mode cannot select a different workspace or
mint operator approval.

Rust sends a fresh per-request token to its authenticated Node child.
The native pipe accepts at most **one** bounded
`workspace_chat.prepare_handoff` or private
`workspace_chat.continue_handoff` callback; even programs with no effect
must send `codeEffectDone`. The native callback rechecks the original
MCP client's lease, then uses the existing `PendingManualHandoffs`
inbox and desktop operator-review event. Initial duplicate drafts reuse
their fingerprint; a continuation may atomically replace only the exact
pending fingerprint. Other client edits, stale continuation requests,
restart loss and unknown effect outcomes remain blocked, not retried.
The client must still manually review and copy: `sent:false`,
`qa:"NOT_EXECUTED"`, `nextPromptAllowed:false` are retained.

The interpreter permits **one terminal awaited return** only. Its
receipt strips all draft text and retains only fingerprint, status
`DRAFT_ONLY` and operator-review indicators. Native acknowledgement
loss or invalid receipt yields `CODE_MODE_EFFECT_RECONCILE_REQUIRED`,
never a silent retry. All other native effects (CLI/write, browser
navigation/observation, agent start/stop and consumer ChatGPT send)
remain in their original native owners pending a durable action-level
permission/receipt contract. Four MCP public tool names are unchanged.

## Manual draft reconciliation — exact native owner, not durable replay

`tools.handoff.reconcile()` is a separate **zero-argument read-only**
Code Mode builtin. It requires `handoffWorkspaceId` on the outer
native MCP call and an already-owned lease for that exact workspace.
The original Rust `PendingManualHandoffs` owner emits only
`{source:"NATIVE_MANUAL_DRAFT_INBOX",workspaceId,state,
draftFingerprint,durability:"SESSION_MEMORY",retryAllowed:false,
sent:false,
operatorReviewRequired:true,qa:"NOT_EXECUTED",nextPromptAllowed:false}`.
`state` is `PENDING_REVIEW` (exact pending fingerprint) or
`EMPTY_UNVERIFIED` (null fingerprint).

Rust checks lease and inbox before handing the projection to the
interpreter. After a read-only Code Mode program, Rust rechecks that
the inbox has not changed. After a confirmed `handoff.prepare` or `handoff.continue` effect,
Rust instead requires the live fingerprint to match the returned draft.
Mismatches and lost acknowledgements block rather than retry. This is
a **session-memory, manual-recovery** mechanism, not durable outbox
reservation across a process restart. An empty inbox never proves that
a previous attempt was not applied, because the operator may have
dismissed a draft or the host may have restarted.

Future **durable** CLI, worker and browser actions still require
per-effect trusted host authorization, reservation before dispatch,
unambiguous acknowledgements, cancellation semantics and an explicit
`RECONCILE_REQUIRED` hold. Reuse the canonical replay/outbox/checkpoint
owners where their identity and domain actually match; do not use the
prompt outbox to misrepresent a manual draft as a sent ChatGPT turn.

## Contextual reply review — existing leased Code Mode only (source-only)

The authenticated Code Mode interpreter now offers one additional **read-only
builtin**, `tools.handoff.review({previousFingerprint,context,assessment})`.
It is not a fifth public MCP tool, a model/agent runner, or a new host-side
data owner. It reuses the already-attested `handoffWorkspaceId` and exact
`NATIVE_MANUAL_DRAFT_INBOX` fingerprint under the original native lease.

Codex is the existing client-side reasoner: the operator supplies the
**unverified** ChatGPT reply, and Codex supplies a structured assessment
grounded in its text and the user goal. The builtin does **not** call a
model, extract ChatGPT content, fetch credentials, or verify a claimed turn.
The client-reported session/task/response IDs, revision and content
fingerprint are correlation data, not native ChatGPT attestation.

The builtin validates the reply against
`src/prompt/conversation-reply.mjs`. The context and assessment are
strictly bounded, and foreign workspace, wrong previous draft fingerprint,
unknown context fields, missing turn tuple, replayed assessment, fake model
approval, claimed implementation/DONE without evidence, and inconsistent
decisions are denied or held. If the native approved goal status is
separately bound, STOP, DONE, foreign or unresolved goal state also denies
this review. Missing native goal status never becomes an implied grant.

For one valid assessment, it returns
`{source:"CODE_MODE_CONTEXTUAL_REVIEW",status:"REVIEW_CANDIDATE",
nextStep,previousFingerprint,inputFingerprint,decision,replyKind,...}`
with `operatorReviewRequired:true`, `nativeDraftChanged:false`,
`chatTurnVerified:false`, `sent:false`, `qa:"NOT_EXECUTED"`, and
`nextPromptAllowed:false`. A reply longer than the original native
800-byte `nextStep` limit returns `REVIEW_REQUIRED` rather than being
silently truncated. No native inbox state changes on a read-only review.

The **existing** terminal `tools.handoff.continue({previousFingerprint,
reply,nextStep})` may then stage the exact validated candidate in one
Code Mode program. When `handoff.review` was called in the same program,
the interpreter requires `nextStep` to match the reviewed text **exactly**
before invoking the native effect. A failed or held review cannot be
bypassed by a different post-review instruction. Separate Code Mode calls
still follow the previous manual native review and original fingerprint
rules; the read-only proposal is not a persistent authorization token.
Native Rust performs its normal lease, pending draft, and outbox check;
an acknowledged effect still means `DRAFT_ONLY`, not a ChatGPT send.

The original four public MCP names and Codex V1 run semantics remain
unchanged. The actual installed Windows Code Mode, model reasoning quality
and user-PC test results at this revision are `NOT_EXECUTED`.

### Decision quality, exact reply equality and incomplete goals

The Code Mode contextual review now requires a typed quality rubric
from Codex as part of its client-supplied assessment. Its per-criterion
ADDRESSED/MISSING/UNKNOWN coverage and CRITICAL/MAJOR/MINOR findings
are not treated as QA. A CRITICAL issue forces HOLD; MAJOR findings
justify revision; minor-only revision is rejected. Design-fit output
is advisory, not a verified acceptance or source-write grant.

If a native approved-goal status is supplied, the proposed
`goalId` and `goalRevision` must match the host projection, the
workspace must match, and only PAUSED/READY phases are admitted for
a read-only proposal. Goal contents and reply identity remain
unverified client data: the native compact projection does **not**
include the full goal hash/objective or ChatGPT final-turn receipt.

For a reviewed `handoff.continue` in the same Code Mode program,
the terminal effect must use **both** the exact original
`context.latestReply` and the exact reviewed `nextStep`.
A review cannot be followed by `handoff.prepare` in the same program;
a held or over-budget review must create no effect. If a supplied
`contextLimited` flag reports omitted evidence, the semantic review
also holds rather than inferring from a partial history.
This fixes a case where one answer could have been evaluated but
another text forwarded to Rust. The existing Code Mode broker's
3000-byte reply ceiling and 800-byte nextStep ceiling apply
before native effect: excess content produces REVIEW_REQUIRED,
not silent truncation, replay or additional tool authority.

## Agent V2 native effect policy — prerequisite, not authorization

The installed native `code_mode.execute` optionally accepts
`effectPolicy:true` **only with an existing owner-leased
`agentRunId`**. Rust evaluates the original
`agent_goal_authority.rs` per-action rules for four fixed
actions: `start`, `observe`, `cancel`, `reconcileReserved`.
Code Mode exposes the read-only, zero-argument
`tools.agent.effect_policy()` returning
`NATIVE_AGENT_V2_EFFECT_POLICY` with exact source run ID,
native source/review states, denial reasons, and constant
`admitted:false`, `reservation:"NOT_CREATED"`,
`executionReady:false`, `qa:"NOT_EXECUTED"`,
`nextPromptAllowed:false`. No caller/model-selected action ID,
reservation key or process executable is exposed. The gateway
validates the projection and requires its identity/state to match
the separately bound V2 status. Rust rechecks the scope lease and
unchanged policy before returning.

This policy **does not** reserve or dispatch a provider task.
The existing `ReplayLedger` and `RecoveryJournal` are associated
with agent-dispatch, `CheckpointStore` with canonical goal
transitions, and `PromptOutbox` with provider/prompt turns.
They must not be reused as if they were a durable manual-draft
inbox or be bypassed by Code Mode. Effectful agent admission remains
blocked until the trusted native host verifies an OS sandbox and
per-action grant, persists its exact dispatch reservation before
sending, and independently correlates the worker receipt.
An ambiguous delivery remains `RECONCILE_REQUIRED`, never an
auto-retry. These execution gates have NOT been enabled here.

## Limits and result projection

- Maximum 4,096 UTF-16 source units; 8 capability calls.
- Maximum 1,500 interpreter steps, 32 iterations per for-of and depth 32.
- 2-second checked deadline. This is sufficient only for the admitted local
  synchronous read/pure handlers; future async/network calls require stronger
  cancellation and execution isolation.
- Maximum 16,000 JSON characters per intermediate result and 6,000 final
  structured characters. Results are copied into JSON data, not exposed as
  callable host objects. Error responses contain fixed codes.
- One final structured result returns to the model; intermediate tool outputs
  remain inside the gateway. `toolCalls` and `steps` are counters, not a token
  saving or latency benchmark.

Example invocation through the existing four-tool MCP facade:

~~~json
{"name":"invoke_capability","arguments":{"name":"code_mode.execute","arguments":{"code":"const s = await tools.supervisor.status(); return {gateway:s.gateway};"}}}
~~~

For a native client that already owns an approved goal lease, an example is:

~~~json
{"name":"invoke_capability","arguments":{"name":"code_mode.execute","arguments":{"runId":"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef","code":"const g=await tools.goal.status(); return {state:g.state,qa:g.qa,next:g.nextPromptAllowed};"}}}
~~~

The sample `runId` is an illustrative format, not an actual approved goal.

For a client with an existing workspace lease and selected HTTPS supporting tab:

~~~json
{"name":"invoke_capability","arguments":{"name":"code_mode.execute","arguments":{"workspaceId":"workspace-01","code":"const t=await tools.workspace.location(); return {origin:t.origin,tab:t.tabId};"}}}
~~~

This example does not read ChatGPT main, page text or user credentials.

The result uses the existing MCP `structuredContent` containing `value`,
`toolCalls`, `steps` and `mode:"READ_ONLY"` for reads,
or `mode:"HOST_MANUAL_DRAFT"` for an acknowledged draft effect. Use `search_capabilities` and
`describe_capability` or invoke `code_mode.catalog` for discovery. No fifth
public MCP tool is introduced.

## Packaging and proof boundary

The gateway imports the MIT-licensed Acorn 8.15.0 parser pinned in the root
npm package and lock files. Windows gateway staging copies only Acorn's ESM
parser, package metadata and license from npm-installed source. It still
rejects all other unbundled bare imports. The existing build-pinned manifest verifies hashes of
staged bytes and read-only stage verification checks source parity.

Source tests: `tests/run-code-mode.mjs` plus existing gateway/packaging contracts.
Cases include multi-call composition, metadata search/describe, owner-sourced
native capability policy discovery and denied Agent V2 per-action preflight,
V2-approved deterministic Git summary,
native-only goal/turn-receipt/Agent V2 and support-origin bindings, checkpoint
recovery projection, exclusion of private IDs/URLs/paths, STOP/QA denial,
selection/looping, step/call limits,
denied globals, privileged calls from generated code and denial of private
RPC from standalone mode. **TEST_AUTHORED_NOT_RUN** in this ChatGPT/GitHub phase.

Before an installed or performance claim, independent user-PC verification
must cover npm lock install, runtime/parser semantics, gateway staging, Rust
build, installed MCP routing, negative security cases, and tokens/task at the
exact source revision. The selected local validation phase is deferred;
source commits are not a Windows test receipt.

## Long-term compatibility and holds

Code Mode–first is the selected direction for composition and context efficiency,
but no unverified write/tool effect is silently promoted. The Cloudflare
and OpenCode Code Mode designs and MCP programmatic tool calling remain
reference sources, not installed implementations:
- https://blog.cloudflare.com/code-mode-mcp/
- https://github.com/anomalyco/opencode/tree/dev/packages/codemode
- https://modelcontextprotocol.io

Future interpreter replacement requires equivalent denial fixtures,
bounded outputs, license review, package integrity and native proof.
Cloudflare's 99.9% figure is not a LazyPrompting benchmark. Unattended
consumer ChatGPT Chat send/extraction remains separately blocked.

### Lightpanda indexed preview gate (16 Nov 2026)

The experimental local-preview `lightpanda.snapshot({view:"index"})`
is *not* callable inside Code Mode, and indexes are not executable
native handles. A separately approved, one-use native read now
projects the semantic tree inside the signed gateway, still without
page-action permission or a reusable native cursor. Preserve
host-only admission, page identity and no-ChatGPT-Web restrictions.

## Lightpanda review is not a Code Mode tool (16 Nov 2026)

The gateway's experimental `lightpanda.review` is a host-admitted
local-preview, **read-only** target recheck. It is deliberately
absent from the confined Code Mode allowlist and unsupported on
installed native Rust. The new native index read does not enable
native target review. A review response never enables an
operation or certifies browser/ChatGPT success.

## Fixed offline fixture action does not grant Code Mode browser access

The 16 Nov 2026 source adds an operator-confirmed native Tauri
`lightpanda_preview_action` for one hard-coded offline checkbox
or search-field effect with a durable outbox and independent readback.
It is intentionally **not** in the Code Mode allowlist, the four
public MCP methods or the JavaScript Lightpanda review adapter.
No model-supplied selector, action token, URL, credentials, DOM
fragment or grant crosses this boundary. The source path and
negative tests have not yet passed installed Windows/WSL acceptance.
