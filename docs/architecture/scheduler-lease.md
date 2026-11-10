# Exclusive non-blocking scheduler lease

NonblockingDispatchCoordinator requires a withSchedulerLease callback. This serializes the full sweep, including snapshot, dispatch receipt and cursor update. The source includes a single-host filesystem directory lease; acquiring an existing lock fails closed. Do not auto-remove stale locks, since a crashed process may have an uncertain delivery that requires outbox reconciliation.

The lease is not a distributed lock and cannot establish correctness across multiple machines or guarantee cross-store atomicity. A production host must provide durable cursor CAS, authenticated send and observe callbacks, and outbox reconciliation. No live ChatGPT consumer-session transport is implemented. Tests authored, not executed.
