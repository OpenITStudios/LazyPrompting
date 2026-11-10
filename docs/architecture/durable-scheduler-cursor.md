# Durable scheduler cursor

DurableSchedulerCursor stores the scheduler's monotonic dispatch position with fsync and atomic rename. A compare-and-swap expected cursor check prevents stale sequential updates when invoked under the mandatory exclusive scheduler lease. It is single-host only; it is not a distributed CAS and does not atomically commit prompt outbox receipts.

The cursor increments only for SENT or RECONCILE_REQUIRED outcomes in NonblockingDispatchCoordinator. Unknown delivery requires reconciliation before re-sending. The ChatGPT host adapter remains separate and must provide authenticated send/observe callbacks. No real consumer ChatGPT transport or native QA is claimed.
