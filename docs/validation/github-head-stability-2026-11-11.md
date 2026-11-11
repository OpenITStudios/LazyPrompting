# GitHub no-change HEAD race — source hardening, 11 November 2026

**Branch:** `Local`. **Baseline audited:** `1ce8afe793cd692fc3af9be73c47fbe46148f4d9`.
**Scope:** read-only GitHub progress source. No repository writes, new MCP
tool, model API, CI dispatch or native-host authorization.

## Observed failure before patch

In `src/integrations/github-evidence.mjs`, the changed-HEAD comparison
path already rechecked the branch SHA after reading the comparison.
However, when the first HEAD equaled `baseSha`, the implementation
immediately returned `SOURCE_HEAD_UNCHANGED` from **one** HEAD read.

A real, executable synthetic HTTP fixture produced HEAD `A` on
its first request and `B` on its second. Before the patch, the call
returned `changed=false` after one request, despite the simulated
branch update. That can lead a supervisor to treat a no-progress
observation as current when it is already stale.

## Fix

The unchanged branch path now makes a second authenticated read of the
**same approved repository/branch** before returning a no-change
result. If the two HEAD values differ, it throws the existing
`GITHUB_BRANCH_MOVED_DURING_COMPARE` error, leaving the caller
in its fail-closed reconciliation path. Existing changed-commit
comparisons and independent QA receipt checks are unmodified.

This is a consistency check, **not** a transactional GitHub snapshot:
an ABA change between both reads is not fully provable by polling.
The final authoritative host still must recheck HEAD at its own
review-commit boundary; this module does not grant next-turn permission.

## Executed verification

- **Before patch:** local synthetic fixture observed exactly one HEAD
  read and an incorrect `SOURCE_HEAD_UNCHANGED` result after an
  intentionally moving branch.
- **After patch:** Linux Node 22.16.0, with the exact staged Git blob
  for `GitHubEvidence`, ran
  `node tests/run-github-head-race.mjs` — **8/8 assertions PASS**.
  Stable A→A reports unchanged with no QA claim; A→B and A→C
  reject after two HEAD reads.
- **Related regressions:** `node tests/run-scoped-goal-evidence-providers.mjs`
  **24 assertions PASS** (real GitHub source and receipt owners,
  synthetic HTTP/QA); `node tests/run-verified-goal-runtime-github-composition.mjs`
  **17 assertions PASS** (new source factory, fake native/storage owners).
- **Not executed:** full `test:github-progress-scope`, whole-repository
  `npm run preflight:localtest`, Windows Cargo/Tauri,
  native MCP, real GitHub network access, or actual Codex/ChatGPT worker.
  The new focused test is registered in the manual preflight and
  is not a production acceptance claim.

## Next gate

On the exact pinned `Local` revision, execute the full Windows
preflight including existing GitHub progress scope tests, then
reconcile a real approved project HEAD/QA receipt in a disposable
native Codex run. Gate 0 unattended consumer ChatGPT Chat transport
remains separately blocked and is not enabled by this patch.

See [active engineering state](../operations/current-state.md).
