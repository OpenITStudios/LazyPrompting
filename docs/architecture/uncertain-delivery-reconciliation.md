# Uncertain delivery reconciliation

UncertainDeliveryReconciler uses authenticated host lookup by the original outbox prompt ID (idempotency key). A trusted ACCEPTED result with matching session, idempotency key and response handle can restore the outbox acknowledgement. It never sends or retries a prompt. NOT_FOUND does not prove the prompt was never delivered; it remains pending for human or provider-specific reconciliation.

This assumes a host supporting authoritative lookup by idempotency key. The current consumer ChatGPT transport does not provide a verified implementation. Single-host outbox persistence and evaluator reconciliation remain prerequisites. Native tests authored, not executed.
