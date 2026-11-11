# MCP Architecture and Ownership — LazyPrompting

**Canonical boundary map.** Source paths are current implementation owners; design documents are not substitutes for observed runtime proof. See [current state](../docs/operations/current-state.md) for pinned evidence and unresolved acceptance.

## Four distinct surfaces

| Surface | Entrypoint / owner | Intended caller | Scope |
| --- | --- | --- | --- |
| Installed desktop MCP | `apps/desktop/src-tauri/src/mcp_stdio_host.rs` (`lazyprompting-desktop.exe mcp`) | Codex client on the installed Windows host | `workspace_browser.*` and `goal_run.*` through the local native host |
| Packaged internal gateway | `src/gateway/mcp-gateway.mjs`, `src/gateway/capability-router.mjs`, `src/gateway/capability-registry.mjs` | Desktop-owned gateway child / controlled internal client | Supervisor, checkpoint, optional browser and native-admitted Lightpanda capabilities |
| Legacy Node MCP | `src/mcp/server.mjs` | Opt-in compatibility or isolated test only | Old standalone supervisor/browser tool names; **not** the desktop public endpoint |
| ChatGPT arithmetic probe | `src/mcp/chatgpt-probe.mjs`, `src/mcp/chatgpt-probe-widget.mjs` | Explicitly configured test plugin / isolated probe | Disposable synthetic math; not a production task transport |

Codex preview tool calls also use `src/transport/codex-preview-tools.mjs` as a **host-scoped bridge**, not a fifth interchangeable MCP endpoint.

## Two separate client paths

```text
Codex MCP client
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

## Public-tool contract

Both the installed Rust facade and the internal Node gateway expose the four **names** `status`, `search_capabilities`, `describe_capability`, `invoke_capability`. Their capability catalogs and trust channels **differ**; sharing these names does not make the endpoints interchangeable.

- Rust desktop capabilities: `workspace_browser.open`, `navigate`, `location`, `back`, `forward`, `reload`; `goal_run.start`, `status`, `report`, `control`.
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

Shared demand-driven backend lifecycle belongs to `src/runtime/backend-lifecycle.mjs`; `src/gateway/backend-lifecycle.mjs` is only a compatibility re-export. The Codex transport imports the runtime owner directly, avoiding a transport → gateway back-edge.

## Safety and lifecycle invariants

1. The operator selects branch and approves mutations. No inferred cross-repository write, merge, release, CI dispatch or browser-session extraction.
2. Native host owns consent, process identity, bounded workspaces, revocation and private browser grants. Stdio `initialize` is **not** authentication.
3. Do not replay uncertain mutations or unacknowledged Codex turns; reconcile exact receipts first. Stop/pause and branch boundaries are authoritative.
4. WebView2 and Lightpanda have separate process/session identities; the experimental probe is a third, unrelated transport.
5. Static/source checks are not native or live acceptance. See [system contract](../docs/architecture/system-contract.md), [goal-run contract](../docs/architecture/goal-run-mcp.md), [security](../docs/governance/security-and-compliance.md) and [validation router](../docs/validation/README.md).

## Proposed Codex-supervised ChatGPT Chat target — NOT IMPLEMENTED

The operator selected a new *design target*: Codex receives one authorized goal, supervises an existing ChatGPT ordinary/Personalized Temporary Chat workspace using GitHub project evidence, and requests a **minimal** browser status/send adapter where permissioned. See [canonical proposed control contract](../docs/architecture/codex-chat-workspace-plan.md) and [gated QA](../docs/validation/codex-chat-workspace-gates.md). Planned `chat_goal.*` and `workspace_chat.*` capabilities are not registered; they must remain behind the same four public MCP names and must not replace existing `goal_run.*` worktree semantics. No extension or ChatGPT auto-loop has been activated.

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

## Change policy

Add a capability to the canonical owner, update directly affected contracts and tests, then validate the smallest layer first. Keep the four tool names fixed unless a separately approved compatibility migration proves otherwise. Do not relocate Rust/Node entrypoints solely to make folder names look alike.

