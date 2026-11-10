# Response lifecycle for non-blocking chats

ResponseLifecycle scans acknowledged pending prompts across up to ten workspaces independently of dispatch order. It delegates authenticated terminal response verification and outbox reconciliation to ResponseObserver, then calls an injected evaluator. Response evaluation is advisory and cannot grant permissions. If evaluation fails after response closure, return EVALUATION_REQUIRED; a production evaluator needs a durable evaluation queue to avoid losing the follow-up.

RESERVED and uncertain-delivery prompts are never silently retried or treated as completed. The lifecycle does not access user project repositories. A real ChatGPT host transport, durable evaluation queue and native tests remain outstanding.
