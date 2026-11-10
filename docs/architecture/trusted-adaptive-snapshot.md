# Trusted adaptive snapshot

TrustedAdaptiveSnapshot composes current authenticated workspace health, pending prompt outbox, trusted host events, durable verified progress counters and cursor into one pure adaptive decision. It does not send prompts or use GitHub for user work.

All host callback results must be authenticated by their provider; an event cannot override a pending outbox entry or paused workspace. The returned dispatch list is advisory. Receipt-driven cursor advancement remains with NonblockingDispatchCoordinator. Source tests authored, not executed. Production wiring between adaptive planner and dispatch coordinator, and a supported ChatGPT consumer-session transport, remain outstanding.
