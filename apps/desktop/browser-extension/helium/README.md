# Helium — same ChatGPT Companion as WebView2

The Helium and embedded WebView2 editions now package the **same**
Manifest V3 extension files, with one settings owner and no separate popup,
bookmarks, navigation buttons or manual token fields.

## Shared source, separate native connection

Helium and WebView2 both expose the same bounded
`data-status-kind` on the one Companion toolbar, but only the
embedded Windows WebView2 can currently be sampled by LazyPrompting's
native Work read command. This is **UI observation only**, not
a native messaging / automatic prompt permission. No Helium native
host adapter or nativeMessaging permission is enabled.

## One shared interface

One compact strip beside the ChatGPT composer uses the actual repository
LazyPrompting app-mark (not the temporary LP letters) and displays:

- **Context ~X**: an estimated conversation-token figure, when the independently
  installed original ChatGPT Usage Meter exposes that figure in its rendered UI.
  Otherwise **Context —**. No official model context capacity is inferred.
- **Chat Nx**: an exact count only if structural turn indexes from the
  beginning of the chat are complete and contiguous; otherwise **Chat —**.
- **New chat soon** (default 3.6M) and **Switch chat** (default 4.0M):
  inline planning warnings that can be edited in Settings.
- **Limit hit**: when the original Usage Meter exposes its detected limit-hit
  status. A bounded ChatGPT service-alert heuristic is labeled
  **Possible ... limit**, never asserted as verified.
- One **New Chat** button immediately before Settings. On a trusted
  click it opens a blank ChatGPT composer and retains Chat A. The
  extension never auto-deletes, submits a message, retries, or rebinds
  native Work. Prior chat cleanup is a separate manual review.
- One inline **Error · Retry** state for a current failed ChatGPT response.
  The Retry action needs an explicit user click and reuses ChatGPT's native
  Regenerate/Retry control; it does not send a second prompt automatically.
- One **dynamic status slot**. Priority is Limit hit, Error/Retry,
  possible limit, Switch chat, New chat soon, otherwise hidden.
  When a higher-priority status clears, the applicable lower warning
  returns. New Chat failures and cleanup notices use the same slot,
  without extra badges or toasts. New Chat and Settings stay aligned
  at the right of the single flexible row.
- One **Settings** gear at the far right.

The separately installed Usage Meter is *not* bundled. Its own strip is
moved offscreen when Companion can read its token estimate so users do not
see two competing bars. No undocumented ChatGPT API or third-party source
code is copied into Companion. When that meter is not installed, automatic
token measurement cannot be claimed in either environment.

## Settings (identical on both)

**Compact History** defaults **On**. Keep visible: Last 1 / 3 / 5 / 10 / 25,
Unlimited, or Custom (1–1500 exchanges). One exchange is treated as up to
two structural user/assistant turn nodes. Older loaded turns are hidden
reversibly; **Show earlier messages** expands them without fetching,
rewriting or deleting chat content. The existing conservative
\`content-visibility:auto\` hint still applies to older offscreen turns.
Disable Compact to restore the ChatGPT DOM appearance without companion
styles. Unsupported CSS or more than 3,000 mounted turns fails closed.
Actual RAM savings are not measured.

**Context Warnings** has two thresholds. Choose Edit, adjust values in
millions, choose Done; invalid ordering is rejected. Compact settings save
immediately. Reset defaults restores On/Last 10/3.6M/4.0M. Settings are
local to each extension profile; they do not automatically sync between
Helium and WebView2.

**WebView2 native Work limitation:** The source/UI is identical in Helium
and WebView2. Neither can authenticate the native Work checkpoint/outbox,
so neither extension performs automatic deletion. Native Work keeps its
existing manual reviewed cleanup; Helium users can delete manually in
ChatGPT after reviewing the old conversation.

## Installation

1. From the LazyPrompting repo root run \`npm run package:helium-companion\`.
   It creates \`artifacts/runtime/helium-companion/\` and refuses to
   overwrite that folder.
2. In Helium, open \`chrome://extensions\` or \`helium://extensions\`,
   enable Developer mode and Load unpacked using that folder.
3. Optionally install the original
   [ChatGPT Usage Meter](https://github.com/SelectorsHub/ChatGPT-Usage-Meter)
   separately if you want its automatic token estimate and limit detection.
4. Open a saved \`https://chatgpt.com/c/<uuid>\` conversation.

WebView2 is still installed through the existing byte-pinned native loader
using \`LAZY_OPERATOR_COMPOSER_ENABLE=1\`. It does not install the original
third-party Usage Meter or read its private endpoints.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Helium/WebView2,
New Chat navigation-only behavior and memory/scroll: NOT_EXECUTED.

