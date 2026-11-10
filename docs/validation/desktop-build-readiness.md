# Desktop build readiness — source audit, 2026-11-10

## Source changes
- Frontend build now invokes Svelte/TypeScript checking before Vite, rather than emitting a bundle that may contain type errors.
- The native window explicitly uses label `main`, matching the capability allowlist.
- Neither change is a successful build claim. No dependencies were installed and no native or frontend command was executed.

## Build verification sequence (requires user authorization)
1. Pin a GitHub Local SHA, clean checkout, verify Node/Rust/Windows WebView2 prerequisites and lockfile strategy.
2. From apps/desktop: install dependencies using a reviewed lockfile; run npm run check and npm run build.
3. From apps/desktop/src-tauri: run cargo check and cargo test, verify generated Tauri context/icons/capabilities.
4. Run Tauri development shell on Windows with no external browser navigation; inspect UI, logs, and runtime status.
5. Only after separate authorization and official WebView2 runtime discovery: manually test one browser-owned login, session reuse, logout and crash recovery.
6. Measure CPU/RAM and view switching at 1/4/10 workspaces. Record actual results and stop if host permissions or account behavior are uncertain.

## Remaining source and integration risks
- No verified dependency lockfile, build artifact, Windows runtime, native WebView creation or process ownership.
- Existing Rust WebView provider reports NOT_IMPLEMENTED and keeps navigation/automation disabled.
- A shared login profile is not a browser security boundary; existing ChatGPT conversation automation remains unsupported pending documented host admission.
- Do not install a browser, send ChatGPT prompts, or claim performance without measured evidence.
