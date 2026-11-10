# Trusted handoff reconciliation

`HandoffReconciler` closes the restart gap without creating another chat. It reads the canonical registry and ledger, requires the workspace to remain PAUSED, classifies incomplete handoff, and obtains an exact handoff-bound session identity from a trusted host lookup. It verifies workspace ID, handoff ID, capsule hash, session ID and context acceptance before any state mutation.

If the old session remains bound, it CAS-switches the registry and activates the ledger. If the registry already switched, it verifies the new session and activates only the ledger. Uncertain outcomes remain RECONCILE_REQUIRED. The old chat is retained; no deletion or actual archival is performed.

A trusted host must implement lookupSession and verifySession against a documented supported ChatGPT integration. A plain model response is not trusted proof. Existing consumer ChatGPT conversations are not automatically controllable through a generic model API. Cross-file atomicity, stale-lock recovery, user-manual-interference detection and native tests remain unresolved.
