# LazyPrompting Companion — one extension, operator-first

This is an **independently authored** Manifest V3 extension in the existing
`chatgpt-composer/` folder. It replaces the old separate composer popup
instead of loading another extension or copying ChatGPT Usage Meter source.
All normal workspace WebViews share the existing `browser-01` profile.

## Available source functionality

- **Turn navigation:** Previous / Next moves among the currently *loaded*
  structural ChatGPT turns. Virtualized messages may not exist in the DOM;
  the displayed "N shown" is **not** a full conversation count or tokens.
- **Decision notes:** Save up to 32 short **operator-authored** labels per
  conversation URL in extension-local storage. Jump back when its structural
  turn marker is loaded; otherwise review and scroll manually. These notes
  are pointers for a human, never verified project decisions or checkpoints.
- **Selective Copy:** With text manually selected, click **Copy** to invoke
  the browser's own selected-text copy operation. No programmatic transcript
  read, output cache, or automatic copying.
- **Export notes:** Downloads only the operator's own short notes as Markdown.
  It does **not** export the ChatGPT transcript or attachments.
- **Source review:** Opens one explicitly pasted public HTTPS URL for a human
  to inspect. This is **not** factual verification or an automated link audit.
- **Compact History (opt-in):** Per-saved-chat **Compact off/on** button.
  When on, the source-owned helper adds CSS `content-visibility:auto`
  only to older **currently mounted** structural turns. It measures each
  eligible turn's height in **48-turn batches**, reading heights before
  applying CSS in each batch, for a stable intrinsic-size fallback.
  The newest eight turns, streaming turns, focused controls and
  selected text are excluded. Off, switching chat, and unsupported
  browser CSS remove only Companion styles; the original DOM remains
  mounted. The preference is stored under the current conversation ID
  in the existing extension-local storage, independently for each chat.
  Above 3,000 mounted turns, the hint pauses instead of scanning without
  bounds. Remaining bounded batches are scheduled as one-shot work,
  not recurring background polling. This is a rendering experiment, **not** a memory saver receipt,
  complete conversation count, or guaranteed improvement.
- **Limit notice hint:** The toolbar reads only bounded, non-conversation UI
  service-alert candidates. It distinguishes possible chat-length refusal
  from usage/model quota warnings. No model messages, transcripts, responses,
  network traffic or private endpoints are read. The hint cannot confirm
  an actual limit or change native permissions. For a genuine conversation
  length error, confirm it in ChatGPT then select **Work > Mark chat full**.
- **4M chat planning:** The toolbar shows **New Chat by 4M** as a planning
  target, not a live token count. The canonical operator-reported estimate
  remains in **LazyPrompting > Work**. It accepts numeric input, comma-grouped
  numbers, or pasted short Usage Meter labels (e.g. `Chat ~4.44M`).
  At 3.2M the native status advises a checkpoint; at 3.6M it recommends
  New Chat; at 4M it automatically prepares the locally saved rollover and
  holds native Send once. A mistaken estimate can be corrected explicitly
  before cancelling preparation. Chat B binding/old-chat cleanup remain
  manual. This is not an official ChatGPT thread limit or automatic
  limit-hit detection. The public Usage Meter uses undocumented private
  ChatGPT endpoints/fetch interception, which are intentionally not used
  by this extension, and no third-party source code was copied.

The compact toolbar appears beside the composer in ordinary
`https://chatgpt.com/c/<uuid>` chats. It is keyboard-focusable and adapts
to narrow widths / reduced-motion preferences. It does not run on
Temporary Chat, the homepage, a foreign origin, or supporting sites.

## Permissions, ownership, and integration

Manifest requires **only** `storage` and the `chatgpt.com` origin.
There are **no** background workers, extension popup, account cookies,
session-token access, private ChatGPT endpoints, fetch interception,
automatic transcript reading, recurring API polls, output ingestion,
model inference, or alternate prompt-send path.

The Windows host uses its existing opted-in, byte-pinned WebView2 loader:
`LAZY_OPERATOR_COMPOSER_ENABLE=1`. The NSIS build bundles the exact
unpacked Companion manifest and JS/CSS assets under `$RESOURCE/companion/`,
so no separate directory argument is needed for the installed build.
`LAZY_OPERATOR_COMPOSER_DIR=<absolute unpacked directory>` remains
available as an explicit development override. The native loader verifies
all bundled assets byte-for-byte. The loopback fixture extension is unchanged.
Installation and actual ChatGPT/WebView2 behavior still need Windows acceptance.

The existing **native** `Send once` / PromptOutbox / STOP owns every send.
The existing native `chat-bookmarks` record owns the operator-reported
token estimate and FULL confirmation. An installed MCP client can request
the new read-only `workspace_chat.rollover_status` under the *same four*
MCP public tools, with trusted-native workspace lease and exact URL scope.
It never reads extension notes or changes a goal, approval or send state.
Codex may advise checkpoint preparation, but cannot infer thread capacity.

## Previous Chat Cleanup

When an operator saves a different ordinary ChatGPT conversation
as the active workspace bookmark, native LazyPrompting preserves
the previous URL for manual cleanup review. The **main Work panel**
owns this interaction. This Companion extension does not request
Delete, intercept ChatGPT account calls, inspect the transcript,
receive a destructive privilege, or add another popup.

Delete is deliberately **not automatic**: the native host checks
the canonical PromptOutbox and exact old/new URL, prompts the
operator to confirm checkpoint and Chat B readiness, and offers
the old URL in a supporting tab. The operator must delete it
through ChatGPT's own UI and separately report the result.
Only the local cleanup record is cleared; remote deletion
remains unverified by LazyPrompting.

## Proof and holds

`npm run test:chat-companion` and the Rust native catalog/source fixtures
are **authored only**; they have not been run in this ChatGPT+GitHub source
session. Real WebView2 installation, toolbar interaction, ten-workspace
behavior, keyboard accessibility, Windows packaging, MCP client invocation,
ChatGPT site compatibility and memory impact remain **NOT_EXECUTED**.
Compact mode specifically needs an A/B comparison on the same long
conversation: input latency, scroll position, active DOM, and WebView2
renderer private commit and working set (the native sampler reports the
**shared profile**, not one-chat allocation). Rendering skips are not
proof of RAM reclaimed; turn retention and toggling off must remain safe.

Third-party repositories (Usage Meter, Scroll, Threadmark and others)
were reviewed for product ideas only. No code or license text from them
was copied into this bundle. Full chat-token automatic capture and
machine-checked source claims are deliberately not advertised.
