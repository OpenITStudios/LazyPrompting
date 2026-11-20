# Helium — LazyPrompting Companion

Helium officially supports Chromium extensions. This uses the same
source-owned Manifest V3 Companion as WebView2, with one standalone
manual-estimate module rather than a separate project.

## Compact usage-style interface

The main strip is now a single-line pill: LP · local chat estimate · possible
limit notice · shown-turn indicator · Compact · Settings · Collapse.
Navigation, selection copying, bookmark notes and source review are in
the anchored ⚙ Settings panel instead of occupying multiple composer rows.
The Helium toolbar action opens a dedicated compact popup for the **last
observed** chat estimate, 4M personal planning progress and settings.
The separate Options page includes visibility, default Compact and default
collapse controls, plus explicit local-estimate clearing.

No 5-hour/weekly quota percentages or reset times are displayed without a
verified source. The upstream usage meter's visual organization was studied,
but its source code and branding were not copied.

## Install

1. Run `npm run package:helium-companion` from the repository root.
   Output is `artifacts/runtime/helium-companion/`. If that folder
   already exists, the script stops rather than overwriting it.
2. In Helium, open `helium://extensions` or `chrome://extensions`.
3. Enable Developer mode → Load unpacked → select that output folder.
4. Reload an ordinary saved `https://chatgpt.com/c/<uuid>` conversation.
5. The toolbar enables **Compact History** by default for a new chat,
   with a per-chat **Compact off** button to revert it.
6. Click **⚙ Settings → Helium · chat estimate**, save a manual count like
   `3,600,000` or `Chat ~3.60M`. Each chat uses its own extension
   local-storage key and shows a 3.2M, 3.6M or 4M advisory when reached.

Use the browser extension icon to open the Popup. Its switches update
the in-page strip (show/hide, default Compact and default collapsed state)
without reloading the website in a typical Chromium extension runtime;
per-chat overrides take priority. These behaviors still require live Helium
acceptance before being claimed as verified.

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
