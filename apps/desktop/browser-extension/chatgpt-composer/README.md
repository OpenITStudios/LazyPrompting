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
- **Chat length:** Shows only loaded structural turn count in the browser.
  The canonical estimated-token field remains in **LazyPrompting > Work**
  until a documented and permitted total-conversation data source exists.
  The native operator-report limit is now 100M tokens, allowing the user's
  observed 1.13M figure. An unverified 1M+ estimate triggers a *voluntary*
  checkpoint advisory, not automatic rollover or a percentage-full claim.

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
`LAZY_OPERATOR_COMPOSER_ENABLE=1` and `LAZY_OPERATOR_COMPOSER_DIR=<absolute unpacked directory>`.
The existing names remain for config compatibility; the bundle now contains
`manifest.json`, `companion/core.js`, `companion/toolbar.js` and
`companion/toolbar.css`. The root loopback fixture extension is unchanged.
This source opt-in and a valid folder do not prove installed WebView2 behavior.

The existing **native** `Send once` / PromptOutbox / STOP owns every send.
The existing native `chat-bookmarks` record owns the operator-reported
token estimate and FULL confirmation. An installed MCP client can request
the new read-only `workspace_chat.rollover_status` under the *same four*
MCP public tools, with trusted-native workspace lease and exact URL scope.
It never reads extension notes or changes a goal, approval or send state.
Codex may advise checkpoint preparation, but cannot infer thread capacity.

## Proof and holds

`npm run test:chat-companion` and the Rust native catalog/source fixtures
are **authored only**; they have not been run in this ChatGPT+GitHub source
session. Real WebView2 installation, toolbar interaction, ten-workspace
behavior, keyboard accessibility, Windows packaging, MCP client invocation,
ChatGPT site compatibility and memory impact remain **NOT_EXECUTED**.

Third-party repositories (Usage Meter, Scroll, Threadmark and others)
were reviewed for product ideas only. No code or license text from them
was copied into this bundle. Full chat-token automatic capture and
machine-checked source claims are deliberately not advertised.
