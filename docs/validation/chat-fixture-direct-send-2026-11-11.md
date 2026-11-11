# Native-owned direct Send on a synthetic chat fixture — 2026-11-11

**Repository:** `OpenITStudios/LazyPrompting`, development branch `Local`.
**Reviewed parent commit:** `98b37e5de71a86d565ed17a46644e62ae227c083`.
**Evidence type:** `EXECUTED_TEST_PASS` for local Node/VM only,
`SOURCE_REVIEWED` for Rust, `NOT_EXECUTED` for Windows/WebView2.

## Architecture change

The earlier native->page `window.postMessage` route gave the owned
page the ability to forge a command-like event and never provided
authenticated extension messaging. The new fixture omits it altogether.

```text
Codex -> installed Rust desktop MCP (four public tool names)
      -> existing same-user/session checked Windows named pipe
      -> native workspace_chat.fixture_send (debug-only and loopback-only)
      -> Tauri Webview.eval(embedded chat_fixture_send.js + serialized prompt)
      -> fixed synthetic fixture composer / explicit Send
      -> status is untrusted observation (not verified response)
```

The extension continues monitoring its fixture DOM and communicates
with its own background through `chrome.runtime`. It no longer accepts
a page-visible `LP_FIXTURE_NATIVE_REQUEST` event and does not send
prompt/response content to the host.

The native source embeds the send JavaScript using Rust `include_str!`;
the prompt is serialized using `serde_json::to_string`. Both native
and JS verify the loopback fixture URL, and the host reserves the prompt
before `eval`. Clicking Send may still be rejected by the page:
`nativeEvaluationRequested=true` is NOT accepted delivery. Pending
prompt remains `SEND_OUTCOME_UNKNOWN` until independently reconciled.

## Executed deterministic test evidence

**Environment:** isolated Linux container, Node.js v22.16.0, no Rust
toolchain, no WebView2, no logged-in ChatGPT page. All tests were run on
byte-identical local source files checked against staged Git blobs.

| Test | Assertions | What it verifies |
| --- | ---: | --- |
| `tests/run-browser-extension-fixture.mjs` | 43 | Extension fixture runtime behavior on synthetic DOM |
| `tests/run-native-window-fixture.mjs` | 49 | Embedded native JS in VM: multiline, drafts, URL mismatch, duplicate, input literal, Send/error |
| `tests/run-native-fixture-source.mjs` | 32 | Native Rust-source guards and absence of privileged page-message route |
| `tests/run-chatgpt-send-candidate.mjs` | 27 | Detached ChatGPT composer candidate, **never loaded** |
| `tests/run-fixture-extension-integrity.mjs` | 16 | Three extension asset hashes; tampering/missing asset rejected |
| **Total** | **167** | **Node/VM ONLY** |

Additional static review: no `chatgpt.com` host permission in the
fixture extension, no private conversation endpoint or assistant-output
extraction, no new top-level MCP tool, no `goal_run` behavior change.

## What this does NOT prove

- Rust crate compiles, formats or runs on Windows (`cargo check/test` not run).
- WebView2 executes embedded JS with the expected editor semantics.
- Extension installation/status, background worker and window lifecycle.
- Native callbacks or an authenticated extension-origin host channel.
- GitHub commit attribution to a ChatGPT prompt, final answer completion,
  or automatic Temporary Chat replacement.
- Permission to automate consumer ChatGPT without per-turn supervision.

## Next gate

When a runner with Rust/Windows is available, build exact committed SHA,
test a disposable fixture WebView profile and verify one observed Send,
unknown outcomes/reconnect and fixture status accuracy. Only later
consider a permitted production chat transport with authenticated status
and durable GitHub-first goal continuation.
