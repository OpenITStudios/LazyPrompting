# LazyPrompting Workspace Extension — Synthetic Fixture

**Source prototype only; not installed or activated in WebView2.**

This narrowly scoped Manifest V3 extension demonstrates that a prompt can be
inserted into an editable composer and an explicit Send button can be clicked
**without screenshot, OCR, Computer Use or another language model**.

## Scope

- `manifest.json` matches **only** loopback `http://127.0.0.1/*`.
- `content-script.js` is inert outside `/fixture-chat/` and rejects all
  non-fixture origins, unsolicited content-page commands, invalid IDs, occupied
  composer fields and duplicate prompt IDs.
- `background.js` caches only event metadata, not page content, user prompts,
  assistant answers, cookies, tokens or network traffic.
- The fixture UI produces `INPUT_ATTEMPTED`, `GENERATING`,
  `UI_COMPLETED_OBSERVED`, `ERROR`, `INTERRUPTED` and `UNKNOWN`.
  These events are **not** ChatGPT final-turn receipts.
- The prompt ID cache is ephemeral. Actual durable reservation belongs to
  `src/prompt/prompt-outbox.mjs` and must be validated by a trusted native host.
- The test-only `LP_FIXTURE_RESET` input represents a verified prior cycle
  and MUST NOT be forwarded from an untrusted page or model in production.

## Verification and integration prerequisites

Run `npm run test:browser-extension-fixture` for a synthetic DOM/Chrome-runtime
test. The fixture page is at `tests/fixtures/chat-ui/`. A real WebView2
extension installation has **not** been demonstrated by this test.

Next work must prove the Windows Tauri/WebView2 MV3 extension lifecycle on a
disposable profile, then choose **one** authenticated host↔extension message
transport. Do not use arbitrary `window.postMessage` from chatgpt.com as a
privileged command channel, and never expose web-originated approval flags.

The final ChatGPT-site adapter and unattended loop remain gated by documented
host authorization and policy verification. A separate send-only UI action is
not the same as extracting the ChatGPT response; neither provides an
authoritative accepted-turn callback.

See [control design](../../../docs/architecture/codex-chat-workspace-plan.md)
and [QA gates](../../../docs/validation/codex-chat-workspace-gates.md).

## ChatGPT composer candidate (not activated)

The separate source file `src/browser/chatgpt-send-candidate.mjs` models
the **send-only** mechanism for the intended target origin. It checks one
exact origin, explicit native-host admission and independent completion-verification callbacks, workspace/epoch/prompt
identity, empty editor, and actionability, then fills the candidate textarea
or contenteditable and clicks Send once. It returns `UI_ACTION_ONLY`: a click
is not evidence that ChatGPT accepted a turn.

It is **not imported by this extension**, enabled in Tauri, registered in MCP,
or tested against a live ChatGPT DOM. The candidate selectors and React editor
compatibility require real-site acceptance; a native admission callback must
be authenticated and host-owned, never a model-provided Boolean.

Run `npm run test:chatgpt-send-candidate` for the source-only 27 assertion
test against a synthetic DOM. No ChatGPT output is read.

## Debug-only native WebView2 fixture route (source authored)

The installed Rust MCP facade now has two **debug-only, fixture-only**
capabilities under the same four top-level MCP tools:
`workspace_chat.fixture_send` and `workspace_chat.fixture_status`.
The route is gated by **both** `cfg!(debug_assertions)` and
`LAZY_FIXTURE_BRIDGE_ENABLE=1`. No such flag is set by normal startup.

The native host requires a real child WebView bound to
`http://127.0.0.1:<port>/fixture-chat/…`, validates its URL and view identity,
reserves one prompt before any page command, and blocks subsequent sends.
Only two workspaces may hold an unresolved debug prompt at once. The
`LAZY_FIXTURE_EXTENSION_DIR` folder is checked for an unpacked
manifest with **only loopback scope** before the shared profile can load it.
No other extension/host permissions are added.

The **fixture-only** command uses a page-visible `window.postMessage`
bridge to the content script. A page may spoof this message, so it is NOT
an authenticated communication channel and is **prohibited** for ChatGPT
or other untrusted websites. Native status reads a synthetic `#status`
indicator and returns `observationTrusted=false`,
`sourceVerified=false`, `nextPromptAllowed=false`. Any dispatched
command remains `SEND_OUTCOME_UNKNOWN`; no blind retry.

The source can be reviewed via [native fixture QA](../../../docs/validation/chat-fixture-native-webview-2026-11-11.md).
**Rust compilation and installed Windows WebView2 behavior remain unverified.**

## Immutable fixture bundle / profile isolation

Native debug runs now use `browser-profiles/fixture-debug`; the user-facing
signed-in workspace profile `browser-profiles/browser-01` is unchanged.
The Rust loader verifies SHA-256 of **all three** files
(`manifest.json`, `background.js`, `content-script.js`) before attempting
installation. Updating any of those files requires updating the pinned
hashes **and** running `npm run test:fixture-extension-integrity`.
No file should be modified in an installed extension directory in place.

This does **not** guarantee that WebView2 installed the extension or that
a page-visible message is authenticated. Gate 0 and real Windows tests
remain separate.
