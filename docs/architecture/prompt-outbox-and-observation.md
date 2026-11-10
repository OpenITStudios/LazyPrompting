# Durable Prompt Outbox and Response Observation

The approved product boundary is prompt-only: LazyPrompting sends contextual prompts to ChatGPT and observes replies; ChatGPT owns GitHub work.

`PromptOutbox` stores one pending prompt per workspace with an immutable prompt hash and durable reservation. The dispatch gate records the reservation before external send and requires a host response handle. `ResponseObserver` checks authenticated session identity, exact host response handle and trusted completion before closing the outbox entry. A response's text is not proof of GitHub activity or authorization.

Unknown delivery stays reserved and is never resent automatically. No ChatGPT Web scraping, undocumented chat endpoint, or direct GitHub mutation is used.

Remaining: host-supported conversation send/observe API, secure session binding, durable transport receipts, prompt budgeting, per-workspace cleanup and live concurrency QA. Tests authored but not executed.
