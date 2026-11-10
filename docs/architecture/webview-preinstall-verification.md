# WebView pre-install verification plan

## Decision boundary
Tauri's system WebView is a provisional visual provider, not a proven ChatGPT session transport. Windows WebView2, macOS WKWebView and Linux WebKitGTK differ in profile storage, process model and API behavior. Do not assume that login persistence or ten views are equivalent across platforms.

## Target experiment (requires explicit authorization)
1. Confirm platform, installed system runtime and its update owner without installing a new browser.
2. Open one **user-operated** browser view and perform manual login. Do not inspect credentials, cookies or storage.
3. Check whether a second view using the same browser-managed data directory shares login and whether logout propagates. Never copy cookies.
4. Test distinct conversation navigation by manual operation; a URL alone is not authoritative evidence for automation.
5. Verify restart, tab disposal, session expiry and crash recovery. Rebind only after observed identity checks.
6. Measure memory, CPU, initial load and view-switch latency with 1, 4 and 10 logical workspaces, recording machine, OS, runtime and reproducible workload.
7. Check navigation redirects, downloads, external links, permissions and cross-origin boundaries. Keep the desktop app's Tauri command surface read-only until reviewed.

## Performance policy
One selected rendered view by default. Background work remains with the supported host, not with parked UI surfaces. Limit preview creation and expensive polling. Use event-based state updates when documented; otherwise bounded polling with backoff. Record metrics before claiming savings.

## Proof and blocker
The pure preflight module only checks the structure of operator-reviewed evidence; caller flags alone are not proof. The application has no trusted attestation broker and no authorized browser install. Therefore provider selection remains provisional and OPERATE remains disabled.
