# Local Test readiness — evidence gate

**Authority:** OpenITStudios/LazyPrompting, branch `Local`. This is a checklist, not a declaration of release readiness.

## What is actually implemented
- Desktop Svelte shell with ten workspace selections and a local-only WebView2 preview. This is **not** ten fully functional external browser sessions.
- Native Lightpanda loopback configuration, TCP probe, bounded HTTP discovery, WebSocket upgrade diagnostic, and one-shot read-only CDP `Browser.getVersion` protocol probe.
- Existing repository MCP gateway and supervisor contracts. **No verified Codex-to-Lightpanda browser tool wiring**; do not equate an MCP gateway with complete browser integration.
- The native probes are diagnostics only: no session sharing with WebView2, login transfer, navigation, persistent browser pool, or general CDP command execution.

## Automated preflight
1. Install Node.js 22+, Rust stable toolchain (cargo/rustc/rustfmt), Microsoft C++ build tools, Windows SDK, and WebView2 Runtime on Windows.
2. From `apps/desktop`, run `npm install`. From repo root run `npm run preflight:localtest`.
3. The preflight runs gateway and desktop Node tests, Svelte/Vite build, Rust formatting check, Cargo check, and Cargo tests. Any failure exits nonzero. This is source/build evidence, not live integration evidence.
4. Optional GitHub Actions workflow `.github/workflows/localtest-readiness.yml` is **manual-only** and has not been dispatched. It cannot prove installed Lightpanda or Windows desktop interaction.

## Manual integration acceptance (not yet proven)
- [ ] Windows Tauri application compiles and launches.
- [ ] WebView2 local preview mounts for all ten slots; switching never shows two child views; resize/focus/close work.
- [ ] Lightpanda is installed from a vetted release, runs on a loopback-only CDP port, and its executable/version/license are recorded.
- [ ] Set `LAZYPROMPTING_LIGHTPANDA_CDP_ENDPOINT=127.0.0.1:<port>` in the native host environment; invoke diagnostic commands explicitly.
- [ ] TCP probe succeeds; `/json/version` discovery succeeds; WebSocket upgrade succeeds; `Browser.getVersion` returns a valid CDP response.
- [ ] Verify the process behind the endpoint is actually Lightpanda. A CDP response is not authentication or process identity.
- [ ] MCP exposes scoped browser operations with native permission checks, origin allowlist, cancellation, budgets, per-workspace isolation, and audit logs.
- [ ] Codex connects through an approved official interface; no unattended ChatGPT Web scraping or implicit session sharing.
- [ ] End-to-end scenario: approved task → Codex tool call → native authorization → Lightpanda operation → bounded result → UI status, with cancellation and failure recovery.
- [ ] Validate packaging, startup, reconnect, shutdown and resource use under ten workspaces.

## Release decision
**NOT READY FOR END-TO-END LOCAL TEST / PRODUCTION.** This document and the automated preflight are prepared, but runtime integration, MCP-to-Lightpanda transport and actual Windows proof remain incomplete. Do not report these as passed without observed results.
