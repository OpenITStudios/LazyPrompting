# Desktop functional acceptance gates

## Scope
One shared browser-owned profile, up to ten logically separate ChatGPT conversation workspaces, Emulator-style Play screen. Browser UI is not an unattended ChatGPT automation transport.

## Gate A — frontend source and build
- Pin Local SHA; use reviewed lockfile and reproducible dependency versions.
- Run Svelte/TypeScript check and Vite build. Fail on any error.
- Confirm Play and Settings navigation, 5/10 slot rendering, selection switching, keyboard focus, narrow-window layout.
- Slot buttons must never imply that browser launch succeeded while disconnected.

## Gate B — native shell
- Run Rust cargo check/test and Tauri shell on Windows with network navigation disabled.
- Confirm capability scope only grants the app shell access to commands.
- Verify provider status is fail-closed and no browser child process is started.
- Check clean startup, shutdown, restart, and error logging.

## Gate C — browser integration (separate authorization)
- Verify official runtime availability; do not rely on registry hints.
- Manual sign-in with one browser-owned profile; no password/cookie extraction.
- Confirm session sharing, logout propagation, separate conversation identity, restart recovery.
- Remote web content must never receive privileged Tauri command access.

## Gate D — performance
- Capture baseline and 1/4/10 workspace memory, CPU, switching latency on the actual target machine.
- Compare idle and active views; do not claim parked views preserve background generation.
- Define and approve thresholds after baseline observation; failures block release.

## Gate E — supervisor transport
- Require a documented, authorized host transport for response observation and prompt submission.
- Verify explicit permission, per-chat identity, one in-flight dispatch per chat, cancellation and idempotent recovery.
- Until then, automation remains disabled regardless of UI/browser success.

## Current evidence
SOURCE_REVIEWED / SOURCE_COMMITTED only. No build, native tests, browser launch, sign-in, performance or live transport verification. User approval for native QA must not be inferred as approval to install browser or automate ChatGPT.
