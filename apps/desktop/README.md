# LazyPrompting Desktop

The Windows x64 debug installer includes the Tauri desktop, Node and the authenticated MCP gateway. The Lightpanda preview runs in Ubuntu WSL2. Managed Codex supports individually approved read-only turns and result recovery.

## Build the Windows installer

Install Rust with the MSVC toolchain, Node.js, Visual Studio C++ Build Tools, the Windows SDK and WebView2 Runtime. Use the official Windows x64 Node 24.14.1 executable as the staging input.

From the repository root, run:

```powershell
npm ci --prefix apps/desktop
node scripts/stage-gateway-resources.mjs (Get-Command node).Source
Set-Location apps/desktop
npm run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
```

The installer is under `apps/desktop/src-tauri/target/debug/bundle/nsis/`. Staging refuses to overwrite an existing gateway directory. Move the old generated staging directory aside before staging a new source revision.

## Set up Lightpanda

In Ubuntu WSL2, install the pinned executable into a user-owned directory. This runtime requires Python 3.11 or later, `ip`, and support for unprivileged user and network namespaces.

```bash
mkdir -p ~/.local/lib/lazyprompting
cd ~/.local/lib/lazyprompting
curl --fail --location --output lightpanda-1.0.3 https://github.com/lightpanda-io/browser/releases/download/1.0.3/lightpanda-x86_64-linux
echo '53eb34da09159dcf8f04865dbfe3e63e9a652062684495aa7ced5ddd7c82e8b0  lightpanda-1.0.3' | sha256sum --check
chmod 755 lightpanda-1.0.3
realpath lightpanda-1.0.3
```

Set `LAZYPROMPTING_LIGHTPANDA_BINARY` to the printed Linux path in the Windows process environment and launch LazyPrompting from that environment. The native host verifies the binary again before starting it.

Select a workspace and choose **Open Lightpanda preview**, **Read preview**, or **Close preview**. Confirm the exact operation in the native dialog. Each approval applies to one operation on one workspace. The Lightpanda controls target the fixed local preview. The existing WebView2 viewer is separate.

## Set up managed Codex

Sign in using the official Codex CLI. The desktop currently accepts the tested version `codex-cli 0.167.0-alpha.3.2`. Set `LAZYPROMPTING_CODEX_EXE` to the absolute path of the signed-in Windows CLI before launching LazyPrompting.

In the desired workspace, expand **Managed Codex**, enter the absolute local working directory and a read-only task, and choose **Send Codex turn**. The native confirmation shows the directory and task. The first turn binds the slot to that directory and a managed Codex thread.

Choose **Recover result** to check an acknowledged turn, including after restarting the app. An unacknowledged reservation stays held for reconciliation. **Stop Codex workspace** stops future dispatch for the selected workspace and requests interruption of an acknowledged turn.

## Verify

Run `npm run preflight:localtest` from the repository root. To run the real Windows/WSL2 integration test, set `LAZY_LIGHTPANDA_TEST_BINARY` to the same Linux path and run:

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml private_wsl_browser_isolates_ten_workspaces -- --ignored
```

See the [current checkpoint](../../docs/operations/current-state.md) for recorded runtime evidence and remaining acceptance work.
