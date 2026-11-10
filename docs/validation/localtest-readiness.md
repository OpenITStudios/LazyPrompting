# Windows local acceptance

Branch authority is `Local`. Use the [desktop setup guide](../../apps/desktop/README.md) for installation and the [current checkpoint](../operations/current-state.md) for execution evidence.

## Acceptance checks

- Install the Windows x64 bundle and open **Connections**. MCP Gateway should report **Ready**. Closing the app should stop its gateway and Codex descendants.
- Open the fixed WebView2 preview in each slot. Switch between mounted slots, toggle focus and resize the window. Close a preview and check that the selected slot can reopen it.
- Configure the checksum-pinned Lightpanda binary in Ubuntu WSL2. The host launches it inside a private network namespace and uses inherited stdio for CDP.
- In **Managed Codex**, send a read-only task in an unbound workspace. Use an exact expected first response and one approved follow-up. Restart and choose **Recover result**. Verify the original receipts and that the outbox records each task once.
- In a managed Codex task, request the fixed open, read and close preview tools. Verify the native dialog names the workspace and operation. Approve the scoped calls and confirm that Codex receives the bounded preview title. Decline a separate call and confirm the preview state is unchanged.
- Verify live browser and Codex isolation for ten slots. Each browser slot keeps its own same-origin storage. Codex workspaces keep distinct threads and results across gateway restart. Confirm no browser, prompt or turn is redirected across slots.

`npm run preflight:localtest` checks the deterministic build and source contracts. The opt-in Rust tests additionally use a real signed-in Codex CLI, the packaged gateway and Lightpanda in WSL2. Installed UI acceptance remains a separate check.
