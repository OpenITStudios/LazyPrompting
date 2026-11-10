# Trusted host health snapshot and fairness

TrustedHealthSnapshot accepts injected host-owned workspace, session signal and prompt outbox readers. It calls the pure scheduler and does not send prompts, create chats or read project repositories. Host signals must be authenticated by the integration boundary; model-generated text is not status proof.

The scheduler supports an explicit round-robin cursor to avoid permanently favoring the first two workspaces. The caller must persist nextCursor only after a trusted scheduling cycle and must reconcile concurrent sessions, pending prompts and outbox state. The cursor is not itself a durable scheduler or an execution guarantee.

Context limits may prepare handoff; account limits wait; uncertain deliveries reconcile. ChatGPT owns task context. Tests authored, not executed; no live ChatGPT host transport connected.
