# Code Mode–First — Confined Gateway Runtime

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
obtain or fabricate a native goal. The private native-to-Node transport
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

Only existing router read/pure handlers and the native-bound approved goal
status projection are reachable. **No browser, Codex worker execution,
file, GitHub, plugin, network, checkpoint mutation, ChatGPT consumer Web or
V2 worker effect is available through Code Mode**. Adding a new capability to the general
MCP catalog does not make it callable from code. This runtime's allowlist, the
existing schema validator and native client process identity are independent
gates. Future effectful calls require separate native grants, STOP, durable
idempotency/reconciliation, and independent QA.

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

The result uses the existing MCP `structuredContent` containing `value`,
`toolCalls`, `steps` and `mode:"READ_ONLY"`. Use `search_capabilities` and
`describe_capability` or invoke `code_mode.catalog` for discovery. No fifth
public MCP tool is introduced.

## Packaging and proof boundary

The gateway imports the MIT-licensed Acorn 8.15.0 parser pinned in the root
npm package and lock files. Windows gateway staging copies only Acorn's ESM
parser, package metadata and license from npm-installed source. It still
rejects all other unbundled bare imports. The existing build-pinned manifest verifies hashes of
staged bytes and read-only stage verification checks source parity.

Source tests: `tests/run-code-mode.mjs` plus existing gateway/packaging contracts.
Cases include multi-call composition, metadata search/describe, native-only
goal binding and rejection of forged scope/QA fields, selection/looping,
step/call limits,
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
