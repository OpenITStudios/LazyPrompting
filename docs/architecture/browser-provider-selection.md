# Browser provider selection — source-only decision

## Goal
One browser-owned manual login shared across up to ten logically separate ChatGPT conversations, minimal rendering overhead, no emulator-style per-account isolation. This decision does not authorize automated ChatGPT Web prompting or extraction.

## Candidate A — Tauri embedded system WebView
Advantages: fewer packaging dependencies, native shell integration, possible shared webview data context on one OS. Risks: platform-specific WebView2/WebKit differences, tab identity and profile persistence require actual proof, native lifecycle and resource instrumentation are platform-dependent. **Candidate, not approved**.

## Candidate B — one externally managed Chromium profile
Advantages: mature tab/browser lifecycle and common profile semantics, potential reuse of existing installed browser. Risks: cannot safely assume control over user-owned windows, profile locking, browser updates, extension/security boundaries, and process ownership. Never attach to a personal browser profile or use remote debugging on a logged-in personal browser without a documented, authorized provider and explicit scope. **Candidate, not approved**.

## Candidate C — Lightpanda
Potential lightweight browser engine. Compatibility with manual ChatGPT login, consumer UI, persistence and supported integration is unverified. Not an installation candidate until independent evidence exists.

## Provisional choice
**Evaluate embedded WebView first for the visual application shell**, because the Tauri foundation already exists and it avoids designing a second unmanaged process owner prematurely. This is NOT a claim that WebView can operate existing ChatGPT conversations or will consume less memory. External Chromium remains a fallback only if measured compatibility and ownership justify it.

## Admission checklist
1. Explicit provider/OS/version proof and update responsibility.
2. One browser-managed manual sign-in; no cookie copying, no token extraction.
3. Multiple tabs/views reuse one profile without mixing conversation identifiers.
4. Trusted tab identity, crash recovery, logout and navigation controls.
5. No unauthorized automation; approved ChatGPT transport remains separate.
6. Actual CPU/RAM and tab switching measurements under 1, 4, 10 workspaces.
7. Explicit install approval and rollback strategy.

Source admission gate at apps/desktop/src/browser-provider-admission.mjs is an input contract only. A caller-supplied verified flag is NOT independent attestation; production must bind this to a trusted evidence broker. No browser installed or benchmark run.
