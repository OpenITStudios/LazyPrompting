# Browser extension fixture — executed source checks, 2026-11-11

**Repository:** `OpenITStudios/LazyPrompting` branch `Local`.
**Source scope:** `apps/desktop/browser-extension/` and
`tests/run-browser-extension-fixture.mjs`.

## What was implemented

An internally authored, fixture-only MV3 manifest plus:
- Content script that reserves a bounded prompt by ID, preserves multiline
  text, focuses a synthetic editor and activates the Send control exactly once;
  it treats this as `UI_ACTION_ONLY`, never an authoritative response receipt.
- Completion/error state observation from explicit **owned fixture** indicators,
  without reading the response body.
- Metadata-only extension service worker cache with sequence/replay checks.
- Source integration into the manual repository preflight.

The manifest is restricted to loopback. This commit **does not** add the
`chatgpt.com` origin, register `workspace_chat.submit` on the production MCP
facade, alter Tauri, install an extension or enable any unattended ChatGPT loop.

## Exact evidence

- **Runner:** container Linux, Node.js v22.16.0.
- **Command:** `node tests/run-browser-extension-fixture.mjs`.
- **Observed output:** `Browser extension fixture: PASS (43 assertions; local synthetic DOM only)`.
- **Syntax:** `node --check` on the content script, background script and
  test runner; manifest parsed as JSON.
- **Source identity:** 4 file Git blob SHA-1 values independently checked
  against byte-identical locally executed files before GitHub commit.
- **Tests include:** wrong origin, invalid command/epoch/ID, no repeat while
  pending or after reset, manual composer preservation, multiline text,
  UI-only acknowledgment, sending exactly once, generating/done/error/stop,
  monotonic event IDs and no reply text in cache.

**NOT VERIFIED:** Windows WebView2 installation, extension↔Tauri native
transport, live ChatGPT Send action, account consent, real ChatGPT completion
signals, automatic new Temporary Chat, multi-workspace runtime behavior or
Codex goal loop. A synthetic status observation is not independent evidence
that ChatGPT or the user repository finished a task.

## Site automation policy distinction

The current OpenAI Terms expressly restrict automated/programmatic extraction
of Output and bypassing rate limits. Filling a composer and observing a binary
status are **technically distinct** from extraction, but this distinction does
not itself establish permission for unattended browser automation. Production
activation remains subject to an explicit, verified host/permission gate.

## Next

The only next independent source unit is a **disabled-by-default**
Windows test adapter that packages the immutable extension and verifies
a single origin-validated native messaging path on an owned local fixture.
Keep the current public MCP four-tool surface unchanged, and do not force
a local PC test from the user.

## Follow-up: source-only ChatGPT Send candidate

- `src/browser/chatgpt-send-candidate.mjs` is an isolated, unused target-site
  candidate. It does not register browser permissions or MCP tools.
- `tests/run-chatgpt-send-candidate.mjs`: **27/27** assertions executed
  under Node 22.16.0, Linux. Checks exact origin, native callback requirement,
  workspace/epoch/prompt scope, textarea and contenteditable input, one Send per verified milestone, concurrent admission rejection, exact-identity host-verified release,
  existing human draft preservation and no duplicate attempt.
- The source/test Git blobs were verified byte-identical with executed files.
- **Do not upgrade to LIVE_INTEGRATION_VERIFIED**: selectors are only
  candidates, actual ChatGPT DOM/React behavior was not inspected live, and
  no native permission or message transport was exercised.
