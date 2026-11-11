# Rust MCP → WebView2 synthetic fixture stage — 2026-11-11

**Repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Parent baseline:** `b3f42717233a4b7bd2200bc12df79a253dcd6baf`.
**Scope:** Windows Rust source and local test fixture only.
**Status:** Source authored, independently reviewed; Rust/Windows NOT_EXECUTED.

## Code path

```text
Codex MCP client
  -> installed Rust stdio facade (four existing public tool names)
  -> deferred workspace_chat.fixture_send / fixture_status
  -> existing Windows named pipe (same-login, executable-path checks)
  -> chat_fixture_native.rs (debug-only, explicit flag and scope)
  -> child WebView2, exact http://127.0.0.1:<port>/fixture-chat/ URL
  -> page-visible window.postMessage (FIXTURE ONLY, UNTRUSTED)
  -> MV3 content script's scoped fixture Send handler
  -> owned synthetic chat form
```

Native `fixture_status` calls `eval_with_callback` to observe only
the synthetic page `#status` field, not assistant output. It reports
`observationTrusted=false`, `sourceVerified=false` and
`nextPromptAllowed=false`. No authenticated receipt/release interface
is present yet.

The MV3 extension is enabled only when the application is a **debug
build** with `LAZY_FIXTURE_BRIDGE_ENABLE=1` and an explicit local
`LAZY_FIXTURE_EXTENSION_DIR`. The directory must contain the expected
loopback-only MV3 manifest; all workspace views use the shared workspace
profile, separate from the Tauri shell. Nothing is installed by this
commit on a user's machine. Debug settings do not prove that a
profile previously created with extensions disabled can be reused.

## Safety and failure controls

- Native scope: workspace-01..10, explicit prompt ID, epoch > 0,
  bounded text; two unresolved in-flight prompts maximum.
- A prompt is reserved before calling `Webview.eval`; any thrown or
  missing ACK stays uncertain, not retried. No claim that a click equals
  ChatGPT acceptance.
- Native checks URL before dispatch; evaluated JS checks exact href
  again to prevent navigation races. Status rejects different session URL.
- The `window.postMessage` channel is readable/forgeable by the
  **owned fixture page**, so it is not a secure adapter for chatgpt.com.
  Only loopback fixtures are admitted; normal/release builds keep
  the feature off. No private endpoint, cookies, OCR, screenshots or
  reply texts are collected.
- No automatic next-prompt action or state reset was added.

## Executed tests (Node-only, no browser)

- `node tests/run-browser-extension-fixture.mjs`:
  **43 assertions PASS** against synthetic DOM.
- `node tests/run-native-window-fixture.mjs`:
  **28 assertions PASS** for the page-visible message bridge in Node VM.
- `node tests/run-chatgpt-send-candidate.mjs`:
  **27 assertions PASS**, source-only disabled candidate.
- `node tests/run-native-fixture-source.mjs`:
  **28 assertions PASS** for source restrictions/manifest/protocol.
- Node.js v22.16.0 on Linux, no API key, Computer Use or additional AI.
- Source files staged in Git using source blob hashes; exact paths
  should be verified after commit.

**NOT EXECUTED:** `cargo fmt --check`, `cargo check`, `cargo test`,
actual Windows WebView2 extension install, MV3 worker lifecycle, named-pipe
roundtrip, real browser page callback, and any ChatGPT Chat site.
No machine-level success or production acceptance is implied.

## Next proof boundary

When a permitted Windows CI/execution environment is available,
compile exact committed SHA, run manual-only `preflight:localtest`, then
validate installed WebView2 fixture on a disposable profile.
The current page-visible messaging must be replaced with a properly
authenticated/native-owned channel **before** considering any untrusted
website. Live ChatGPT Chat automation is still gated by host/permission
and relevant account capabilities; GitHub status cannot prove the last
ChatGPT reply.

Previous design: [architecture](../architecture/codex-chat-workspace-plan.md),
[acceptance gates](codex-chat-workspace-gates.md),
[active state](../operations/current-state.md).
