# Scoped GitHub and independent QA provider integration — 11 November 2026

**Repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Starting source SHA:** `d4b286cba268d42f87ed34141cc3f5a4697fdec7`.
**Milestone class:** source integration with synthetic external callbacks; **not** live Windows/native, actual production GitHub login, or ChatGPT worker acceptance.

## Gap closed in source

The original `createVerifiedGoalRuntime` requires nine independent
trusted host callbacks. Three of them concern the **same project**
but were not wired to their already available source implementations:
`sourceFactory`, `receiptFactory` and `readHead`.

An internal `createScopedGoalEvidenceProviders` now composes:

- `GitHubEvidence`, scoped to the exact host-approved
  `repository/branch`. It verifies immutable source HEAD and bounded,
  correctly ordered commit ancestry with another HEAD check after compare.
- `ReceiptReconciler`, scoped to the same project and source object.
  It consults a **separate host-provided** QA verifier and requires
  receipt identity and source SHA to match before claiming QA PASS.
- One immutable host callback bundle, used by the opt-in
  `createVerifiedGoalRuntimeWithGitHub`, which rejects a caller trying
  to replace these source providers or add arbitrary host callbacks.

The original `createVerifiedGoalRuntime` remains supported and
unchanged for existing callers. The opt-in path requires seven
separately authenticated callbacks from its native owner:
`readGoal`, `verifyTurn`, `readIdentity`, `readResult`,
`verifyResult`, `authorize`, and `verifyReceipt`.

These functions must **not** be controlled by an agent's text or
an untrusted MCP request. They require native scope approval and
original process/QA evidence, which this patch does not implement.

## Executed source tests

Linux x64, Node.js 22.16.0. Modules under test were matched by Git
blob SHA to the exact source and test content staged for this commit.

| Test | Result | External dependency |
| --- | --- | --- |
| `node tests/run-scoped-goal-evidence-providers.mjs` | **24 assertions PASS** | Fake GitHub HTTP and injected separate QA callback; real existing GitHubEvidence and ReceiptReconciler |
| `node tests/run-verified-goal-runtime-github-composition.mjs` | **17 assertions PASS** | Real new runtime factory/constructor logic; test-only storage-owner class stubs |
| `node --test` of both above | **2/2 subtests PASS** | No network, model, credentials, browser or Windows |

Tested rejection behavior: wrong repository/branch/workspace, competing
GitHub provider object, missing QA proof, goal-ID mismatch in otherwise
trusted receipt, source-only progress that **does not** imply acceptance,
missing native callbacks, fake sourceFactory/readHead injection, invalid
storage-path collision and wrong workspace identity.

**Not executed:** the full checkout `npm run test:repository`,
`npm run preflight:localtest`, Windows Cargo, installed native MCP,
real GitHub API login, independently trusted QA provider, authenticated
Codex turn association or consumer ChatGPT Chat. Earlier 32-assertion
real-storage tests exercised the unmodified original factory; they
were not rerun on the combined source revision here.

## Exact remaining integration boundary

The new composition is **host-only source**, not a gateway or MCP
endpoint. Native Rust still must provide and verify the seven host
functions without trusting model claims; in particular a persisted
`goal_run.turn_receipt` still truthfully states
`finalTurnHostAttested=false`, `qa=NOT_EXECUTED`,
`acceptancePassed=false` and `nextPromptAllowed=false`.
No response text or browser DOM is allowed to mint QA proof.

One authenticated end-to-end goal must still prove an original
operator-approved run, actual Codex terminal event, verified worker
result, independent QA receipt, exact GitHub HEAD/branch scope,
durable reconciliation and final DONE. The consumer ChatGPT Chat
transport remains a separate permission/availability blocker.

See [active checkpoint](../operations/current-state.md) and
[existing runtime QA](verified-goal-runtime-2026-11-11.md).
