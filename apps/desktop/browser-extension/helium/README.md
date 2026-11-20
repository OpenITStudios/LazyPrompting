# Helium — LazyPrompting Companion

Helium officially supports Chromium extensions. This uses the same
source-owned Manifest V3 Companion as WebView2, with one standalone
manual-estimate module rather than a separate project.

## Install

1. Run `npm run package:helium-companion` from the repository root.
   Output is `artifacts/runtime/helium-companion/`. If that folder
   already exists, the script stops rather than overwriting it.
2. In Helium, open `helium://extensions` or `chrome://extensions`.
3. Enable Developer mode → Load unpacked → select that output folder.
4. Reload an ordinary saved `https://chatgpt.com/c/<uuid>` conversation.
5. The toolbar enables **Compact History** by default for a new chat,
   with a per-chat **Compact off** button to revert it.
6. Click **More → Helium · chat estimate**, save a manual count like
   `3,600,000` or `Chat ~3.60M`. Each chat uses its own extension
   local-storage key and shows a 3.2M, 3.6M or 4M advisory when reached.

The Helium variant does not synchronize estimates with native Work and
does not block ChatGPT's own Send button. It only classifies possible
limit notices in short non-message service alerts. It cannot observe
HTTP 429 or conversation content with authorized mechanisms.

## Performance and safety

Compact History applies reversible `content-visibility:auto` only to
older currently mounted structural turns, preserving the newest eight,
active selections, focused controls and streaming turns. This allows
Chromium to skip rendering offscreen content, **not** prevent ChatGPT
from downloading old messages, remove DOM nodes or guarantee RAM savings.
It never removes, clones or reparents ChatGPT elements.

Only `storage` plus `https://chatgpt.com/*` are requested; no
private ChatGPT API, cookie access, transcript extraction, fetch
interception, external telemetry or background polling.

**Proof:** SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN; Helium install,
real ChatGPT UI, and performance: NOT_EXECUTED.
