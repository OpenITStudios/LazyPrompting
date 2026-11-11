# Scoped GitHub progress and receipt reconciliation — 2026-11-11

**Target:** `OpenITStudios/LazyPrompting` branch `Local`; parent baseline
`46c9042daec9d8d609608dc6b9de3289fbed8a51`.
**Classification:** `EXECUTED_TEST_PASS` for Node fake-HTTP only.
The Node test used fake HTTP; no real GitHub calls were made by the tested module and no ChatGPT conversations were accessed. A separate **read-only GitHub connector schema check** of real commits `98b37e5...46c9042` confirmed `status=ahead`, `total_commits=1`, the final `commits[].sha` matching HEAD, and the absence of an undocumented `head_commit` property. The comparison parser was corrected before commit; this does not constitute a live module integration test.

## First wrong owner identified

The existing `GitHubEvidence.head` only admitted branch `Local`.
The existing `ReceiptReconciler` was hardcoded to target
`OpenITStudios/LazyPrompting` / `Local`. With the user's intended
10 separate project goals, a future Codex workspace targeting
`OpenITStudios/A-MIVUBI-Blockbench` on `chatgpt-dev`
would fail before reading relevant project progress.

## Implemented source correction

- `src/integrations/github-evidence.mjs`: constructor accepts optional
  trusted host-provided `scope: {repository,branch}`. The older unscoped
  read-only `Local` behavior remains for compatibility, but the new
  `changesSince` method **requires** explicit scope.
- `changesSince` uses official read-only GitHub branch/compare endpoints,
  pins BASE/HEAD SHA, requires a direct ancestor merge base, complete
  bounded commit list (at most 100, default 32), and re-reads branch HEAD
  after compare to catch concurrent pushes. It refuses diverged, behind,
  force-pushed, truncated or inconsistent history. Its result lists
  SHA+short subject and explicitly `qa: NOT_EXECUTED`,
  `acceptancePassed:false`; it does not attribute commits to ChatGPT.
- `src/integrations/receipt-reconciler.mjs`: scoped mode requires receipt
  verifier agreement on repository/branch, goal ID, prompt ID, head SHA
  and trusted QA status. Source-only evidence cannot mark acceptance.
  A `NOT_EXECUTED` result cannot become `acceptancePassed:true`.
- Default legacy receipt behavior remains supported for previously
  hardcoded Local project workflows. Actual authorization still requires
  a trusted native/host binding and a verified source provider.

## Executed validation

- **Command:** `node tests/run-github-progress-scope.mjs`
- **Environment:** Linux x64 / Node.js v22.16.0
- **Result:** **52/52 assertions PASS** using injected fake HTTP responses.
- **Byte identity:** `git hash-object` of the two source modules and
  test runner matches exact GitHub staged blobs.
- **Cases:** independent project scope, branch and ID validation; same-HEAD
  zero-comparison path; two-commit source range; HEAD recheck; concurrent
  movement; divergent/behind history; wrong merge base; incomplete lists;
  duplicate commit IDs; invalid API result; missing prompt ID; stale receipt;
  wrong goal/project/branch; false QA completion; legacy compatibility.
- **No tests on real GitHub API, live MCP, Windows or WebView2.**
- Node syntax checks passed. No network access or model inference used.

## Unresolved

Native host must supply the actual authorized project scope, token and
persistent HEAD cursor. The current program does not call
`changesSince` from a running workspace, and does not automatically
submit ChatGPT prompts based on these results. A GitHub change is
insufficient to conclude a ChatGPT turn ended; a committed source
change still needs independent task/acceptance evidence.

**Next:** connect the scoped project reader to the trusted existing
workspace/supervisor contract, then prove native and licensed live host
end-to-end under the earlier acceptance gates.

See [architecture](../architecture/codex-chat-workspace-plan.md) and
[active checkpoint](../operations/current-state.md).
