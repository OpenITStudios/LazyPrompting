# Universal MCP and Multi-Agent Access — implementation + research (12 November 2026)

**Repository:** OpenITStudios/LazyPrompting, working branch `Local`. **Baseline reviewed:** `32236900721ab7cc949bea39cf9e71c8af0d7509`. The latest source work before this evidence checkpoint is `ae8f6329113835179151229e7deb76547d0db9e9`. The installed Windows tests in prior reports are evidence for their own pinned earlier revisions only.

## Goal and non-goals

Make the **installed** LazyPrompting stdio MCP available to multiple independent clients such as Codex and OpenCode, without assigning native host authority to caller-supplied model content. Support bounded concurrent goals and prevent accidental cross-client control of one browser workspace or goal. Keep `status`, `search_capabilities`, `describe_capability`, and `invoke_capability` stable.

**Not done:** a second (OpenCode) goal worker, per-client browser profile/cookie isolation, remote Streamable HTTP, a Browse installation/pairing, unattended consumer ChatGPT web automation, CI dispatch, or a signed/released native build.

## Changes implemented in `Local`

| Commit | Source owner | Change | Proof |
| --- | --- | --- | --- |
| `fb08252` | `src/runtime/active-goal-registry.mjs` and `src/gateway/mcp-gateway.mjs` | Two concurrent read-only Codex goals; per-data-dir/STOP uniqueness; repository writer exclusivity; exact release on completion/failure | 4 isolated Node tests PASS; installed runtime NOT_EXECUTED |
| `41af91d` | `src/runtime/mcp-stdio-handshake.mjs`, `scripts/setup-local.mjs` | Sequential initialize/initialized/tools-list verification, exact four-tool contract and nonzero setup exit on failure | 6 isolated Node fixture tests PASS; client app sessions NOT_EXECUTED |
| `7382efc` | Rust `browser_mcp_pipe.rs`, `mcp_stdio_host.rs`, Cargo | Initialization without GUI boot; 24-permit independent native pipe calls | Rust native NOT_EXECUTED |
| `15a9ae4` | `mcp_workspace_leases.rs`, Rust facade | Verified client process PID+creation time, exclusive browser workspace ownership, `workspace_browser.release` | Rust unit test AUTHORED_NOT_RUN |
| `0739ea0` / `ae8f632` | Rust native leases | Goal scope ownership, bounded lease table, detect exited processes before reclamation | Rust source only |
| `2f55b06` | Rust cold-start host | Named Windows mutex serializes startup across MCP clients | Windows cold-start QA NOT_EXECUTED |

**Classification:** Exact source committed to GitHub is not a Windows compile or native integration PASS. The ten focused Node fixture tests were exercised in an isolated local Node 22 environment prior to writing the commits; full repository suite, native Rust/Cargo suite, installed smoke and OpenCode real-agent regression on this final revision have not been run. Historical Windows Inspector/OpenCode proof used installed revision `d346c75`.

## Current architecture and boundaries

```text
Codex / OpenCode / other stdio MCP clients
       | one local lazyprompting-desktop.exe mcp process per client
       v
Rust MCP protocol facade: four stable public tools
       | only privileged tool calls start GUI
       | Windows verified pipe peer PID + creation time
       v
Native host: bounded parallel named pipe / client leases / consent
       | browser workspace -> shared-profile WebView2, ownership lock
       | goal UUID -> operator-approved scope + STOP + durable checkpoint
       v
Authenticated internal Node gateway: bounded two-goal admission
       v
Codex App Server goal worker (still Codex-only)
```

A workspace lease separates **navigation authority**, not logins: the workspace WebView2 tabs intentionally share a browser profile. `workspace_browser.release` releases one agent's claim but leaves the tab open. A dead process identity can be reclaimed; a live different process is rejected. The same local Windows user can launch the installed MCP executable, so Windows peer verification is not a substitute for independent user/account authentication or approval for privileged actions.

The goal admission registry is deliberately **process-local**, not a new canonical durable state store. On restart the approved scope fingerprint and existing report/outbox reconciliation remain authoritative. Two read-only goals may examine the same checkout; a coding goal must be exclusive to that repository. Native `goal_run.*` still invokes the exact pinned Codex CLI; no OpenCode work execution claim is made.

## OpenCode implementation details

