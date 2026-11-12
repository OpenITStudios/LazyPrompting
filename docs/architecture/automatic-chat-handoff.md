# Automatic Chat Handoff — retain previous conversations

Use ordinary, persistent ChatGPT Chat (non-temporary) for every workspace. On app, browser or host crash, first attempt authenticated reattachment to the **same existing chat** and reconcile the pending outbox; never create a replacement merely because the process restarted. If session identity or a pending send cannot be verified, pause for operator recovery. Only for verified context pressure or an explicit operator-requested transition may a replacement **ordinary persistent chat** be considered through an approved host capability. New chat is not a rate-limit bypass, and Temporary Chat is not an allowed handoff target.

Required stages: detect context pressure from trustworthy host evidence; stop new prompts; reconcile any pending send; create a bounded Context Capsule with goal, decisions, constraints, progress, evidence and next action; reserve one handoff; request a new session; verify the new session identity and capsule acceptance; atomically update the canonical workspace session binding; mark old session SUPERSEDED/RETAIN_ARCHIVED; resume only after verification.

The source-only `prepareChatHandoff` and `verifyChatHandoff` implement fail-closed checks. `HandoffLedger` reserves and records activation. These modules do NOT create chats, modify the workspace registry or archive a real ChatGPT conversation. The host must implement authenticated create-session, session verification and canonical registry CAS. Never delete old chats automatically.

Blindspots: duplicate new chats after uncertain creation; concurrent manual messages in old session; stale context/evidence; pending tool calls; external attachments not transferred; user permissions; partial capsule; multi-device races; unsupported transport. Uncertain outcomes require reconciliation, not retry.

Tests authored but not executed. No live handoff claim.
