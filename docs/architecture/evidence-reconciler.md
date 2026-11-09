# Evidence Reconciler — Contract v0

**Status:** design only; NOT_IMPLEMENTED.

## Trust model
The supervisor's decision engine accepts `evidence.verified` as a trusted input. The model's response cannot set this flag authoritatively. A separate reconciler must obtain evidence through trusted connectors and compare it against the immutable goal and current GitHub branch.

## Inputs
- User-authorized goal: repository, selected branch, approved scope and acceptance.
- Completed worker result: task ID, result ID, claimed source SHA, changed paths and QA claims.
- Trusted GitHub snapshot: exact ref SHA, changed files, commit parents, commit metadata.
- Optional trusted execution receipt: runner, exact SHA, test identity, result, timestamp.

## Reconciliation rules
1. Verify goal repo/branch exactly; no fallback to `main`.
2. Fetch current branch HEAD using trusted connector; compare with worker claimed HEAD and checkpoint.
3. If a result references a commit, verify it exists on the intended branch and belongs to the authorized task; a mere commit SHA does not prove the worker's claim.
4. Distinguish `SOURCE_COMMITTED`, `TEST_AUTHORED_NOT_RUN`, `EXECUTED_TEST_PASS/FAIL` and `LIVE_INTEGRATION_VERIFIED`.
5. Treat missing or mismatched test receipts as `NOT_EXECUTED` / `UNKNOWN`; never fabricate PASS.
6. Verify `DONE` only when every acceptance criterion has exact matching proof.
7. Do not trust `nextAction` or `approval` from the worker as authorization; pass proposed action to policy/broker.
8. Bind result ID, source SHA, verified proof and checkpoint cursor atomically before next dispatch.

## Required failure controls
Wrong repository, branch drift, stale HEAD, forged commit SHA, stale CI result, partial response, duplicate task result, malicious prompt injection, missing test receipt, contradictory proof, revoked approval.

## Output
Return a bounded immutable evidence snapshot with `verified` true only when source identity and relevant proof provenance were actually checked; individual proof types remain explicit. The decision engine must never be allowed to manufacture this snapshot.

## Acceptance
A standalone reconciler with trusted fake connector and negative fixtures must pass before integration. No browser/transport claims are authorized by this document.
