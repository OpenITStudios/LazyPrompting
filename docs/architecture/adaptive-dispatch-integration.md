# Adaptive decision to receipt-driven dispatch

NonblockingDispatchCoordinator optionally accepts adaptiveSnapshot.inspect. Under its mandatory exclusive scheduler lease it retrieves current workspace/outbox health, obtains adaptive candidates and rejects any candidate not eligible in a fresh safety planner. It then sends one prompt at a time through the trusted dispatch gate, waiting for acceptance receipt but never waiting for a completed response. The cursor advances after SENT or RECONCILE_REQUIRED outcomes.

This is a source-only integration. The adaptive snapshot's own reads may race with the coordinator's reads; production must use a consistent host snapshot and serialized state transitions. A separate host transport must prove authenticated session control and authoritative delivery lookup. Tests authored, not executed. ChatGPT owns task context and project work; LazyPrompting does not integrate with project GitHub.
