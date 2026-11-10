# MCP-friendly UI control contract (design only)

## Principle
Human UI and any future MCP adapter must call the same authorized workspace controller. MCP is not a license to automate consumer ChatGPT Web. No live MCP server or browser transport is implemented by this document.

## Stable identity and observable state
- Each workspace has an immutable opaque workspace_id independent of card order, display name, or current search/filter.
- Workspace state schema: workspace_id, display_name, conversation_binding_status, connection_status, activity_status, last_verified_at, state_revision, allowed_actions, error_code.
- Activity state must use UNKNOWN unless a trusted transport supplies evidence. Never infer Working/Done from UI animation or elapsed time.
- Every action result includes request_id, workspace_id, previous_revision, resulting_revision, status (APPLIED/REJECTED/UNVERIFIED), error_code and user_safe_message.
- UI controls expose semantic labels, stable test identifiers, aria-pressed for selection, and visible focus. Keyboard and MCP share controller semantics.

## Read-only initial tool surface
- list_workspaces(): stable IDs and current verified states.
- get_workspace(workspace_id): detail, capabilities and last verified state.
- get_ui_state(): selected ID, view mode, filter and controller revision.
- get_available_actions(workspace_id): only currently authorized actions.

## Bounded UI-only mutations (future)
- select_workspace(workspace_id, expected_revision): changes selected view; never sends prompts.
- rename_workspace(workspace_id, name, expected_revision): validates length, collisions and Unicode handling.
- set_view_mode(COMPACT|GRID): visual-only.
- set_workspace_filter(query): visual-only; must not change identity or selection.
- Each mutation requires permission checks, explicit result and audit event. Fail closed on stale revision.
- Do not expose open_browser, login, read_chat, send_prompt, operate, auto_continue until separately authorized supported host transport and QA exist.

## Concurrency and safety
- A single controller owns workspace selection and updates. State revisions prevent stale writes.
- Per-workspace command queues and idempotency keys apply to future asynchronous operations; do not claim these are implemented.
- Disconnect/restart must not mark actions successful; preserve only approved non-sensitive workspace metadata.
- Remote website content must not gain privileged Tauri or MCP command access.
- No password, session token, cookie or raw ChatGPT transcript storage.

## Ten-slot UX acceptance
- Ten named workspaces readable at desktop width, compact default; grid alternative; responsive narrow view.
- One primary browser area, not ten simultaneously live previews.
- Search never changes selected workspace or renumbers IDs.
- Focus mode expands primary area without losing selection.
- No status label claims Working, Done, Connected without verified evidence.
- Test keyboard-only traversal, screen-reader names, empty/error/disconnected/loading states.
- Source review is not native verification.
