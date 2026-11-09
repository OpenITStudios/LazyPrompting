# Trusted Tool Broker — Enforcement Contract

**Status:** architectural requirement, NOT_IMPLEMENTED. A preflight function is advisory, not a security boundary.

## Threat model
An untrusted model, web page, tool response or local process may forge `approval.reference`, stale GitHub SHA, fake test receipts, fake completion status, or a `next_action` that exceeds the user's goal. The broker must never accept authorization derived from these values.

## Trusted inputs
- Actual user permission supplied by the host's authenticated interaction record, scoped to repository, branch, paths, action class and time.
- Actual GitHub ref and blob/commit SHA read immediately before a mutation.
- Tool credentials retained outside model-visible context and restricted to least privilege.
- A versioned, reviewed policy for allowable effects.

## Enforcement sequence
1. Authenticate caller and resolve the user-approved task/goal.
2. Validate operation, path and resource against deny-by-default ownership.
3. Verify permission provenance **outside** the model-supplied request.
4. Check exact repository/branch, allowed action and current expected HEAD.
5. Bind a single operation to a one-use authorization ticket and idempotency key.
6. Execute through an allowlisted tool using least-privilege credentials.
7. Record actual result and post-write GitHub SHA, reconcile success/failure.
8. Never retry a mutation without checking whether the first attempt committed.

## Invariants
- `ASK` is never equivalent to `ALLOW`.
- No implicit write authority from a previous `CONTINUE`, model-generated status or GitHub commit history.
- Never accept a claimed test PASS without an execution receipt for the exact source revision.
- No force push, branch deletion, merge, release, secret exposure, cross-repo write or unattended ChatGPT-Web scraping.
- A user pause/stop revokes future dispatch; queued work is not grandfathered in.
- Transport retries must not duplicate a GitHub mutation.

## Failure injection before OPERATE
Forged approval, changed branch HEAD between preflight and write, replayed ticket, timeout after successful commit, wrong repository, stale evidence, prompt injection in a web page, conflicting task goal, rate-limit and repeated zero-progress iterations.

## Proof gate
Do not enable OPERATE until a real broker implementation and its negative controls are executed in an isolated test environment. No browser or Codex runtime proof exists at this stage.
