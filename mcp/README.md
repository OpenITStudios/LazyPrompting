# LazyPrompting MCP — Entry Points

The installed Windows client MCP and the packaged Node gateway are **two different surfaces**, even though each exposes four discovery/invocation tool names. Read the [canonical MCP architecture](ARCHITECTURE.md) before changing tools or packaging.

| Use case | Entry point | Status |
| --- | --- | --- |
| Normal Codex control of installed desktop | `lazyprompting-desktop.exe mcp` (Rust) | Native, host-mediated capabilities |
| Desktop internal supervisor / Lightpanda transport | `npm run start:mcp:gateway` / packaged `src/gateway/mcp-gateway.mjs` | Internal Node gateway; requires trusted native channel for privileged operations |
| Old standalone Node surface | `npm run start:mcp:legacy` | Compatibility/debug only; not a production facade |
| Synthetic ChatGPT transport experiment | `npm run start:mcp:probe` | Opt-in, arithmetic-only; never a production automation path |

Register the installed executable as a stdio MCP in Codex as shown in [Windows setup](../apps/desktop/README.md#control-that-browser-from-codex). The desktop facade offers `workspace_browser.*` (open/navigate/location/back/forward/reload) and `goal_run.*` (start/status/report/control) via `status`, `search_capabilities`, `describe_capability`, and `invoke_capability`. Actual capability admission remains owned by the native host.

Workspace browser tabs share the first workspace WebView2 profile but do **not** share state with Lightpanda. The internal Node gateway's supervisor/preview capability names are separate from the desktop catalog.

## ChatGPT web probe

Run `npm ci` at the repo root, then `node src/mcp/chatgpt-probe.mjs`. The probe prints a loopback MCP URL and five one-time binding codes. Use a private Secure MCP Tunnel if available. For disposable arithmetic only, a temporary HTTPS development tunnel can forward to `127.0.0.1:38764`. Keep the randomly generated MCP path when replacing the URL origin with the tunnel origin.

In ChatGPT, add the endpoint as a custom MCP plugin. Start a fresh Work conversation in Browser 01, select the probe plugin using `@`, and ask it to call `bind_probe` with Browser 01's code. The widget requests the first message, then requests the second after the model reports the correct first answer through MCP. Verify both turns in that conversation and compare with the numeric results written to server stderr. Repeat with the other codes after the first chat works. Classic Chat did not consistently retain the reporting tool on widget-originated turns.

This experimental server accepts synthetic arithmetic only. It keeps probe state in memory for 30 minutes. After a claimed send, it waits for that turn's receipt and does not replay the message. Restart invalidates all codes and normally rotates the URL. For repeat tests with the same plugin registration, `LAZY_CHAT_PROBE_ENDPOINT_KEY` can reuse the private 48-character endpoint path segment. Stop the probe and its tunnel after testing.

Run `node --test tests/chatgpt-probe.test.mjs` for the local MCP protocol check. Live ChatGPT widget delivery and background tab behavior require a separate browser check.

For a Chat-mode retest, follow the same setup in a fresh Chat conversation and select the plugin only for the initial binding. A successful run records two `answer` events for the same workspace. The `claimed` and `host_send_response` events distinguish widget reservation from the host's response to the send request. An accepted send request alone is not evidence of an answer. If an answer is missing, keep the conversation as evidence instead of resending the probe prompt.

