# Helium — same ChatGPT Companion as WebView2

The Helium and embedded WebView2 editions now package the **same**
Manifest V3 extension files, with one settings owner and no separate popup,
bookmarks, navigation buttons or manual token fields.

## One shared interface

One compact strip beside the ChatGPT composer displays:

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
site selector compatibility, memory/scroll improvements: NOT_EXECUTED.

