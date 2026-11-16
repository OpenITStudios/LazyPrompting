# Native Desktop Shell — Current Source

The Windows desktop is a Tauri/Rust host with a Svelte UI, scoped
WebView2 browser workspaces, the installed four-tool stdio MCP facade,
the packaged Node gateway, native STOP and operator-confirmed actions.
See [the main README](../../../README.md),
[the current state](../../../docs/operations/current-state.md)
and [desktop acceptance gates](../../../docs/validation/localtest-readiness.md).

## Offline Browser AI fixture (source candidate, not installed acceptance)

The native `lightpanda_preview` command opens, reads or closes only the
fixed local Lightpanda preview at `127.0.0.1:1425/browser-preview.html`.
The new `lightpanda_preview_action` command accepts only
`toggle_checkbox` (one click) or `fill_search` (a bounded text value).
It requires the main window and a separate Windows operator confirmation.
Rust derives the private native target/document witness, reserves the
canonical app-local PromptOutbox row through the packaged gateway, seals
`DISPATCH_PENDING`, verifies the exact on-disk scope before consuming a
single target grant, performs one CDP operation and reads back the exact
offline control. A successful result is independently matched to the
persisted `VERIFIED` receipt. Any uncertain result is held and never
replayed. The Browser Activity panel is only an operator test surface.

No public-site action, arbitrary selector, model/Code Mode browser
mutation, authentication capture or unattended ChatGPT Web operation
is exposed by this feature. Source review is **not** installed
Lightpanda/CDP, Windows compilation, or browser QA proof.
Historical Windows evidence applies only to its tested revision.
The existing app capability boundaries, secure profile handling
and separate release gate still apply.
