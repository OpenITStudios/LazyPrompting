# LazyPrompting MCP — Entry Points

The installed Windows client MCP and the packaged Node gateway are **two different surfaces**, even though each exposes four discovery/invocation tool names. Read the [canonical MCP architecture](ARCHITECTURE.md) before changing tools or packaging.

| Use case | Entry point | Status |
| --- | --- | --- |
| Local control of installed desktop from any conforming MCP client | `lazyprompting-desktop.exe mcp` (Rust) | Native, host-mediated capabilities |
| Desktop internal supervisor / Lightpanda transport | `npm run start:mcp:gateway` / packaged `src/gateway/mcp-gateway.mjs` | Internal Node gateway; requires trusted native channel for privileged operations |
| Old standalone Node surface | `npm run start:mcp:legacy` | Compatibility/debug only; not a production facade |
| Synthetic ChatGPT transport experiment | `npm run start:mcp:probe` | Opt-in, arithmetic-only; never a production automation path |
| ChatGPT goal-bound plugin contract (source-only) | `src/mcp/chat-goal/` | Not exposed as an HTTP endpoint; requires OAuth and authenticated native host adapter |

Register the installed executable as a stdio MCP in Codex as shown in [Windows setup](../apps/desktop/README.md#control-that-browser-from-codex). The desktop facade offers `workspace_browser.*` (open/navigate/location/back/forward/reload/release), Codex v1 `goal_run.*` (start/status/report/control/turn_receipt) and v2 source-only `agent_run.*` (prepare/status/stop) via `status`, `search_capabilities`, `describe_capability`, and `invoke_capability`. Actual capability admission remains owned by the native host.

## Code Mode–first capability (source only)

Use `search_capabilities` with `"code_mode"`, then
`describe_capability` for `code_mode.catalog` and `code_mode.execute`.
Call the latter through the existing `invoke_capability` tool:

~~~json
{"name":"invoke_capability","arguments":{"name":"code_mode.execute","arguments":{"code":"const s = await tools.supervisor.status(); return {gateway:s.gateway};"}}}
~~~

The bounded JavaScript subset supports composition and projection of **only**
the pure/read supervisor operations listed in `code_mode.catalog`.
Code Mode also supports `tools.capabilities.search({query,limit})`
and `tools.capabilities.describe({name})` to inspect the *existing* MCP
catalog inside one program. These are metadata-only functions: they do not
grant permission to execute the discovered capability.

**Owner-bound goal status:** The installed Windows Rust MCP facade accepts an
optional `runId` alongside `code` on `code_mode.execute`, but only if the
same authenticated MCP client already owns the corresponding approved Codex V1
goal lease. The program can then call `tools.goal.status()` without arguments.
The returned status is sanitized native data, not a new dispatch, QA or ChatGPT
transport capability. Node's standalone public Code Mode never accepts this
`runId` field. No lease is created by Code Mode. See
[Code Mode runtime](../docs/architecture/code-mode-runtime.md).

**Owner-bound supporting-tab origin:** An installed native MCP client may
add `workspaceId` to `code_mode.execute` only when it already owns that
workspace lease. `tools.workspace.location()` then returns the selected
HTTPS supporting tab's `origin` and `tabId`, with path, query, fragment
and page contents omitted. The protected ChatGPT main tab and OpenAI login
origins are denied; no navigation or browser observation is performed.
Code Mode rechecks ownership and unchanged origin before returning.
Standalone Node MCP cannot pass `workspaceId` to the public Code Mode tool.

**Additional read-only composition (source):** `tools.goal.report()`
returns the existing sanitized V1 task/check status, not raw worker text.
To bind one exact correlation through native `goal_run.turn_receipt`, include
`runId` and `receipt:{"taskId":"task-1","turnId":"..."}` in the outer
`code_mode.execute` arguments. Only then may the generated program call
`tools.goal.receipt()`, with no arguments. It excludes native thread/prompt
IDs and never upgrades `recordedCompleted` into independent QA.

The optional native `agentRunId` refers to a **separately owner-leased**
Agent V2 scope. `tools.agent.status()` returns approved-source, STOP or
reconciliation indicators but always `executionReady:false`,
`qa:"NOT_EXECUTED"`, `nextPromptAllowed:false`. V1 and V2 leases are
distinct. `tools.checkpoint.summary()` derives only state/version/pending
presence from the existing configured CheckpointStore, never the raw
checkpoint; unconfigured storage is unavailable. Neither feature
starts/resumes workers, writes files or sends a ChatGPT message.

**Unified native discovery and deterministic CLI read (source-only):**
`tools.capabilities.native({query,limit})` searches the actual installed
Rust MCP facade's existing capability catalog from inside one confined
program. Every entry includes its effect category, native permission owner,
optional Code Mode read alias, and `invocableFromCode:false`.
Discovery is metadata, never authorization to invoke by name.

`tools.repo.status()` requires `agentRunId` plus
`repositoryStatus:true` on the outer native `code_mode.execute`.
Only an existing client-owned Agent V2 scope whose exact repository,
executable identity, branch and SHA still match approved source may use
the host's existing Git CLI helper. Returned data is count/equality
metadata only. No paths, filenames, command arguments, arbitrary shell,
Git output or executable access are passed to JavaScript.
Legacy Codex V1 markers intentionally do **not** authorize this CLI read,
because they lack V2's complete immutable approval digest.

**Agent V2 native effect preflight (source-only):** Add
`effectPolicy:true` alongside the existing `agentRunId` in the
outer native `code_mode.execute`. Generated code can then call
`tools.agent.effect_policy()` (zero arguments). The original Rust
`agent_goal_authority.rs` evaluates start, observe, cancel and
reconcileReserved against the exact persisted V2 scope/STOP.
Results are sanitized and always `admitted:false`,
`reservation:"NOT_CREATED"`, `executionReady:false`,
`qa:"NOT_EXECUTED"`, `nextPromptAllowed:false`.
There is no grant, persisted reservation, worker dispatch, or
automatic retry. Native rechecks policy and lease before return.
A source-approved worker is not executable without sandbox,
per-action admission and canonical outbox/replay receipts.

**Native manual draft effect (source only):** On the installed Rust facade,
`code_mode.execute` is classified `READ_OR_HOST_MANUAL_DRAFT`;
the standalone Node capability remains read-only. The native facade
optionally accepts `handoffWorkspaceId` that its
verified caller **already owns**. A confined program may end with exactly
one `return await tools.handoff.prepare({goal,acceptance,...})`. Rust checks
the original caller/lease, validates the bounded request, and stages the
draft through the existing native pending inbox. Code Mode returns only
a fingerprint and `sent:false`; the operator still reviews/copies the draft.
No ChatGPT send/response access, arbitrary shell, worker dispatch or
browser navigation is granted. Uncertain outcomes require inbox
reconciliation, never automatic replay.

**Reconcile manual draft:** Using the same already-owned
`handoffWorkspaceId`, call
`tools.handoff.reconcile()` (zero arguments) inside `code_mode.execute`.
It reads the **original** `PendingManualHandoffs` status, returning only
`PENDING_REVIEW` with the fingerprint or `EMPTY_UNVERIFIED`, plus
`durability:"SESSION_MEMORY"`. It never returns the draft body, sends a
message or authorizes a new attempt. Rust compares the snapshot before
and after Code Mode; an acknowledged draft must match the live inbox
fingerprint. Empty/unavailable status after restart or operator dismissal
does not establish that a lost operation was never applied. A durable
reservation ledger for other native effects remains **not implemented**.
Unknown tools, OS globals, imports, browser/worker/file effects and recursive
Code Mode calls are denied. The single native manual-draft effect is explicitly
scoped; it never sends content to ChatGPT. The Node gateway's private Code Mode RPC is
native-host-only, not a fifth public MCP tool or permission grant.
This is **SOURCE_COMMITTED / NOT_EXECUTED** on the current branch,
not current Windows installed acceptance. See the
[Code Mode architecture](../docs/architecture/code-mode-runtime.md).

## Use the desktop MCP from any MCP client

The installed facade speaks the standard MCP stdio transport, so it is not Codex-only. Any conforming client works: Claude Desktop, Claude Code, OpenCode, Cursor, VS Code, Windsurf, Zed, or the official MCP Inspector. Register the **installed** executable and keep the same four public tool names.

```json
{
  "mcpServers": {
    "lazyprompting": {
      "command": "C:\\Users\\Administrator\\AppData\\Local\\LazyPrompting\\lazyprompting-desktop.exe",
      "args": ["mcp"]
    }
  }
}
```

| Client | Where to register |
| --- | --- |
| OpenCode | `~/.config/opencode/opencode.jsonc` → `{"mcp":{"servers":{"lazyprompting":{"type":"local","command":["C:\\Users\\Administrator\\AppData\\Local\\LazyPrompting\\lazyprompting-desktop.exe","mcp"]}}}}`, or `opencode mcp add lazyprompting --global -- "<installed exe>" mcp` |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (the `mcpServers` shape above) |
| Claude Code | `claude mcp add lazyprompting -- "C:\Users\Administrator\AppData\Local\LazyPrompting\lazyprompting-desktop.exe" mcp`, or the same JSON in `.mcp.json` |
| Cursor | `~/.cursor/mcp.json` (the `mcpServers` shape above) |
| VS Code | `.vscode/mcp.json`: `{"servers":{"lazyprompting":{"command":"C:\\Users\\Administrator\\AppData\\Local\\LazyPrompting\\lazyprompting-desktop.exe","args":["mcp"]}}}` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` (the `mcpServers` shape above) |
| Zed | `settings.json`: `{"context_servers":{"lazyprompting":{"command":{"path":"C:\\Users\\Administrator\\AppData\\Local\\LazyPrompting\\lazyprompting-desktop.exe","args":["mcp"]}}}}` |
| MCP Inspector | `npx @modelcontextprotocol/inspector --cli "C:\Users\Administrator\AppData\Local\LazyPrompting\lazyprompting-desktop.exe" mcp --method tools/list` |

`npm run register:mcp` prints the exact snippet and file path for every
supported client, and `--apply` runs a client CLI that owns its own
configuration file. The script refuses anything except the installed
executable, because the native host verifies the pipe client path.

OpenCode V2 keeps servers under `mcp.servers`. Its default Code Mode groups
the four tools; set `"codemode": false` on the server to expose them directly
on the model's native tool list.

Two operational rules:

- Register the **installed executable** directly. The native host verifies the pipe client's executable path, so a wrapper script or a copied binary is refused with `BROWSER_MCP_CLIENT_NOT_TRUSTED`.
- The MCP facade answers the protocol handshake and read-only `status` without starting the GUI. The first privileged browser or goal call starts the desktop host when needed. A cross-process startup mutex prevents duplicate launches. Starting the host grants no permission: the operator still approves material mutations.
- A native lease binds each browser workspace and goal to its verified stdio client process identity (Windows PID plus creation time). A second live client receives `WORKSPACE_OWNED_BY_OTHER_CLIENT`; `workspace_browser.release` frees only that workspace without closing the tab. When the owner process exits, another client may reclaim it. Goal leases are reclaimed after owner exit.
- **Isolation limit:** WebView2 workspace tabs still share one browser profile/cookies. These leases separate *control*, not web credentials. Do not expose signed-in tabs to untrusted clients.

The facade answers `initialize`, `ping`, `tools/list`, `tools/call`, and reports empty `resources/list` and `prompts/list` so clients that probe those methods do not see protocol errors. A nested capability `arguments` value may be sent as a JSON object or as a JSON string; both are parsed and validated identically.

**Native pipe deadlines (source contract):** Request-framing, response-write and
post-response acknowledgement I/O are individually bounded to five seconds.
The native host no longer cancels a running privileged handler merely because
an I/O timer elapsed. Known read-only requests have a five-second client
response wait; requests that may cause an effect have a bounded 120-second
response wait. A lost response after an effectful request was attempted returns
`BROWSER_MCP_EFFECT_RECONCILE_REQUIRED`: this means the outcome is unknown,
**not** that the action failed or was cancelled. Do not automatically resend.
The underlying owner-specific STOP, lease and durable reconciliation gates
still decide whether a new action is permitted. This is source behavior,
not proof that installed MCP-client timeouts permit the full wait.

## One-command setup for every client

`npm run setup:local` targets eight known MCP clients. It uses a client CLI when available and can also merge configuration files for clients not installed. The independent verifier executes the **installed LazyPrompting MCP server**, not each client's agent session; the setup exits nonzero if registration or protocol verification fails.

```powershell
npm run setup:local              # dry run: shows what would change
npm run setup:local -- --apply   # writes the registrations and verifies them
npm run setup:local -- --apply --client opencode
```

- A client that owns its own configuration file is changed through its own CLI (`codex mcp add`, `opencode mcp add`, `claude mcp add`).
- Other clients get their configuration merged in place, with a timestamped backup of the previous file. Existing servers and unrelated settings are preserved, and the merge is idempotent.
- A configuration file that is not plain JSON is never rewritten; the script reports it and prints the snippet to paste.
- The script refuses to register anything except the installed executable.

Workspace browser tabs share the first workspace WebView2 profile but do **not** share state with Lightpanda. OpenCode Browse is a *third*, separately installed and permissioned Chrome-extension MCP, not an embedded WebView2/Lightpanda backend; do not install or pair it without the operator's explicit choice. The internal Node gateway's supervisor/preview capability names are separate from the desktop catalog.

The internal goal gateway now admits at most two concurrent goals with distinct durable paths. Two read-only goals may inspect one checkout; a writer is exclusive to its repository. **Goal execution still uses Codex**, regardless of whether the controlling MCP client is OpenCode, Cursor, etc. See [multi-client implementation evidence](../docs/validation/universal-mcp-multi-agent-2026-11-12.md).

## Agent v2 native scope preparation — SOURCE ONLY

Four additional **capabilities** are available through the **same four top-level MCP tools** on the installed Windows desktop facade: `agent_run.prepare`, `agent_run.status`, `agent_run.review_execution` and `agent_run.stop`. These operations are not available on the standalone internal Node gateway.

- `agent_run.prepare`: operator reviews one read-only goal (one acceptance criterion), the selected `codex-local` or `opencode-local` worker profile, workspace, clean local Git checkout and immutable binary digest. The host creates a `<requestId>.v2.json` source record and requests a native approval dialog. **It does not run the worker.**
- `agent_run.status`: reads that exact prepared run by `runId`, including `AWAITING_OPERATOR`, `DECLINED`, `APPROVED_SOURCE_ONLY`, `RECONCILE_REQUIRED` or `STOPPED`. Approved scope and Git baseline are rechecked; `executionReady=false` always.
- `agent_run.review_execution`: separate native operator dialog records source-bound **future execution intent**. This never launches a worker or mints a runtime permission grant. The same run cannot auto-repeat a pending review after a crash.
- `agent_run.stop`: persists an immutable STOP marker; it cannot be used to authorize, resume or dispatch a worker.

Existing Codex `goal_run.*` v1 files and approvals remain unchanged. v2 request IDs may not alias v1 IDs. A client cannot prepare a goal on a browser workspace owned by a different live installed MCP client. WebView2 tabs still share a profile; neither the lease nor a source digest is an OS permission boundary. The next source milestone is authenticated native-host v2 attestation, isolated worker execution and independent QA; until those are implemented the private `lazyprompting/agent` router stays **unbound**.

See [Native v2 approval source contract](../docs/architecture/agent-v2-native-authority.md).

## Codex / OpenCode → ordinary ChatGPT manual handoff

The installed **same four MCP tools** now advertise `workspace_chat.prepare_handoff`, a safe read-only capability for **both Codex and OpenCode** as MCP clients. Discover with `search_capabilities` (query `chat handoff`), inspect `describe_capability`, then invoke it with `workspaceId`, `goal`, `acceptance` and optional client-supplied `repository` (owner/repo), `branch`, `baseSha`, `nextStep`.

The native host validates the entire request first, then checks the stdio client's executable identity and holds the existing **workspace client lease** before returning a bounded draft; a second live MCP client cannot seize that workspace. The receipt is **`DRAFT_ONLY`**, with `delivery=MANUAL_COPY_PASTE`, `sent=false`, `sessionVerified=false`, `resultVerified=false`, `qa=NOT_EXECUTED`. The operator reviews the prompt and pastes it into the desired **ordinary ChatGPT Chat**. This capability neither creates a chat nor contacts ChatGPT, reads replies, records a worker receipt, alters a Git repository, or constitutes scope approval. A client-supplied base SHA is explicitly *unverified*.

The existing `workspace_browser.open` can show the signed-in ChatGPT page. It is a separate browser operation and does not prove actual ChatGPT chat mode or exact conversation ID. The ChatGPT consumer auto-send/result transport remains disabled; Codex V1 `goal_run.*` continues to run only its separately approved coding worktrees; the OpenCode execution-worker V2 remains source-only. Native Rust tests and latest Windows installed acceptance must be executed on the new SHA.

The desktop UI also supplies **Save chat link / Reopen saved / Forget link** controls. These operate on a validated URL of an ordinary ChatGPT conversation **only after a user click**. They are not MCP operations, do not capture account sessions or replies, and never send prompts. [Desktop recovery guide](../apps/desktop/README.md#remember-or-reopen-an-existing-chatgpt-conversation).

## ChatGPT web probe

Run `npm ci` at the repo root, then `node src/mcp/chatgpt-probe.mjs`. The probe prints a loopback MCP URL and five one-time binding codes. Use a private Secure MCP Tunnel if available. For disposable arithmetic only, a temporary HTTPS development tunnel can forward to `127.0.0.1:38764`. Keep the randomly generated MCP path when replacing the URL origin with the tunnel origin.

In ChatGPT, add the endpoint as a custom MCP plugin. Start a fresh Work conversation in Browser 01, select the probe plugin using `@`, and ask it to call `bind_probe` with Browser 01's code. The widget requests the first message, then requests the second after the model reports the correct first answer through MCP. Verify both turns in that conversation and compare with the numeric results written to server stderr. Repeat with the other codes after the first chat works. Classic Chat did not consistently retain the reporting tool on widget-originated turns.

This experimental server accepts synthetic arithmetic only. It keeps probe state in memory for 30 minutes. After a claimed send, it waits for that turn's receipt and does not replay the message. Restart invalidates all codes and normally rotates the URL. For repeat tests with the same plugin registration, `LAZY_CHAT_PROBE_ENDPOINT_KEY` can reuse the private 48-character endpoint path segment. Stop the probe and its tunnel after testing.

Run `node --test tests/chatgpt-probe.test.mjs` for the local MCP protocol check. Live ChatGPT widget delivery and background tab behavior require a separate browser check.

For a single Browser 01 test, set `LAZY_CHAT_PROBE_ADAPTIVE=1` before launching the probe. ChatGPT's first tool callback reports its choice of `2` or `3`. The server uses that choice to send a different second prompt via the widget and stops after the result. Live acceptance requires both callbacks in the same ordinary ChatGPT chat after a single bind. The probe uses synthetic numbers only.

For a Chat-mode retest, follow the same setup in a fresh Chat conversation and select the plugin only for the initial binding. A successful run records two `answer` events for the same workspace. The `claimed` and `host_send_response` events distinguish widget reservation from the host's response to the send request. An accepted send request alone is not evidence of an answer. If an answer is missing, keep the conversation as evidence instead of resending the probe prompt.


## Goal-bound ChatGPT plugin bridge — source only (19 November 2026)

The modular, **not yet deployed** goal contract lives in `src/mcp/chat-goal/`:

- `contract.mjs` validates only four narrowly scoped operations and host receipts.
- `bridge.mjs` delegates each request once to caller-injected authentication and an independently authorized native effect. It holds uncertain results and owns no scheduler, state or outbox.
- `oauth-authenticator.mjs` accepts verified OAuth resource-server grants, rejects invalid issuer/audience/scope/expiry and can form the standard metadata challenge. It does not implement an OAuth server or token verification backend.
- `tools.mjs` registers `goal.bind`, `goal.report`, widget-only `turn.claim`, and widget-only `turn.delivery` against a supplied verified MCP host; there is no executable server here. All four require OAuth scope `chat_goal:operate`.
- `widget.mjs` is an unbundled MCP Apps UI source that requests one host-reserved follow-up in its own hosting conversation and never auto-retries.

`npm run test:chat-goal-bridge` is a deterministic contract suite (auth refusal, untrusted reports, private claim projection, unknown delivery and tool visibility). **Auth issuance, native host IPC, plugin endpoint, widget bundling, true ChatGPT turn receipts, Codex orchestration, and Windows runtime are not connected.** Do not replace the synthetic probe or treat this source as automatic consumer ChatGPT transport. Code Mode and the installed four-tool desktop facade are unchanged. Any live binding must first supply a verified OAuth resource server, an authenticated native host transaction against the existing PromptOutbox/checkpoints and a supported chat-host callback; absent these, fail closed.

### Private native plugin intent (source-only)

The installed Rust `GatewaySession.chat_plugin_intent_outbox` has a private, dormant `lazyprompting/chatPluginIntent` transport to the packaged Node gateway. Actions are `reserve`, `bind`, `hold`, and read-only `pending`, backed by the existing `PromptOutbox` lock. An unknown result stays held. No Tauri command, external HTTP MCP endpoint, OAuth issuer, browser automation, final-answer callback or public capability uses this method. The approved native goal/session binding is **not yet implemented**; the Rust method has no application caller. The source does not authorize a ChatGPT message. `npm run test:gateway` and Rust private-RPC denial fixtures are authored but have not run at this commit.


### Trusted OAuth admission — source only

`createChatGoalOAuthAuthenticator` requires a separately trusted `verifyAccessToken(requestContext,{issuer,audience,requiredScope})` provider. That provider must verify bearer signature or perform opaque-token introspection, account identity, revocation and consent: **do not** return a decoded unsigned JWT, user-supplied flag or raw `extra.authInfo` as verified. The adapter checks HTTPS issuer/resource, exact audience, expiry, not-before, `chat_goal:operate` scope and opaque account/connection identifiers. A `chatSessionHint` is **not** WebView2 conversation identity.

A configured HTTPS protected-resource metadata URL enables the standard `mcp/www_authenticate` challenge on authentication failures. Each of the existing four plugin tools still declares OAuth; widget-only tools use the supported `_meta.ui.visibility`, without deprecated `openai/visibility`. The offline `npm run test:chat-goal-oauth` fixture is registered in the existing manually selected preflight and is `TEST_AUTHORED_NOT_RUN`.

There is no actual identity provider, JWKS/introspection verifier, HTTPS MCP endpoint, ChatGPT OAuth consent, native Rust caller or live goal action. A token check is **not** approval to send or read a ChatGPT turn. The official [OpenAI plugin authentication guide](https://developers.openai.com/plugins/build/auth) describes the external resource metadata, PKCE authorization, issuer/audience and token verification gates; published plugins need stable hosted infrastructure, not a temporary tunnel.


### Native-only plugin identity bind — source only

The existing `PromptOutbox` now issues a **10-minute** bind code. `bindChatPluginIdentity({bind,workspaceId,goalDigest,conversationDigest,principalTag})` consumes it at most once under the canonical outbox lock and records `IDENTITY_BOUND_UNVERIFIED`. A native host must derive the opaque principal tag from independently verified OAuth credentials and approved scope; raw model output, email, access token or unkeyed low-entropy identity digest are not acceptable. No caller currently supplies that tag. Expired/replayed/legacy codes remain blocked without clearing the original pending work, and identity binding never proves the exact ChatGPT conversation or authorizes a message, model reply or QA. The existing private Rust-to-Node `chatPluginIntent` RPC accepts a `bind` action; no public tool or endpoint is added. Fixtures are authored under `test:chat-goal-host-intent` but not executed.

### Exact goal/workspace/chat binding — source only

The canonical `PromptOutbox.bindChatPluginIdentity` now compares the
one-use bind code against the originally reserved **workspace ID, goal
digest and conversation digest in the same atomic transaction**. A
foreign/stale target is rejected without consuming the code. The
existing `test:chat-goal-host-intent` fixture covers all three
mismatches, replay, expiration, restart and legacy records.

Rust's dormant `GatewaySession.chat_plugin_intent_outbox` now derives
the app-data directory from the native `AppHandle`. For `reserve`
and `bind`, it verifies the current WebView URL, the existing saved
ordinary-chat bookmark, and the reserved conversation digest before
and after the private gateway request. `hold`/`pending` can still
inspect interrupted work without an open browser. A changed tab
after persistence becomes `CHAT_PLUGIN_SCOPE_RECONCILE_REQUIRED`,
not permission to resend. These guards prove **URL scope integrity**,
not authenticated ChatGPT account/session, OAuth principal mapping,
operator approval, final answer or QA. The method has no public caller.


### Native goal admission on every plugin tool call — source only

The plugin bridge now requires three **separate, injected host callbacks**:
`authenticate(requestContext)`, `authorize({tool,input,principal})`, and
`invoke({tool,input,principal,admission})`. The OAuth authenticator
resolves a minimal, verified principal first; native authorization must then
recheck the operator-approved goal, exact workspace/conversation digest,
matching OAuth account and connection, native STOP, and the current binding
epoch before any private effect. The bridge rejects missing, mismatched,
stopped or unapproved native admission and never falls back to OAuth-only
authorization. A callback failure does not trigger retries. The parsed
admission contains only scoped opaque identifiers, not private accounts,
tokens, permission booleans or model text.

For `goal.report`, `turn.claim` and `turn.delivery`, a native-attested
`chatBound:true` is mandatory. A `goal.bind` for an as-yet unverified
chat may return only a non-dispatching status; it cannot provide
`NEXT_TURN_READY` to the widget. A ChatGPT session hint or WebView URL
alone must never produce `chatBound:true`; a real trusted native callback
and supported hosting-chat correlation are prerequisites. The new
`src/mcp/chat-goal/host-admission.mjs` owns only the strict validation of
this projection, NOT a new scheduler, authority, OAuth issuer, host daemon,
network route or permission database.

The current `src/mcp/chat-goal/` has no production server invoking
these callbacks. A pure test double can return `chatBound:true`, but
this is **TEST_AUTHORED_NOT_RUN** and cannot be cited as proof that
ChatGPT, Rust or Codex verified a conversation. The existing native
`PromptOutbox`, bookmark guard, Rust STOP and four public desktop
MCP tools remain unchanged.


### Native source-only ChatGPT scope preflight

The desktop Goal/GitHub panel now offers **Check ChatGPT plugin scope**
on a completed native Codex V1 read-only goal. The main-window-only
`chat_plugin_scope_preflight` checks the *existing* native approval
record, terminal `REVIEW_COMPLETE`, current repository branch/HEAD
and a clean checkout. It checks the selected live ChatGPT URL against
the previously saved ordinary-chat bookmark and repeats both source
and URL checks before returning. The interface reports only
`OAUTH_AND_OPERATOR_BINDING_REQUIRED`, `pluginAuthorized:false`,
`chatSessionVerified:false`, `sent:false` and
`nextPromptAllowed:false`; it never calls the private
`chatPluginIntent` RPC or creates a pending outbox record.
This avoids locking a user's working workspace before the real OAuth
resource server and plugin conversation callback exist.

`npm run test:chat-plugin-native-preflight-source` is an authored
source wiring test, and the existing manual Rust suite includes
negative state and projection tests. Neither has been run here.
This feature does not link accounts, approve plugin work, or
operate ChatGPT.

### Strict primitive identity/receipt validation — source hardening

The plugin input/host receipt, OAuth principal, native admission and
canonical `PromptOutbox` now reject JSON arrays, boxed strings and
strings with trailing line terminators where a fixed opaque token,
workspace ID, digest or single-line report is required. JavaScript
`RegExp.test()` alone is insufficient because it can coerce arrays
and `$` can match before a final newline. The four MCP input schemas
also enforce fixed token length and single-line report metadata,
reducing avoidable model/tool retries. The in-thread widget reuses
`contract.mjs` for both claim and claimed-prompt validation before
`app.sendMessage()`; malformed `_meta` cannot initiate a send.
This adds **no new public tool, network endpoint, scheduler or model
call**. Its negative fixture cases are appended to the existing
`test:chat-goal-bridge`, `test:chat-goal-oauth` and
`test:chat-goal-host-intent` suites, **TEST_AUTHORED_NOT_RUN**.
This is source-level input validation, not an attested native
ChatGPT transport or independent QA.


### Read-only binding/recovery diagnosis — source only

The existing native-private `chatPluginIntent.pending` response now
includes a bounded `diagnostic` field alongside the old stable
`active`, `ambiguous` and `state` fields. Diagnostics distinguish
`NO_PENDING`, `AWAITING_VERIFIED_BINDING`,
`BIND_WINDOW_EXPIRED_HOLD`, `LEGACY_UNTIMED_HOLD`,
`CLOCK_UNCERTAIN_HOLD`, `IDENTITY_LINKED_CHAT_UNVERIFIED`,
`RECONCILE_REQUIRED`, or a defensive ambiguous hold. No raw code,
prompt, account, conversation digest or OAuth token is returned. Each
receipt explicitly has `safeToRetry:false`,
`autoReleaseAllowed:false`, and `nextPromptAllowed:false`,
**including when the workspace has no pending row**. This is
diagnosis, not permission. Time expiry, user review or navigation
does not clear an intent; no automatic recovery/re-send or second
state owner was added.

`npm run test:chat-goal-host-intent` now includes deterministic
persist/restart, legacy, expiry, clock-anomaly, identity-bound and
reconciliation diagnostic fixtures. Authored, **NOT_EXECUTED**.
The real OAuth/native authorization, host final ChatGPT result,
and safe audited terminal release policy remain independent gates.


### Desktop inspection of held plugin intentions — read-only

The existing native main-window Activity → Interrupted state recovery
panel now exposes **Check plugin hold**. The desktop does not parse
outbox files or inspect ChatGPT content. An on-demand
`chat_plugin_pending_status` invokes only the existing native-private
`chatPluginIntent.pending` operation through the packaged,
authenticated Node gateway. The Rust owner strictly checks the response
shape, workspace, state/diagnostic compatibility and all negative
authorization flags, then returns a sanitized status only. It needs no
open WebView or saved bookmark so recovery remains inspectable after
a browser closes or restarts. A missing row is **not** a send grant.

The frontend displays plain-language meanings for fresh, expired,
legacy, clock-uncertain, identity-linked, reconciliation and missing
intent states. No background polling, automated release, model send,
account/session identifier, binding/claim token, prompt or OAuth data
is exposed. Failure or inconsistent provider state reports
**status unavailable — do not retry**. The existing native
`chat_plugin_scope_preflight` remains gateway-free and does not mint
a pairing token. Tests are authored in the existing source fixture
and Rust module; this work is `TEST_AUTHORED_NOT_RUN`.

**Closed-browser access:** Since the Activity toolbar exists only for
mounted WebViews, the same read-only **Check plugin hold** action is also
available in the selected workspace panel when its WebView is not
mounted. Both presentations use one native status command and the
same transient UI state. No ChatGPT login/navigation or additional
process polling is needed to inspect a persisted hold.
