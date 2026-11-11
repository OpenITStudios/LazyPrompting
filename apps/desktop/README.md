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

Choose **Browser 01–10** and click **Open browser**. Type a site address or search terms in the address bar and press Enter. Searches go to Bing. Back, Forward and Reload act on the current tab.

All 10 tabs share Browser 01's WebView2 profile and keep separate pages and navigation histories. A successful site login can be reused by the other tabs, and signing out affects all tabs. Existing data in Browser 02–10's former profiles is left on disk. The application shell uses a separate profile.

LazyPrompting asks WebView2 to lower memory usage for open workspaces in the background. Background pages can keep their scripts and connections running. Selecting a workspace restores its normal memory target.

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

## Run a coding goal from Codex

Keep LazyPrompting running with `LAZYPROMPTING_CODEX_EXE` pointing to the signed-in supported Codex CLI. **Compatibility pin before localtest:** both `src/transport/desktop-codex-runtime.mjs` and `goal-codex-runner.mjs` currently require the **exact** version string `codex-cli 0.167.0-alpha.3.2`. On the Windows test machine check:

```powershell
& $env:LAZYPROMPTING_CODEX_EXE --version
# Expected from the CURRENT source: codex-cli 0.167.0-alpha.3.2
```

If the output differs or the binary is not installed/signed in, classify the goal-run smoke as `BLOCKED_CODEX_VERSION` or `BLOCKED_AUTH`; **do not** silently upgrade/downgrade the pinned executable or weaken version checks. Upstream release availability does not prove protocol compatibility. Give Codex the path to a clean local checkout, the branch, and your desired outcome. Ask it to prepare a `goal_run.start` request with separate file scopes and an exact verification command for each coding task, then show the native confirmation. Approve once after reviewing those details.

Use `goal_run.report` to see worktree locations, verification exit codes, and any remaining blockers. Changes stay in the task worktrees. See the [Goal Run MCP contract](../../docs/architecture/goal-run-mcp.md) for an example.
