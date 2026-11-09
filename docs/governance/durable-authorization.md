# Durable Authorization and Evidence Integration

## Source modules
- `src/governance/replay-ledger.mjs`: single-host, append-only bounded JSON reservation ledger. Exclusive lock directory, unique temporary write, sync and rename. Task IDs are globally unique within the ledger; duplicate task IDs and grant/task pairs fail closed.
- `src/governance/authorization-broker.mjs`: validates trusted host grant, exact Local branch and SHA, then reserves task in durable ledger before returning authorization.
- `src/integrations/receipt-reconciler.mjs`: validates source HEAD through an independent provider; accepts QA evidence only through a trusted receipt verifier callback. Unverified receipt is downgraded to NOT_EXECUTED.

## Boundaries
- The broker cannot issue grants. The host must authenticate and persist grants and revocation; the verifier must not rely on model-generated fields.
- The replay ledger is single-host only. It is not a distributed transaction, cryptographically tamper-evident log or guaranteed durable on every filesystem.
- If a reservation is written and a subsequent operation fails, it remains consumed; the operator must reconcile the task before retrying under a new explicitly approved identity.
- The ledger may leave stale lock directories after crashes. No automatic stealing or replay.
- The reconciler's `verifyReceipt` callback must validate the actual runner identity, SHA, timestamp and test receipt against a trusted system. Merely returning `trusted:true` from untrusted code would be unsafe.
- This iteration does not create an official Codex API integration, install MCP in ChatGPT, or start browser automation.

## QA state
`tests/run-replay-ledger.mjs` and the updated broker tests are authored. Per user direction, no local/native tests have been run. These changes are SOURCE_COMMITTED, not EXECUTED_TEST_PASS.
