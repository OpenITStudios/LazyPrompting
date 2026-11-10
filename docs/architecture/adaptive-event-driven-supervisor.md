# Adaptive event-driven supervisor — source design

Use authenticated host events to prioritize chats that are ready or whose responses completed, while retaining round-robin fairness for other eligible chats. A host event never overrides current workspace state, the durable prompt outbox or the one-unresolved-prompt-per-chat invariant.

A verified progress signal with three consecutive no-progress cycles diverts the workspace to review rather than blindly issuing another continuation prompt. The progress evaluator must be independently trustworthy; self-reported model text is not proof of work. The caller retains responsibility for persistent progress counters and receipt-driven cursor advancement.

Defaults: up to 10 workspaces, 2 dispatch candidates per sweep, 2 maximum in-flight prompts. Callers may override these bounds within the existing validated 1–10 range; deployment-level policy must enforce any stricter approved limit. These are separate limits, not a promise of host concurrency. No real ChatGPT transport, event subscription or runtime tests are present. ChatGPT retains task context and project execution; LazyPrompting manages prompting only.
