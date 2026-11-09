# Permission Evaluation — Source Contract

The evaluator at `.agents/permissions/evaluate-permission.mjs` checks repository, lane, branch, path owner, forbidden action and explicit user-scoped write provenance. It is **not** an authorization oracle: callers must independently verify the actual user message, exact current GitHub HEAD, available tool capability, policy/compliance and scope before any mutation.

## Contract
- Known read paths: allow read in recognized lanes.
- Write: only DEVELOP on user-selected Local, exact path and claimed explicit user provenance; preflight returns ASK, never ALLOW, until the host independently verifies the real user authorization.
- Unknown or ambiguous owner: deny.
- Cross-repository write, merge, release, force-push, branch deletion and ChatGPT-Web scraping: deny.
- OPERATE is not enabled for reads or writes.
- Do not accept model-generated approval references as genuine user approval.

## QA
`.agents/evals/permission-cases.json` contains frozen negative and positive cases. Run `node .agents/evals/run-permission-cases.mjs` only in an available authorized execution environment; do not report PASS until actually executed against the exact source revision.

## Limits
This is preflight only, not an access-control boundary against a malicious process. A future tool broker must enforce policy at the actual operation boundary.

## Security correction
A model- or page-generated `approval.reference` can be forged. The preflight therefore returns `ask` for an otherwise eligible write, never an executable grant. A trusted operation broker must verify the actual user instruction and GitHub scope independently. Current evaluator is not such a broker.
