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


## One dynamic status — no stacked indicators

The Companion now has **one priority resolver and one status slot**.
The primary order is **Limit hit → Error (Retry if available) →
Possible usage/chat limit → Switch chat → New chat soon → none**.
Only the winning status appears; lower-priority conditions remain
known and reappear if the higher condition clears. A failed New Chat
start is surfaced through the same slot, and the older cleanup-result
notices remain lower-priority fallbacks. The original Context and Chat
metrics never turn into a second warning bar.

The single row uses a bounded flexible gap between the left metrics
and New Chat / Settings on the right. When the status changes length,
the action controls remain right-aligned instead of shifting alongside
the status. At narrow widths the status label can abbreviate but
the user-operated Retry remains available where safe.

This does not introduce extra popups, polling, prompt sending, auto-retry,
ChatGPT private endpoints, or native Work permissions. The same canonical
source is packaged for Helium and embedded WebView2. Layout/transition
behavior on real browsers remains NOT_EXECUTED.

## WebView2 native Work visibility (read-only)

The existing status resolver also exposes a bounded
`data-status-kind` attribute on its one existing Companion toolbar.
The Windows Native Host can inspect this attribute via its owned WebView2
on an exact native-bookmarked ChatGPT conversation. It validates both
the URL and signal, and reports this **unverified UI hint** alongside
plugin/Codex statuses in the existing Work panel. No chat text,
provider response, token value, cookie or account ID is read or
transmitted, and no status can authorize a send, Retry or delete.

This is deliberately **not** an extension-originated privileged
command bridge or a second prompt transport. It adds no extension
permission and does not enable unattended web continuation.
The standalone Helium build shares the same status attribute but
has no installed native readback adapter yet.

## Response error — one compact Retry control

The shared Helium/WebView2 Companion observes the newest mounted ChatGPT
turn for native response-error markers and checks bounded service notices.
Old failed turns, chat text mentioning errors, and red styling alone
are not interpreted as an active error.

When a genuine current error is present, the toolbar shows **Error · Retry**
without adding a second settings menu. Retry is only available when there
is exactly one visible enabled ChatGPT-owned Regenerate/Retry control and
generation is not already running. A **trusted user click** forwards to the
original control at most once for that error instance, never sends a new
prompt, and never retries usage/chat limits.

This is not unattended auto-retry. The extension cannot attest native
Work/PromptOutbox send and delivery state. Missing or changed ChatGPT
controls fail closed; no error notification is proof of an unsent prompt.
Real UI compatibility, outcome and usage impact: NOT_EXECUTED.

## New Chat — navigation only, previous chat preserved

The shared **New Chat** button remains beside Settings. An explicit
trusted click on the current ordinary saved chat opens ChatGPT's blank
composer. This does **not** send a message, delete Chat A, replace a native
bookmark, or confirm native Work rollover. There is no Delete-menu click,
confirmation, background cleanup, automatic retry or extension-side storage
resume. Any previously pending auto-delete record is inert after upgrading.

This is intentional: the shared Helium/WebView2 content script cannot
verify native Work's PromptOutbox, checkpoint or chat rebind. In WebView2,
use Work's existing Prepare New Chat and reviewed manual Previous Chat
Cleanup. In standalone Helium, keep the earlier chat or manually delete it
using ChatGPT's own controls after review. Automatic deletion remains held.

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
checkpoints, or claim provider-limit attestation. Companion deliberately retains the old chat. Any deletion is a separate
manual action after Work or standalone ChatGPT review.

The Helium package is generated from the identical canonical assets by
\`npm run package:helium-companion\`; see
[Helium installation and behavior](../helium/README.md).

## Low-overhead observer behavior

The common Companion and its New Chat controller now ignore their own
DOM changes and child-list churn inside existing conversation turns.
Structural changes to the chat layout, visible Usage Meter, and bounded
service alerts still trigger coalesced refreshes. The Context, Chat and
inline status labels are only rewritten if their values actually change.
The New Chat navigation controller has no storage read, rollover observer
or delete timer. Previously pending extension storage cannot revive an old
destructive action after upgrade. This avoids further storage reads during
ChatGPT streaming. It does not claim measured CPU/RAM improvements.

These changes adapt general performance and error-recovery lessons from
the three reviewed extensions. No third-party source code or assets are
copied. ChatGPT Slow Fix's recent-message visibility is already represented
by the existing reversible Compact History settings; batch auto-send,
automatic prompt retries, additional panels and broad permissions were
explicitly not adopted.

## Proof

\`npm run test:chat-companion\` and
\`npm run test:helium-companion\` contain authored source assertions.
**Neither has run on the user's PC** in this ChatGPT/GitHub session.
The exact-HEAD Helium/WebView2 runtime, ChatGPT selector behavior,
Windows package and RAM/scroll outcomes remain **NOT_EXECUTED**.

