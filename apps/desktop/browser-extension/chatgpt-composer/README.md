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
