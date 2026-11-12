# LazyPrompting MCP — Entry Points

The installed Windows client MCP and the packaged Node gateway are **two different surfaces**, even though each exposes four discovery/invocation tool names. Read the [canonical MCP architecture](ARCHITECTURE.md) before changing tools or packaging.

| Use case | Entry point | Status |
| --- | --- | --- |
| Local control of installed desktop from any conforming MCP client | `lazyprompting-desktop.exe mcp` (Rust) | Native, host-mediated capabilities |
| Desktop internal supervisor / Lightpanda transport | `npm run start:mcp:gateway` / packaged `src/gateway/mcp-gateway.mjs` | Internal Node gateway; requires trusted native channel for privileged operations |
| Old standalone Node surface | `npm run start:mcp:legacy` | Compatibility/debug only; not a production facade |
| Synthetic ChatGPT transport experiment | `npm run start:mcp:probe` | Opt-in, arithmetic-only; never a production automation path |

Register the installed executable as a stdio MCP in Codex as shown in [Windows setup](../apps/desktop/README.md#control-that-browser-from-codex). The desktop facade offers `workspace_browser.*` (open/navigate/location/back/forward/reload/release), Codex v1 `goal_run.*` (start/status/report/control/turn_receipt) and v2 source-only `agent_run.*` (prepare/status/stop) via `status`, `search_capabilities`, `describe_capability`, and `invoke_capability`. Actual capability admission remains owned by the native host.

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

## ChatGPT web probe

Run `npm ci` at the repo root, then `node src/mcp/chatgpt-probe.mjs`. The probe prints a loopback MCP URL and five one-time binding codes. Use a private Secure MCP Tunnel if available. For disposable arithmetic only, a temporary HTTPS development tunnel can forward to `127.0.0.1:38764`. Keep the randomly generated MCP path when replacing the URL origin with the tunnel origin.

In ChatGPT, add the endpoint as a custom MCP plugin. Start a fresh Work conversation in Browser 01, select the probe plugin using `@`, and ask it to call `bind_probe` with Browser 01's code. The widget requests the first message, then requests the second after the model reports the correct first answer through MCP. Verify both turns in that conversation and compare with the numeric results written to server stderr. Repeat with the other codes after the first chat works. Classic Chat did not consistently retain the reporting tool on widget-originated turns.

This experimental server accepts synthetic arithmetic only. It keeps probe state in memory for 30 minutes. After a claimed send, it waits for that turn's receipt and does not replay the message. Restart invalidates all codes and normally rotates the URL. For repeat tests with the same plugin registration, `LAZY_CHAT_PROBE_ENDPOINT_KEY` can reuse the private 48-character endpoint path segment. Stop the probe and its tunnel after testing.

Run `node --test tests/chatgpt-probe.test.mjs` for the local MCP protocol check. Live ChatGPT widget delivery and background tab behavior require a separate browser check.

For a Chat-mode retest, follow the same setup in a fresh Chat conversation and select the plugin only for the initial binding. A successful run records two `answer` events for the same workspace. The `claimed` and `host_send_response` events distinguish widget reservation from the host's response to the send request. An accepted send request alone is not evidence of an answer. If an answer is missing, keep the conversation as evidence instead of resending the probe prompt.

