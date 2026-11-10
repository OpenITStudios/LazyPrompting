# Verified progress response integration

createDurableResponseRuntime now accepts optional progressPath and injects a DurableProgressReview into the evaluation callback. When configured, the evaluator MUST return verified=true and a boolean progressMade. The response identity is persisted with its progress outcome before the durable evaluation queue entry is completed. Missing or unverified progress evidence keeps evaluation pending for replay.

A repeated evaluation for the same response ID does not increment the counter twice. A session switch fails closed until explicitly reconciled. Production must supply an independently trusted evaluator; model prose alone is insufficient. Source-only, not executed; no real ChatGPT session transport.
