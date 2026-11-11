# Synthetic fixture MCP bridge — 11 November 2026

**Branch:** `Local` · **prechange baseline:** `35343af3117ec8c88021ec15a52d4bc428fdbb64`
**Type:** source/contract increment; **not** live ChatGPT or Windows verification.

## What the code now supports

- Existing MCP-facing Node gateway retains **exactly four public tool names**:
  `status`, `search_capabilities`, `describe_capability`,
  `invoke_capability`.
- `src/gateway/capability-registry.mjs` describes two new fixture-only
  deferred capabilities, not production ChatGPT send tools.
- `src/gateway/capability-router.mjs` exposes them **only** when an
  independently trusted test host injects a `fixtureBridge` implementation.
  Default gateway startup injects no fixture, and an ordinary standalone
  client cannot activate it through a model-supplied argument or environment
  flag. Router status explicitly labels dispatch `FIXTURE_ONLY` if injected.
- `src/browser/chat-fixture-host-bridge.mjs` validates synthetic
  `http://127.0.0.1:<port>/fixture-chat/…` origin, workspace ID and
  epoch, native host view label, grant ID, bounded input, in-flight scope,
  replay, two-slot default concurrency and private observation/reconciliation
  callbacks. It does **not** read answers or external endpoints.
- A UI click or accepted host command is **not** equivalent to an accepted
  ChatGPT turn; `SEND_OUTCOME_UNKNOWN` holds uncertain results. Only
  `UI_COMPLETED_OBSERVED` plus independent verified evidence releases
  the fixture workspace for another prompt.

## Code and test owners

- `src/browser/chat-fixture-host-bridge.mjs`
- `src/browser/chat-fixture-cycle.mjs` (existing)
- `src/gateway/capability-registry.mjs`
- `src/gateway/capability-router.mjs`
- `tests/run-chat-fixture-host-bridge.mjs`
- `tests/run-gateway-contract.mjs` (catalog count updated)
- `package.json` (new `test:fixture-mcp-bridge`)
- `scripts/preflight-localtest.mjs` (manual-only routing)

## Verification evidence and ceiling

- A **locally reconstructed**, nonidentical host-bridge smoke test ran under
  Linux Node 22.16.0 and passed **16 assertions**. It validates high-level
  ordering, concurrency, status, source-evidence release and failure shape;
  this is *not* exact-commit executable proof.
- Previously authored local extension fixture and send candidate still passed
  **43** and **27** assertions, respectively. Those files were not modified
  in this increment.
- The exact new `tests/run-chat-fixture-host-bridge.mjs` runner has been
  **AUTHORED_NOT_EXECUTED**. Normal gateway regression, Rust build,
  Windows WebView2/extension, actual native IPC and real ChatGPT operation
  have **not** been run for this increment. Git tree/link inspection is
  source-only evidence.

## Remaining work / STOP gates

1. Run the exact Node fixture test, gateway contract and repository test at
   the updated commit where an execution runtime has its files available.
2. Implement the native host → browser extension message transport **on the
   owned loopback fixture only**, with authenticated caller binding and a
   scoped one-time grant; compare installed WebView2 version/settings.
3. Integrate the **existing durable PromptOutbox** only when the host
   admission/receipt protocol is verified. Do not use transient fixture
   session state for long-lived work.
4. Keep the real `chatgpt.com` host origin absent and `chat_goal.*`
   unregistered until Gate 0 + live host permissions are resolved.
   GitHub commit change alone does not prove a ChatGPT response completed.

See [architecture](../architecture/codex-chat-workspace-plan.md),
[acceptance gates](codex-chat-workspace-gates.md) and
[status](../operations/current-state.md).
