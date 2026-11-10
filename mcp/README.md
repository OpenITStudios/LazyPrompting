# LazyPrompting MCP

Register `lazyprompting-desktop.exe mcp` as a stdio MCP in Codex. See [Windows setup](../apps/desktop/README.md#control-that-browser-from-codex).

The desktop entrypoint exposes `status`, `search_capabilities`, `describe_capability` and `invoke_capability`. The `workspace_browser` capabilities are `open`, `navigate`, `location`, `back`, `forward`, and `reload`. All require a workspace ID. Open accepts an optional HTTP or HTTPS address. Navigate requires one. Opening a background workspace preserves the current selection.

Browser control is ready when LazyPrompting runs. The Windows host restricts the pipe to the current logon session and checks the MCP client's executable path. All workspaces share Browser 01's profile. MCP exposes the current address without its query or fragment.

The source gateway at `src/gateway/mcp-gateway.mjs` serves the existing internal supervisor and Lightpanda transports.

## ChatGPT web probe

Run `npm ci` at the repo root, then `node src/mcp/chatgpt-probe.mjs`. The probe prints a loopback MCP URL and five one-time binding codes. Use a private Secure MCP Tunnel if available. For disposable arithmetic only, a temporary HTTPS development tunnel can forward to `127.0.0.1:38764`. Keep the randomly generated MCP path when replacing the URL origin with the tunnel origin.

In ChatGPT, add the endpoint as a custom MCP plugin. Start a fresh Work conversation in Browser 01, select the probe plugin using `@`, and ask it to call `bind_probe` with Browser 01's code. The widget requests the first message, then requests the second after the model reports the correct first answer through MCP. Verify both turns in that conversation and compare with the numeric results written to server stderr. Repeat with the other codes after the first chat works. Classic Chat did not consistently retain the reporting tool on widget-originated turns.

This experimental server accepts synthetic arithmetic only. It keeps probe state in memory for 30 minutes. After a claimed send, it waits for that turn's receipt and does not replay the message. Restart invalidates all codes and normally rotates the URL. For repeat tests with the same plugin registration, `LAZY_CHAT_PROBE_ENDPOINT_KEY` can reuse the private 48-character endpoint path segment. Stop the probe and its tunnel after testing.

Run `node --test tests/chatgpt-probe.test.mjs` for the local MCP protocol check. Live ChatGPT widget delivery and background tab behavior require a separate browser check.

For a Chat-mode retest, follow the same setup in a fresh Chat conversation and select the plugin only for the initial binding. A successful run records two `answer` events for the same workspace. The `claimed` and `host_send_response` events distinguish widget reservation from the host's response to the send request. An accepted send request alone is not evidence of an answer. If an answer is missing, keep the conversation as evidence instead of resending the probe prompt.
