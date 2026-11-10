# Automatic Chat Handoff — retain previous conversations

When a chat reaches context pressure, preserve the same workspace/task identity and create a replacement session only through an authenticated, supported host capability. Do not confuse context exhaustion with model/account rate limits: new chat is not a rate-limit bypass.

Required stages: detect context pressure from trustworthy host evidence; stop new prompts; reconcile any pending send; create a bounded Context Capsule with goal, decisions, constraints, progress, evidence and next action; reserve one handoff; request a new session; verify the new session identity and capsule acceptance; atomically update the canonical workspace session binding; mark old session SUPERSEDED/RETAIN_ARCHIVED; resume only after verification.

The source-only `prepareChatHandoff` and `verifyChatHandoff` implement fail-closed checks. `HandoffLedger` reserves and records activation. These modules do NOT create chats, modify the workspace registry or archive a real ChatGPT conversation. The host must implement authenticated create-session, session verification and canonical registry CAS. Never delete old chats automatically.

Blindspots: duplicate new chats after uncertain creation; concurrent manual messages in old session; stale context/evidence; pending tool calls; external attachments not transferred; user permissions; partial capsule; multi-device races; unsupported transport. Uncertain outcomes require reconciliation, not retry.

Tests authored but not executed. No live handoff claim.
