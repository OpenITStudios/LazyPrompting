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

## Operator-only interrupted lock repair

The main-window `recover_interrupted_operator_outbox`
command uses the already authenticated native gateway
and canonical app-local PromptOutbox lock owner metadata.
It requires a native Windows confirmation and verifies
a known dead owner before removing one stale, matching
lock. It neither clears a pending ChatGPT attempt nor
sends another prompt. Unknown or legacy ownerless
locks fail closed and require separate native inspection.
Current source is not matched installed Windows QA.

## Read-only send-attempt status for Activity

The new main-window Tauri command
`operator_chat_attempt_status` reads the existing
authenticated native gateway's app-local pending attempt.
The renderer receives only a controlled status category
and false delivery/result/next-prompt flags—no IDs,
digests, conversation URL or response content.
This read is on demand, not a new polling service.
Manual review and interrupted-lock recovery keep their
separate user-facing permissions. Native fixtures are
authored but not executed in this source-only phase.

## Optional bounded OpenAI Platform API goal

The current Tauri desktop now registers
`api_goal_start`, `api_goal_status` and
`api_goal_stop` in `api_goal_controls.rs`.
Only the main window can start a separate API goal.
The operator sees a native Windows cost/turn/model
approval dialog. The original authenticated
`GatewaySession` owns the private
`lazyprompting/apiGoal` request; the gateway
never exposes the API key to renderer/public MCP.

No OpenAI client or paid request is made unless
the native operator has approved the exact scope and
the host reads an operator-configured `OPENAI_API_KEY`
after that consent. The gateway does not inherit it
at startup.
Run status and STOP operate on the same native
app-local PromptOutbox owner. After uncertain
completion the run is held for reconciliation;
no automatic restart or duplicate API request.
This is SOURCE_COMMITTED, not a Windows binary
test or authorization to incur API charges.

### API secret passage in the native host

`GatewayChild` clears inherited environment. The
main-window `api_goal_start` command reads
`OPENAI_API_KEY` only after the operator approves
a paid run, validates its shape, and forwards it
inside that single authenticated local gateway
request. Neither the Svelte renderer nor ordinary
MCP clients can access the credential. No key
or response body is stored in the outbox.
