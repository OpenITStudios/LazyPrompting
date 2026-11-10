# Handoff coordinator — retained chat history

HandoffCoordinator coordinates a source-only, fail-closed sequence: require PAUSED workspace, reject pending prompt, validate context capsule, reserve handoff ID, request a new session via trusted host callback, verify new session and context acceptance, CAS switch canonical WorkspaceRegistry binding, then activate HandoffLedger. The old chat ID remains in previousSessions; no deletion or real archival API is invoked.

A crash between session creation and registry switch is RECONCILE_REQUIRED and must never trigger automatic second session creation. A crash between registry switch and ledger activation also requires reconciliation; no automatic resume. The workspace stays PAUSED after successful handoff until independently resumed by the user or trusted host.

Source caveats: no official ChatGPT create-session/send/observe adapter connected; no cross-file atomic transaction; previousSessions is capped at 100; existing registry schema still limits actual target repository to LazyPrompting/Local, so cross-project chat workspaces are not yet operational. No native tests run.
