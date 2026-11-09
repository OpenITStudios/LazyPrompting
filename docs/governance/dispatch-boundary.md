# Trusted Dispatch Boundary

## Security correction
Previously the one-step orchestrator reserved a task and called the agent adapter without passing an independently verified authorization receipt. This permitted integration code to bypass the intended authorization broker.

Now `SupervisorOrchestrator` requires an `authorizeDispatch` trusted-host callback. It must return an authorization result bound to the exact goal, task, repository, branch and source HEAD. The orchestrator does not dispatch on a denial. It records the checkpoint reservation before external send. The `OfficialAgentAdapter` separately requires a trusted `verifyAuthorizationReceipt` callback before invoking `submit`.

## Unresolved boundaries
- `authorizeDispatch` is still a host callback: it must be bound to `AuthorizationBroker` and durable replay ledger in a real host composition root.
- Receipt validation must independently bind goal, task, operation, branch, SHA, expiration, revocation and one-use semantics. The adapter's callback is a contract, not cryptographic verification.
- A failed reservation after a consumed broker grant requires reconciliation and a new authorized identity; no automatic retry.
- The current decision engine trusts `evidence.verified` from its caller. The actual receipt reconciler must be wired to a trusted source and runner.
- No official Codex wire protocol, API token, live dispatch, or MCP installation has been implemented.

## QA status
Source tests are authored in `tests/run-orchestrator-security.mjs`. They have not been executed per code-first user instruction.
