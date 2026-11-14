# LazyPrompting Desktop

LazyPrompting hosts visible workspace browsers. Codex connects through MCP.

## Build the Windows installer

Install Rust with the MSVC toolchain, Node.js, Visual Studio C++ Build Tools, the Windows SDK and WebView2 Runtime. Use the official Windows x64 Node 24.14.1 executable as the staging input.

From the repository root, run:

```powershell
npm ci --prefix apps/desktop
$nodeLicense = Join-Path $env:TEMP "node-v24.14.1-LICENSE"
Invoke-WebRequest https://raw.githubusercontent.com/nodejs/node/v24.14.1/LICENSE -OutFile $nodeLicense
# Point to the verified official Windows x64 Node 24.14.1 binary (not the .node-version development Node 22):
$node24 = "C:\\absolute\\path\\to\\node-v24.14.1-win-x64\\node.exe"
node scripts/stage-gateway-resources.mjs $node24 $nodeLicense
npm run preflight:gateway-stage # read-only checksum and current-source parity; must PASS
Set-Location apps/desktop
npm run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
```

The installer is under `apps/desktop/src-tauri/target/debug/bundle/nsis/`. Staging refuses to overwrite an existing gateway directory. Move the old generated staging directory aside before staging a new source revision.

The staged closure must match the current source. Compare the staged `manifest.json` digests with the repository files after every source change; a stale closure installs a gateway that does not match the reviewed code.

## Verify the installed application

Install the bundle, start `LazyPrompting` and confirm that the local MCP answers from the installed executable.

```powershell
$app = Join-Path $env:LOCALAPPDATA 'LazyPrompting\lazyprompting-desktop.exe'
$probe = @(
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"invoke_capability","arguments":{"name":"workspace_browser.open","arguments":{"workspaceId":"workspace-01","address":"https://example.com"}}}}'
)
$probe | & $app mcp
```

Every browser request must be answered by the running application. `LAZYPROMPTING_APP_NOT_OPEN` means the desktop process is not running; `BROWSER_MCP_CLIENT_NOT_TRUSTED` means the request did not come from the installed executable.

## Open a workspace browser

Choose **Browser 01–10** and click **Open ChatGPT**. A newly created normal workspace opens `https://chatgpt.com/` in **ordinary Chat (non-temporary)**, not `about:blank` or a Temporary Chat link. The native WebView2 navigation boundary and the UI address parser refuse known ChatGPT `temporary-chat` query parameters (including case/encoding variants), whether navigation originates from UI, MCP or a popup. This is a URL-level restriction, not proof of the active account-side ChatGPT mode. You can still type other site addresses or search terms; searches go to Bing, and Back/Forward/Reload work normally.

All 10 tabs share Browser 01's WebView2 profile and keep separate pages and navigation histories. A successful site login can be reused by the other tabs, and signing out affects all tabs. Existing data in Browser 02–10's former profiles is left on disk. The application shell uses a separate profile.

Switching workspace tabs retains each live WebView's current conversation. After an app crash/restart, a newly opened workspace navigates to the ordinary ChatGPT home page; the user can recover their saved conversation from ChatGPT history if account settings support it. **Automatic reattachment of the exact old conversation after a process restart is not implemented or verified**; no new Temporary Chat is created. The native host does not read ChatGPT transcripts or send unattended prompts.

LazyPrompting asks WebView2 to lower memory usage for open workspaces in the background. Background pages can keep their scripts and connections running. Selecting a workspace restores its normal memory target.

## Remember or reopen an existing ChatGPT conversation

In an ordinary ChatGPT Chat with a canonical `https://chatgpt.com/c/<uuid>` address, click **Save chat link**. The main application window stores only that URL as an app-local `chat-bookmarks/workspace-NN.json` bookmark; no message text, cookies or transcript is read or stored. One saved link cannot be bound to two workspace bookmarks.

After reopening LazyPrompting, click **Reopen saved conversation** in a closed workspace, or **Reopen saved** while on the ChatGPT home page. This requests navigation to the stored URL; it does **not** create a chat, verify the ChatGPT account, verify the conversation's current contents, or read a response. The command refuses to replace another active page, and does not reopen anything automatically after a crash. If ChatGPT uses an unsupported URL pattern, recover from ChatGPT history manually. **Forget link** removes the local bookmark without deleting the ChatGPT conversation.

These actions are **main-window user controls only**, intentionally not exposed to Codex, OpenCode or the MCP capability catalog. An app-local URL bookmark is not a trusted session receipt or replacement for the durable goal outbox. Local Windows/WebView2 build and real account acceptance are still pending.

## Review a prepared ChatGPT handoff in the desktop

After an admitted Codex or OpenCode MCP client calls `workspace_chat.prepare_handoff`, the Windows host returns the unsent prompt to that client and also emits a **best-effort, main-window-only** preview for the matching workspace. The desktop panel lets the operator review, copy (or select and Ctrl+C), and dismiss the draft before manually pasting it into an ordinary ChatGPT conversation. It never writes into the browser, sends a ChatGPT message, reads ChatGPT responses, or establishes session/QA proof.

