# LazyPrompting Companion — shared Helium / WebView2 extension

The **same source-owned MV3 manifest and JS/CSS files** are packaged into
standalone Helium Chromium and the bundled Windows WebView2 profile.
Both have one in-page strip and one small in-page Settings menu. The strip
uses the source-owned LazyPrompting application logo, two aligned Context/Chat
metrics, a conditional status, a user-operated **New Chat** button and the
rightmost Settings gear. Neither browser variant
has a toolbar popup, manual token entry, bookmark UI, message
navigation, notes export, or a second settings page.

## UI

- **Context ~1.51M** is shown only when the original separately installed
  ChatGPT Usage Meter provides a parsed, rendered token estimate. Otherwise
  **Context —**; it is an estimate of chat-token usage, *not* a verified
  official context-window ceiling or remaining model allowance.
- **Chat 48x** is shown only if the currently mounted structural chat turns
  are indexed contiguously from the beginning. If the full number cannot
  be verified, **Chat —** (with a loaded-turn explanation on hover).
- **New chat soon** and **Switch chat** are inline planning statuses
  triggered by configurable estimated-token thresholds, initially 3.6M and
  4.0M. An upstream meter **Limit hit** indicator overrides planning.
  A service notice detected via the permitted bounded UI heuristic is
  marked **Possible ... limit**, not verified as an HTTP or provider cap.
  No separate toast is created.
- One **Settings** icon is always at the right edge of the strip.


## One-click New Chat — saved replacement then old-chat UI removal

The **New Chat** button appears before Settings in both Helium and WebView2.
It is activated only by a trusted user or authorized GUI interaction:

1. The extension stores the **exact Chat A conversation ID** and a
   per-tab action nonce in local browser storage; only the clicked tab
   can continue this rollover.
2. ChatGPT's blank New Chat page opens in the same tab. No content is
   copied, read or automatically submitted.
3. After the user **sends the first message on the blank page**, and the
   page has a **distinct persisted Chat B URL** plus a mounted turn, the
   extension looks for the exact Chat A entry in the original sidebar.
4. If there is exactly one matching row with its own options button,
   the extension clicks ChatGPT's UI **Delete** and its native confirmation.
   There is no extra LazyPrompting popup or bulk-delete action.
5. Missing/ambiguous/stale rows, missing confirmation, unsupported browser
   UI, or storage failure leave Chat A unchanged, with a short
   **Old chat retained** status. Destructive clicks never retry after
   interruption, and Chat B is never deleted by this workflow.

This is **UI-controlled deletion**, not a direct ChatGPT delete API.
An attempted confirmation is recorded as **DELETE_REQUESTED**, not
authenticated proof of removal from the account or server. We cannot
claim the operation or its selectors work on the installed browser
until actual Localtest.

**Native Work boundary:** The browser extension cannot check the Tauri
Work/PromptOutbox checkpoint and old-chat cleanup state or bind Chat B
into the native bookmark automatically. Those native safety gates remain
unchanged. A WebView2 Work-bound chat requires separate native-side
reconciliation; the site-level action is not an approved Work checkpoint.


## Settings — consistent in both environments

**Compact History** is On by default and may be toggled Off. Users may
keep Last 1/3/5/10/25 exchanges visible, choose Unlimited, or enter
Custom 1–1500. A pair of structural turns approximates a user/assistant
exchange; a multi-tool or streamed exchange may be structured differently,
so an exact semantic count is not guaranteed. Older currently mounted
turns are only styled (reversibly) and can be restored using **Show earlier
messages**. No ChatGPT turn is deleted, moved or downloaded by Companion.
The existing \`content-visibility:auto\` optimization stays bounded,
preserves newest eight, selection, focus, streaming and fails closed
above 3,000 turns or without CSS support. RAM/latency gains are unmeasured.

**Context Warnings** shows only two levels. Edit reveals two numeric
million-token fields; Done validates increasing values and saves them.
Compact toggles/selection save on change. Reset defaults restores Compact
On, Last 10, 3.6M and 4.0M. Settings persist in extension-local storage
**per browser profile**, so the interface is identical but Helium and
WebView2 settings do not sync automatically.

## Capability limits and source ownership

The original Usage Meter is a separate, third-party extension and is
**not** redistributed or installed by WebView2. Its provider-internal
requests/fetch interception remain outside this source-owned extension.
When present in the same signed-in browser, Companion only reads its
already visible token scalar / limit-hit label. No transcript extraction,
ChatGPT cookies, private endpoints, native Send routing, or remote
telemetry. The original meter's strip is moved offscreen while a token
estimate is available to avoid a duplicate display; this requires real
Helium acceptance. If the original meter is absent in WebView2, **Context
—** and no token-derived warning is shown rather than fabricating data.

WebView2 uses the existing opt-in native loader
\`LAZY_OPERATOR_COMPOSER_ENABLE=1\`. Its NSIS resource map bundles all
canonical JS/CSS/manifest files and Rust verifies them byte-for-byte.
The local development override remains
\`LAZY_OPERATOR_COMPOSER_DIR=<absolute unpacked directory>\`.
Its native Work owner, operator-reported chat bookmark and 4M
**Send once** rollover guard remain separate, unchanged and authoritative.
The Companion does not independently block sending, commit native
checkpoints, or claim provider-limit attestation. Deleting the previous
chat is only attempted after an explicit New Chat action through the
site's own visible menu and dialog; it neither settles native Work cleanup
nor certifies server-side deletion.

The Helium package is generated from the identical canonical assets by
\`npm run package:helium-companion\`; see
[Helium installation and behavior](../helium/README.md).

## Proof

\`npm run test:chat-companion\` and
\`npm run test:helium-companion\` contain authored source assertions.
**Neither has run on the user's PC** in this ChatGPT/GitHub session.
The exact-HEAD Helium/WebView2 runtime, ChatGPT selector behavior,
Windows package and RAM/scroll outcomes remain **NOT_EXECUTED**.

