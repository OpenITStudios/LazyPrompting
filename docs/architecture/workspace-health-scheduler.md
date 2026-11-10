# Multi-workspace health scheduling

The pure Workspace Health Scheduler accepts up to ten isolated workspace/session identities and host-provided session signals. It classifies each through Session Health, respects PAUSED/BLOCKED/STOPPED, rejects duplicate or cross-workspace signals, prevents handoff/continuation when a prompt is pending, and caps PLAN_NEXT actions to a configured active-slot limit (default two).

CONTEXT_EXHAUSTED is a handoff candidate, not permission to create a chat. RATE_LIMITED waits; uncertain delivery reconciles; generating observes; missing/untrusted evidence pauses. A real scheduler must use authenticated host events, fairness rotation and durable outbox state; this module is not a host transport or automatic sender.

ChatGPT owns task context and any repository work. LazyPrompting does not read user repositories. Source tests authored but not executed.
