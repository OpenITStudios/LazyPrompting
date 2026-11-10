# Durable response runtime composition

createDurableResponseRuntime requires a durable evaluation queue path, a single-host exclusive lease path, trusted session verification, trusted response observation and an evaluator. It injects the same queue into ResponseObserver and ResponseLifecycle. An inspection holds a filesystem lease through observation, outbox reconciliation, evaluation and backlog replay. A failed lease acquisition blocks the inspection.

This is single-host source-only composition. The lease path must be shared across all workers that inspect the same outbox and queue. A separate dispatch scheduler lease may be used; outbox transitions remain individually guarded. Crash recovery still depends on a trusted evaluator capable of retrieving content by response ID. The source does not provide real ChatGPT consumer transport, distributed locking or verified runtime behavior.
