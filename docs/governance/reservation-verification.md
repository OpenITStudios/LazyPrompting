# Reservation Receipt Verification and Cross-Store Recovery

## Source change
- `src/governance/reservation-verifier.mjs` independently checks the broker-issued receipt against current trusted grant state, exact Local HEAD, and a matching persisted replay-ledger reservation.
- `src/governance/authorization-broker.mjs` now returns a scope-bound receipt with goal, task, repository, branch, expected HEAD and operation.
- `src/runtime/trusted-runtime.mjs` wires the independent verifier into `OfficialAgentAdapter` instead of accepting a host callback that could be trivially misconfigured.
- `src/supervisor/orchestrator.mjs` reports reconciliation required if the broker reservation succeeded but checkpoint reservation failed or became uncertain.

## Limits
This is not a cryptographic or globally one-time capability. Ledger status is currently RESERVED; the verifier does not consume it on each check. The agent host must enforce exactly-once dispatch identity and never auto-retry unknown delivery. Cross-store atomicity is still not solved: ledger and checkpoint are separate files. A crash between writes can consume a grant with no checkpoint reservation; manual reconciliation is required. Filesystem locks are single-host and stale locks are not automatically stolen.

## Evidence
Source test `tests/run-reservation-verifier.mjs` and updated trusted-runtime fixture were authored. Native tests remain unexecuted per user direction. No live official agent host, MCP integration or dispatch was exercised.