OpenCode V2 local servers reside under `mcp.servers`; `type=local` with a command array starts an MCP stdio executable. The default Code Mode groups tools; `codemode:false` can expose tools directly. `mcp.timeout.startup` defaults to 30 seconds, so the MCP initialize phase must not wait for WebView2 creation. The OpenCode session ID passed as `tools/call.params._meta["ai.opencode/sessionID"]` is a **correlation value, not an authentication token**. No model-provided ID is accepted as a host privilege.

OpenCode V2 default agent permissions can allow edit/shell/external directory actions. A future worker adapter must use an explicit host-approved process and worktree scope, restrictions that cannot be overridden by project configuration or model output, a separately verified task/session receipt, STOP/pause semantics and an OS-level write boundary. `opencode run --format json` and `@opencode/sdk` are official possibilities; **not integrated as a worker** in this patch.

## OpenCode Browse research — *separate optional browser provider*

OpenCode Browse is an independently installed **Chromium extension + local relay + stdio MCP**. It offers named sessions, site allowlists, user-controlled tab lending, screenshots/recording and human handoff for authentication. This is a valuable reference for product UX and provider contracts, but it is **not** the LazyPrompting WebView2 tab or Lightpanda instance. Browse can operate using real signed-in browser profiles; no extension installation, pairing, cookie sharing, or third-party Browse tool call has been performed. Do not assume its session IDs or domain allowlists authenticate the host. Site allowlists also have documented limits for subresources.

Future browser-provider interface (design only): `openSession`, `readLocation`, `capture`, `requestHumanHandoff`, `release`, `stop`. Every method must carry a host-verified grant, owner, origin scope, deadline and session identity. Keep WebView2 and Lightpanda separate unless explicit support/consent is proven.

## Required QA on Windows before accepting this change

1. Check exact `Local` HEAD, execute `npm run test:goal-admission`, `npm run test:mcp-stdio-handshake`, `npm run test:repository`, `npm run preflight:localtest`, and `npm run preflight:gateway-stage` after restaging. Run `cargo fmt --check`, `cargo check` and `cargo test` with the Windows MSVC toolchain.
2. Rebuild/reinstall the NSIS bundle and verify manifest SHA matches the source and executable. Confirm `initialize` + `tools/list` complete without GUI cold start and without a handle leak.
3. **Explicit operator-only test:** set `LAZY_MCP_OPERATOR_QA=yes` and run `node tests/manual/native-mcp-two-clients.mjs` on a disposable workspace. Verify two separate installed MCP stdio processes, second-client denial, release, and ownership recovery after the first owner exits.
4. Start OpenCode and Codex as two **real client applications**, confirm status + workspace browser operations, then deliberately try the same workspace simultaneously (must deny). Check a cold simultaneous startup launches only one app host and does not hang either MCP client.
5. Approve two read-only goals with independent durable paths; run both, then attempt a duplicate data-dir/STOP and two writers on the same repo (must reject). Verify report identity, native approval and denial dialogs, PAUSE_REQUESTED -> PAUSED -> resume, STOP precedence, no replay after restart, and false QA rejection.
6. Confirm default `main` and retained `Harness` remain unchanged. Never use a real signed-in user tab or production repo for a test unless separately approved.

**No CI or Windows tests were triggered by these source commits.** If Rust compile or installed behavior fails, report the exact error, keep the prior working installer, and do not claim production acceptance.

## Official and primary references

- MCP lifecycle: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- MCP stdio and Streamable HTTP/security: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- MCP security best practices: https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices
- OpenCode MCP V2 config, timeouts, session metadata: https://opencode.ai/docs/mcp-servers
- OpenCode CLI run, format and session: https://opencode.ai/docs/cli/commands
- OpenCode embedded host SDK: https://opencode.ai/docs/build/sdk
- OpenCode V2 permissions/policies: https://opencode.ai/docs/permissions/ and https://opencode.ai/docs/policies/
- OpenCode Browse product + source: https://opencode.ai/product/browse and https://github.com/anomalyco/browse
- Tokio owned semaphore permits: https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html
- Microsoft verified named-pipe peer: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getnamedpipeclientprocessid
- Microsoft process creation and exit info: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes
- Microsoft cross-process mutex: https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createmutexw
- OWASP MCP security checklist: https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html
