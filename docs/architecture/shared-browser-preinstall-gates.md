# Shared Browser — Pre-install blind-spot review

## Approved product topology
One manually signed-in browser profile; up to ten logically distinct conversation/workspace bindings. Tabs/views may share cookies and same-origin storage. No emulator-style account isolation, cookie copying, credential capture or per-workspace login.

## Source contracts
- One shared browser profile; conversation identity unique across workspace bindings.
- One selected visible view by default; background work does not require ten rendered browser windows.
- Parking a view is a presentation choice, **not** suspension of a ChatGPT generation or process.
- Per-workspace prompt outbox and evaluation remain independent; a pending prompt blocks unbinding until reconciled.
- Login/logout applies to the shared browser profile and all workspaces.
- Browser process and tab identities must be observed by the future host; a stored URL or tab label is not proof of the correct conversation.
- Browser ownership, restart recovery, session expiry, crashes, memory pressure, tab discard, focus/keyboard shortcuts, close confirmation and user logout require explicit handling.

## Performance design
Default one shared browser process/profile and one visible view. Up to ten logical workspace mappings, with lazy view activation and parked inactive views. Keep only lightweight status projections in the dashboard; do not poll all tabs continuously or store full transcripts. Use event notifications when a supported host offers them, otherwise bounded backoff. Track actual memory/CPU only after an OS observer is implemented; do not invent resource savings or performance metrics.

## Security and platform gates
- A shared browser profile is NOT a security isolation boundary. Cookies and browser origin storage are shared by design.
- Browser sign-in is manual and browser-owned. The app must not read or export credentials/cookies/tokens.
- Navigation restrictions, URL allowlists, redirects, downloads, permissions, clipboard, and untrusted page content require provider-specific enforcement.
- No automated ChatGPT Web interaction or scraping via undocumented interfaces. Existing-chat automation stays disabled pending documented approval and live evidence.
- Browser installation must be separately authorized; no download, installation, or launch in this source-first phase.

## Blocking verification before install
1. Resolve actual browser provider (embedded WebView vs externally managed Chromium), platform support and update policy.
2. Demonstrate that one profile supports manual login across multiple tabs without credential copying.
3. Confirm session expiry/logout behavior and conversation binding with trusted evidence.
4. Prove lifecycle cleanup, crash recovery and process ownership; no silent killing of unrelated browser windows.
5. Confirm resource limits and performance targets with measured native evidence.
6. Compile frontend/Rust, run contract tests, then explicitly authorize browser install and pilot. Source review alone does not close these gates.

## Known source limitations
Current native Rust registry models per-workspace instance identity and resource reservations, but it is not a browser host. Earlier language about independent browser profiles is superseded by this shared-login decision. The pure SharedBrowserController is a planning/state projection only. No native or browser tests have run. The app's source may contain other defects; claiming zero blind spots would be unjustified.
