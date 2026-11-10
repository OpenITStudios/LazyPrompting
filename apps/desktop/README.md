# LazyPrompting Desktop

LazyPrompting hosts visible workspace browsers. Codex connects through MCP.

## Build the Windows installer

Install Rust with the MSVC toolchain, Node.js, Visual Studio C++ Build Tools, the Windows SDK and WebView2 Runtime. Use the official Windows x64 Node 24.14.1 executable as the staging input.

From the repository root, run:

```powershell
npm ci --prefix apps/desktop
$nodeLicense = Join-Path $env:TEMP "node-v24.14.1-LICENSE"
Invoke-WebRequest https://raw.githubusercontent.com/nodejs/node/v24.14.1/LICENSE -OutFile $nodeLicense
node scripts/stage-gateway-resources.mjs (Get-Command node).Source $nodeLicense
Set-Location apps/desktop
npm run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
```

The installer is under `apps/desktop/src-tauri/target/debug/bundle/nsis/`. Staging refuses to overwrite an existing gateway directory. Move the old generated staging directory aside before staging a new source revision.

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

## Run a coding goal from Codex

Keep LazyPrompting running with `LAZYPROMPTING_CODEX_EXE` pointing to the signed-in supported Codex CLI. Give Codex the path to a clean local checkout, the branch, and your desired outcome. Ask it to prepare a `goal_run.start` request with separate file scopes and an exact verification command for each coding task, then show the native confirmation. Approve once after reviewing those details.

Use `goal_run.report` to see worktree locations, verification exit codes, and any remaining blockers. Changes stay in the task worktrees. See the [Goal Run MCP contract](../../docs/architecture/goal-run-mcp.md) for an example.
