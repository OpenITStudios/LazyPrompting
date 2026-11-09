# Multi-workspace threat review — source-first

## Implemented source controls
- Persistent registry: ten-workspace cap, unique workspace/session identities, compare-and-swap version, fail-closed malformed records, exclusive filesystem lock.
- Context admission: exact session/workspace/repository/branch/SHA/revision match and 64KiB cap.
- Browser pool: separate RemoteBrowser process and BrowserContext per workspace; max two active by default, no shared cookie jar.
- In-process repository write lease: blocks concurrent writes to the same repo/branch within one supervisor process.
- Independent scheduler selection policy and task binding checks.

## Critical blind spots still OPEN
1. **Trusted chat binding:** No official ChatGPT conversation/session ID API has been connected. The registry accepts host-supplied session IDs; the caller must be authenticated by the host, not a model-supplied string.
2. **Cross-repository permissions:** Existing broker and router are intentionally LazyPrompting/Local-only. Other OpenITStudios repos remain read-only; each target needs explicit scoped grants and rules.
3. **Multi-process write collision:** In-memory lease does not coordinate multiple supervisor processes or direct GitHub writers. Need persistent fencing token, HEAD CAS, and host-side GitHub write admission.
4. **Filesystem attacks:** Registry path/lock can be attacked by symlink/reparse and stale lock scenarios on an untrusted shared filesystem. Use private host-owned directory, restrictive ACL, isolated service identity and crash recovery proof.
5. **Browser SSRF:** DNS validation is subject to rebinding/TOCTOU. Browser contexts share host network; enforce container/process egress policy. No ChatGPT-Web scraping.
6. **Browser identity:** Pool API takes a workspace ID but does not authenticate caller; host routing must bind identity before calling it. Browser data can still be leaked through caller errors or logs without host controls.
7. **Context injection:** Context capsules contain untrusted repo/page/model text; content must never authorize tools. Sanitize exports and namespace retrieval before ranking.
8. **Credential boundaries:** Never share browser profiles, cookies, API tokens, account credentials or agent auth across workspaces. Vault and per-workspace secret scope are not implemented.
9. **Crash and replay:** Separate registry, checkpoint and replay ledger lack an atomic cross-file transaction. Unknown dispatch is not retried; require durable journal and operator reconciliation.
10. **Fairness and costs:** Scheduler has a source-only two-active recommendation, not an operating queue, per-workspace billing, process resource limits or timeout enforcement.
11. **Lifecycle and cleanup:** A browser crash, canceled workspace, or leaked process may leave resources. Need lease expiry with fencing and forced host cleanup after trusted verification.
12. **Source freshness:** A workspace's pinned HEAD becomes stale when another writer commits. Reconcile before every mutation; do not copy another workspace's nextAction.
13. **Registry schema migrations:** No migration mechanism; incompatible future schema must fail closed and require reviewed migration.
14. **Audit and privacy:** No durable per-workspace access log, encryption at rest, retention controls or deletion policy.
15. **QA proof:** Tests authored but not run, and no actual 10-chat, multi-browser, MCP, Codex, or concurrent GitHub run verified.

## Release gates
Ten-workspace cross-talk negative tests; parallel same-branch writes; restart and stale-lock recovery; workspace browser cookie/storage isolation; host authenticated session mapping; prompt-injection tests; network egress/SSRF tests; task crash/replay; per-workspace budget enforcement; actual official transport and MCP conformance.

**Status:** source architecture and components only. Never claim runtime isolation or production security until those gates pass.
