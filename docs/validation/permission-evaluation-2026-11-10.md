# Permission Preflight Evaluation — 2026-11-10

## Source identity
- Repository: `OpenITStudios/LazyPrompting`
- Branch: `Local`
- Exact tested commit: `d2ccfecc21b11816eaa2311315b9d853ec50da69`
- Source: `.agents/permissions/evaluate-permission.mjs`
- Config: `.agents/permissions/path-access.json`
- Cases: `.agents/evals/permission-cases.json`

## Execution method
Read all three files through the authenticated GitHub connector pinned to the exact commit. Evaluated the **fetched evaluator function body** in an isolated JavaScript runtime after replacing the Node `readFileSync` import/config loading with the exact fetched JSON content. No policy branches, matching logic, or decisions were changed. Ran all 13 repository-authored cases.

This is a **function-level execution proof**, not execution of `node .agents/evals/run-permission-cases.mjs` from an actual repository checkout, not an end-to-end authorization broker test, and not a browser/agent runtime test.

## Results
- Total: **13**
- Expected decision matched: **13**
- Failed: **0**

| Case | Expected | Observed |
|---|---|---|
| known read | allow | allow |
| unknown path | deny | deny |
| wrong branch | deny | deny |
| no approval | deny | deny |
| valid scoped write | ask | ask |
| other repo | deny | deny |
| path traversal | deny | deny |
| no operation permission | deny | deny |
| no UI scraping | deny | deny |
| no branch deletion | deny | deny |
| operate read denied | deny | deny |
| claimed approval cannot authorize mutation | ask | ask |
| subtree read | allow | allow |

## Limitations and residual risks
- No native Node runner proof on the exact GitHub checkout.
- `ask` is a required external authorization gate, not a granted permission.
- A malicious caller may bypass this preflight unless the actual tool broker enforces it.
- The path matcher, owner coverage and user-provenance validation need adversarial property-based cases and runtime integration tests.
- The permission test corpus does not yet demonstrate concurrency, stale-head, or race-condition safety.

## Decision
The 13 frozen **decision cases pass in the function-level harness**. Do not promote this to a claim that live repository mutations, Codex or browser automation are secure or operational.