The preview is ephemeral and may be missed if the desktop shell is still loading. The MCP result remains the fallback; **a successful MCP reply does not prove the desktop rendered the preview**. Native Windows/UI acceptance of this new path is pending.

## Control that browser from Codex

Register the installed MCP from PowerShell.

```powershell
$app = Join-Path $env:LOCALAPPDATA 'LazyPrompting\lazyprompting-desktop.exe'
codex mcp add lazyprompting -- $app mcp
codex mcp get lazyprompting
```

Open LazyPrompting, then ask Codex to use LazyPrompting MCP to open workspace-01 through workspace-05. The local MCP is ready when LazyPrompting starts. Codex can open closed tabs and optionally navigate them.

MCP can navigate, read the current address, go back or forward, and reload. The address response omits the query and fragment. The host checks the Windows logon session and the MCP client's executable path. Other local programs running as the same Windows user can launch the MCP executable.

The facade is standard MCP over stdio, so it is **not Codex-only**: Claude Desktop, Claude Code, OpenCode, Cursor, VS Code, Windsurf, Zed and the MCP Inspector can register the same installed executable. Registration snippets for each client are in the [MCP entry points](../../mcp/README.md#use-the-desktop-mcp-from-any-mcp-client). Register the installed executable directly — the native host refuses a wrapper script or a copied binary.

`npm run setup:local -- --apply` registers every detected client at once and verifies each registration with a real handshake. The facade also starts the desktop window by itself when a client calls it, so no manual first step is needed.

## Source-only Agent v2 preparation

The installed MCP facade offers `agent_run.prepare` (operator-approved, read-only source scope with optional `readOnlyInputs` allowlist of up to 24 tracked files), `agent_run.status`, `agent_run.review_execution` (separate native operator intent review), and `agent_run.stop` for either `codex-local` or `opencode-local`. The native host checks executable identity and a clean local Git checkout before recording a proposed run; the approval dialog explicitly grants **no worker launch, file write, shell, network, or release**. The returned `executionReady` is always `false` until the separate native sandbox/attestation code is implemented. Use the same four public MCP tool names; discover the capability using `search_capabilities`. See [native v2 scope contract](../../docs/architecture/agent-v2-native-authority.md).

## Private read-only gateway scope inspection

The main desktop window can call `agent_gateway_inspect` with the exact
native v2 run ID. Its typed bridge `inspectNativePreparedAgentRun` reads a
sanitized scope status through the authenticated native callback pipe.
This command is not available to a browser workspace view and does not
start Codex/OpenCode or grant permission. The source exists; the installed
Windows behavior has not been checked on this revision.

## Native v2 source-binding diagnostics

The main application window has a read-only `agent_gateway_source_binding`
command and `readNativeAgentSourceBindingSummary` typed bridge. It reports
the exact native v2 scope fingerprint, worker profile, pinned source SHA
and `executionReady=false` without exposing executable paths, prompt
contents, or approval credentials. This reflects committed source only;
installed Windows integration still requires separate verification.

## Run a coding goal from Codex

Keep LazyPrompting running with `LAZYPROMPTING_CODEX_EXE` pointing to the signed-in supported Codex CLI. The facade can start the desktop window by itself, and an automatically started window inherits only the environment of the MCP client. Set both paths once for the Windows user so every client and every automatic start sees them:

```powershell
setx LAZYPROMPTING_CODEX_EXE "C:\Users\Administrator\AppData\Local\OpenAI\Codex\bin\f71a721e0e6193a9\codex.exe"
setx LAZYPROMPTING_LIGHTPANDA_BINARY "/root/.local/lib/lazyprompting/lightpanda-1.0.3"
```

**Compatibility pin before localtest:** both `src/transport/desktop-codex-runtime.mjs` and `goal-codex-runner.mjs` currently require the **exact** version string `codex-cli 0.167.0-alpha.3.2`. On the Windows test machine check:

```powershell
& $env:LAZYPROMPTING_CODEX_EXE --version
# Expected from the CURRENT source: codex-cli 0.167.0-alpha.3.2
```

If the output differs or the binary is not installed/signed in, classify the goal-run smoke as `BLOCKED_CODEX_VERSION` or `BLOCKED_AUTH`; **do not** silently upgrade/downgrade the pinned executable or weaken version checks. Upstream release availability does not prove protocol compatibility. Give Codex the path to a clean local checkout, the branch, and your desired outcome. Ask it to prepare a `goal_run.start` request with separate file scopes and an exact verification command for each coding task, then show the native confirmation. Approve once after reviewing those details.

Use `goal_run.report` to see worktree locations, verification exit codes, and any remaining blockers. Changes stay in the task worktrees. See the [Goal Run MCP contract](../../docs/architecture/goal-run-mcp.md) for an example.

### Operator-pasted response continuation

In the existing reviewed handoff panel, paste the ChatGPT reply and optionally specify
one next step, then select **Prepare next draft**. A bounded source-only
formatter produces a new reviewable prompt for that same workspace. Pasted
text is advisory and is NOT an authenticated response receipt, QA evidence or
an automatic model evaluation. It does not clear the native send ledger or
PromptOutbox, grant permissions, read the ChatGPT page, or dispatch anything.
The UI input is ephemeral and is lost after restart. The existing trusted
ResponseObserver/ResponseLifecycle remains the receipt authority. Source
assertions are authored in `tests/run-operator-continuation.mjs` but not run.

When **Next requested step** is empty, the formatter asks the same ChatGPT
conversation to identify the next unfinished step from its original scoped
goal and verifiable repository evidence. The app itself does not claim to
understand or authenticate the answer, execute an AI evaluator, or automatically
send a continuation. It creates a draft only, preserving human review and
native send/STOP controls. A user can still supply a specific next action.

#### Bounded continuation length

The operator continuation formatter now produces at most **12,000 UTF-8
bytes**, matching the native `operator_send_once` limit. To prevent
exponential prompt growth, it retains an explicitly labeled short opening
excerpt of the prior instruction and a recent tail excerpt of the pasted
reply, rather than nesting entire previous drafts across turns. The UI warns
when text was shortened. Omitted text is not treated as reviewed evidence.
The full response still belongs to the operator's ChatGPT conversation, not
a new LazyPrompting transcript store. The focused source assertions include
Unicode, maximum inputs and second-round continuation; they are authored but
not run in the GitHub source workflow.

### Workspace-specific send status in the main window

The reviewed draft panel now actually exposes its existing **Send once**
handler. The main window displays a separate per-workspace native-send hint:
`WAITING` only when the native WebView2 action is queued, and `UNKNOWN` when
its request fails or after reopening without retained state. This ephemeral
indicator resets when the workspace browser is closed. It is not the
extension's `GENERATING`/`POSSIBLY_COMPLETED` observation and is not a
verified response. The adjacent GitHub indicator explicitly says **Not
checked in desktop**: the existing read-only GitHubGoalReview source method
has not been connected to the UI or given new credentials.

The extension's Chrome runtime messages are not a trusted host bridge and
cannot directly populate this native view. WebView2 embedded browser views do
not have an extension popup toolbar. A native, origin- and WebView-bound
extension-to-host transport would be separate source work; do not interpret
this display as that feature being installed or working.

### Main-window status for the selected workspace

The main-window **Check status** button now requests a bounded read-only
observation from the exact WebView2 instance corresponding to the selected
workspace, after a previous **Send once** action in that native host process.
The native command examines only visible Stop/error controls and rejects an
unexpected page URL, closed tab, stale attempt, or mismatched workspace. It
never reads messages and never changes PromptOutbox or GitHub checkpoints.
An observed Stop means `GENERATING`; its disappearance after being seen is
`POSSIBLY_COMPLETED`, never `DONE`. Uncertain or timed-out state is
`UNKNOWN`. Status is main-window-requested, not a new background scheduler.

This native observation follows the same *UI-state concept* as the standalone
extension, but does **not** collect or trust extension messages. The extension
still observes only popup-initiated sends. No authenticated extension-to-host
bridge is claimed. This is source-only until native Windows acceptance.

### Public GitHub progress in each workspace (display-only)

The main-window panel accepts an explicit public `owner/repository` and branch,
then calls **Check GitHub**. It reuses the canonical `GitHubEvidence` module
with `publicReadOnly=true` and no credentials. First check records an ephemeral
session baseline HEAD for that workspace; subsequent checks compare the current
HEAD with the pinned baseline, fail closed for diverged/truncated history, and
display only commit counts and the HEAD. The same repository cannot be assigned
to another workspace through this panel. No public token, private repository
credential, GitHub write, background poll or checkpoint mutation is added.

This is **renderer-side, display-only public GitHub data** and is not trusted
native review evidence. It does not grant the next ChatGPT prompt or mark QA
or DONE. Baselines are not persistent and reset after app restart. Browsers and
the GitHub panel do not share credentials. Actual CORS/network behavior and
Tauri/Svelte integration remain NOT_EXECUTED in this GitHub source workflow.

### Protected main tab and supporting WebView2 tabs (source-only)

Each workspace retains its protected main ChatGPT WebView2 label and can open
three supporting tabs with the shared normal browser profile. The desktop tab
strip offers open, select and close. A new-window request is offered to the
operator for opening in a supporting tab; it never replaces the main chat.
Navigation targets the selected tab, while existing manual-send, bookmarks
and chat-status operations continue targeting the protected main. Supporting
tabs do not persist across app restarts. Windows build, shared login,
WebView2 popup behavior and tab switching are NOT_EXECUTED for this source.

Entering an external address while the protected ChatGPT main tab is selected
opens a supporting tab instead of navigating the main conversation. This
prevents accidental toolbar replacement; same-tab navigation initiated by a
website and authentication redirects still require Windows acceptance. The
native main view is not an unbreakable URL lock.
