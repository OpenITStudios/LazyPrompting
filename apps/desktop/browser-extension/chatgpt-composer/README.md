# ChatGPT composer extension — operator send-only

This **separate** Manifest V3 extension supplies a minimal user-triggered
composer for the active ordinary ChatGPT tab. Enter text in the extension popup
and choose **Send once**. The content script fills an empty composer and
clicks its Send button once; it does not use desktop mouse/keyboard input.

## Scope and current proof

- The extension requests only `https://chatgpt.com/*`, `activeTab`, and the
  current active tab. It does not request cookies, networking, transcript
  access, broad host permissions, or persistent storage.
- It refuses temporary-chat query variants, occupied/disabled composers,
  invalid text and a concurrent send attempt. UI click is **not** delivery
  confirmation; inspect the conversation after sending.
- The popup is intentionally operator-triggered: **no unattended dispatch,
  answer reading, or automatic follow-up**. Existing native host authority,
  prompt outbox and per-workspace leases must not be bypassed.
- This directory does **not** replace the loopback-only fixture extension
  under `../`. That fixture has integrity-pinned files and a separate debug
  WebView2 profile.
- This source has not been compiled, loaded into Tauri WebView2, or exercised
  against live ChatGPT. Composer selectors may need adaptation to the site.
- Installation into WebView2, host-owned workspace binding and a supported
  authenticated host-to-extension command path are **not implemented**.

This is a standalone UI-send increment, not a complete ten-workspace
automation integration.

## Optional native WebView2 loader (source integration)

The native workspace WebView2 builder now has a separate, explicitly opted-in
loader for the byte-identical operator composer bundle. Set both
`LAZY_OPERATOR_COMPOSER_ENABLE=1` and `LAZY_OPERATOR_COMPOSER_DIR` to the
absolute directory containing this exact bundle **before launching the app**.
A missing, modified or incomplete bundle fails closed. The existing fixture
debug profile and its integrity pins are unaffected.

This merely makes the extension eligible for loading into the normal shared
WebView2 profile. The WebView2 embedded view does **not** expose a standard
Chrome toolbar extension-action popup, so the standalone popup cannot yet be
opened through the existing LazyPrompting main-window controls. No native
command is permitted to send through the extension; the source does not claim
that an extension is installed, active or that any message was sent. An
operator-visible trigger in the existing main window remains needed before
this becomes an integrated send workflow. No unattended consumer-chat
transport or response reader has been added.

## Operator send from the LazyPrompting main window

The reviewed MCP manual-handoff draft now has a **Send once** action in the
main desktop UI. This action uses a separate, fixed-source native WebView2
script after main-window, workspace, URL and prompt validation. It does not
invoke the extension popup (which an embedded WebView2 does not expose), and
is disabled for automatic MCP dispatch. The standalone extension remains an
independent manual popup implementation. A command acknowledgement means
only that the UI action was queued, **not** that a ChatGPT turn was accepted.
The host deduplicates the same draft per workspace during its process lifetime.
Native Windows/WebView2 behavior and actual delivery are NOT_EXECUTED.
