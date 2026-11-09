# Multi-workspace hardening — iteration 2

## Closed at source-contract level
- TrustedWorkspaceAccess requires host-authenticated session identity and exact workspace/task binding before a scoped browser snapshot. It never trusts a model-supplied session ID.
- Browser pool reserves capacity before asynchronous validation; simultaneous opens cannot both pass a one-slot limit.
- WorkspaceRegistry rejects duplicate task IDs across workspaces as well as duplicate workspace/session IDs.
- WorkspaceBudget provides deterministic per-workspace token/tick and global active-agent admission.

## Important remaining limits
- The host authentication callback is still an interface, not a connected ChatGPT conversation identity provider.
- Browser pool is not yet fully lifecycle-safe under simultaneous close/open or process crashes. Browser host egress and secret isolation remain necessary.
- The in-memory GitHub lease does not fence multiple processes or direct GitHub writers; GitHub HEAD CAS and durable writer admission are required.
- Registry and checkpoint/ledger are not one atomic transaction; crash journal/reconciliation remains open.
- Budget admission is not real token accounting; usage must be verified from the official agent provider.
- Source tests are authored but have not been executed. No 10-chat isolation or live host claim is made.

## Next priority
Implement durable repository+branch fencing with exact HEAD preconditions and a host-controlled GitHub write boundary. Then connect authenticated chat identity and per-workspace storage to the official host, with negative cross-workspace integration tests.
