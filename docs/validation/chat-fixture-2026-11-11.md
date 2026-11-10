# Synthetic chat fixture — source/test evidence, 2026-11-11

**Purpose:** exercise the smallest falsifiable message-status contract before writing an MV3 extension or modifying the installed WebView2 profile. Not connected to ChatGPT or Codex App Server.

## Source owners

- `src/browser/chat-fixture-cycle.mjs` — deterministic single-workspace status machine: IDLE, RESERVED, SEND_ATTEMPTED, GENERATING, SETTLING, UI_COMPLETED_OBSERVED, ERROR, INTERRUPTED, UNKNOWN, SEND_OUTCOME_UNKNOWN. Checks workspace/epoch/sequence, start/assistant activity, settling interval, error/stop/navigation, and explicit verified-evidence release.
- `src/browser/chat-fixture-composer.mjs` — origin-restricted `http://127.0.0.1:<port>/fixture-chat/…` local form action only; a click returns `UI_ACTION_ONLY`, **never an acknowledged ChatGPT delivery**.
- `tests/fixtures/chat-ui/index.html`, `simulator.mjs`, `server.mjs` — loopback-only synthetic chat with Send, Stop, fake streaming, error and manual stop. Test-only. Browser integration with actual WebView2 is NOT executed.
- `tests/run-chat-fixture-cycle.mjs` — Node `assert/strict` deterministic 39 assertions, no npm install or model/browser API required.

## Executed verification

**Runner:** isolated container, Linux x64, Node `v22.16.0`.
**Command:** `node tests/run-chat-fixture-cycle.mjs` from the isolated fixture checkout equivalent.
**Observed result:** `Fixture chat-cycle: PASS (39 deterministic assertions, Node only; no browser or ChatGPT connection)`.
**Syntax checks:** `node --check` on both source modules, simulator, server, and test runner exited 0.
**Source identity:** all six executable/source/fixture files were staged with Git blob IDs matching byte-for-byte the locally tested files. The test code is the same source that will be committed to `Local`.

**Not proven:** native Windows tests, running MV3 extension inside WebView2, reliable DOM status detection on ChatGPT, page automation policy compliance, real prompt delivery, multi-workspace isolation, UI runtime behavior or GitHub receipt binding.

A headless Chromium smoke invocation was attempted in the container but timed out; it is **not** a successful browser QA result. The loopback HTTP server did return status 200 for the fixture page.

## Test cases in this pass

- Duplicate or concurrent sends rejected; unknown send outcomes never retried.
- Start/stop/assistant activity and settling required before `UI_COMPLETED_OBSERVED`.
- No completion from absent assistant activity, manual stop, error, navigation or timeout.
- Wrong workspace/epoch and replayed observer sequences rejected.
- A completed UI signal cannot release for the next prompt without independent verification.
- Input is accepted only by the explicitly synthetic, local-origin composer; real ChatGPT origin denied.
- No output from ChatGPT is accessed or stored.

## Next bounded engineering gate

Run the fixture under **actual Windows WebView2 with an extension in an isolated, disposable profile**, then prove host <-> extension event transport, background-view behavior and lifecycle. Use [Chat workspace acceptance gates](codex-chat-workspace-gates.md) G1/G2; do not activate ChatGPT site automation while Gate 0 is unresolved.
