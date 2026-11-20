# Helium: always-on Compact History + Usage Meter message count

The original [ChatGPT Usage Meter](https://github.com/SelectorsHub/ChatGPT-Usage-Meter)
owns automatic **Chat ~X tokens** and **Limit hit** indicators. The independent
LazyPrompting add-on provides **always-on Compact History** and places the
currently loaded message count immediately beside Usage Meter's Chat token
estimate. No second toolbar, no token input, no bookmarks, no navigation,
no popup, no settings, and no required user action after installation.

## Install

1. Install the original ChatGPT Usage Meter separately in Helium, following
   its repository's instructions. This gives the automatically estimated
   token and model limit indicators.
2. From the LazyPrompting repo root, run `npm run package:helium-companion`.
   It creates `artifacts/runtime/helium-companion` without overwriting
   existing files.
3. Open `chrome://extensions` (or `helium://extensions`) in Helium,
   enable Developer mode, then Load unpacked and choose that folder.
4. Open an ordinary saved ChatGPT conversation.

The Usage Meter displays a chat-token estimate; this add-on displays
`48 pesan termuat` beside it, based on currently mounted turn markers.
It is **not** the total lifetime message count: ChatGPT may virtualize or
unload older messages. With 3,001 or more mounted turns it shows
`3000+ pesan termuat` rather than a fabricated exact total.

At observed estimates of 3.2M, 3.6M, and 4M, the add-on shows one small
dismissible notification to checkpoint, prepare a new chat, or move chats.
The original Usage Meter alone owns its own limit-hit indication. If
Usage Meter is absent, this add-on does not invent token values or create
a substitute toolbar.

## Always-on performance behavior

The existing Compact History helper automatically applies
`content-visibility:auto` to older loaded structural turns while
protecting recent eight turns, focused controls, selection, and streaming.
There are **no switches**. For more than 3,000 mounted turns or unsupported
CSS, the implementation fails closed instead of forcing unsafe changes.
CSS cannot stop ChatGPT downloading historical content or guarantee
reduced RAM usage.

Only the original Usage Meter's already visible scalar token estimate
and structural turn markers are examined; no messages, credentials, cookies,
provider private APIs, or page network traffic. No extension storage or
background worker permissions. The upstream source is not bundled because
no license authorization was established.

**Evidence:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN. Live Helium
installation, actual ChatGPT UI and performance: NOT_EXECUTED.
The Windows WebView2 Companion is unchanged.
