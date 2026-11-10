# Durable response bridge

ResponseObserver optionally receives DurableEvaluationQueue and enqueues authenticated response identity before marking the prompt outbox RESPONSE_VERIFIED. If enqueue fails, the outbox stays pending. ResponseLifecycle can complete the queue after evaluation and replay pending identities on restart.

For durability, production composition MUST pass the same queue to both observer and lifecycle. The legacy no-queue mode remains for compatibility but does not guarantee recovery. Replay uses response identity only and text=null; the injected evaluator must retrieve trusted response content if needed. No atomic cross-store transaction is claimed; an outbox close failure after queue enqueue is recoverable via idempotent enqueue and host observation. Concurrent evaluator workers must be serialized externally. No native tests or live ChatGPT transport.
