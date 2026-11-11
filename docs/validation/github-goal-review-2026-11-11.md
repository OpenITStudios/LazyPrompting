# GitHub-to-Codex goal review via existing MCP — 2026-11-11

**Working branch:** `OpenITStudios/LazyPrompting` → `Local`.
**Pinned pre-change SHA:** `5fc2f291eefdd8060236aadb2a0d53f3612fa2a4`.
**Evidence classification:** `EXECUTED_TEST_PASS` for Node/fake-host source
contracts; **NOT** Windows WebView2, real GitHub credential integration,
consumer ChatGPT final-answer verification or unattended dispatch.

## What was implemented

`src/prompt/github-goal-review.mjs` reuses canonical modules instead of
creating another storage subsystem:

- `WorkspaceRegistry`: binds one of 10 canonical workspace IDs to
  session, task, branch, exact last known SHA, context revision, and status.
- `PromptOutbox`: requires exactly one matching outstanding,
  acknowledged prompt and response handle; unacknowledged/unknown send
  cannot advance.
- Host-injected `verifyTurn`: requires `TRUSTED_HOST`,
  `TURN_COMPLETED`, exact workspace/session/task/prompt/handle/revision
  and response ID. **UI completion alone is not this evidence**.
- `GitHubEvidence.changesSince`: compares bounded immutable SHA range,
  or returns empty progress without compare when HEAD is unchanged.
- `ReceiptReconciler`: requires independently trusted milestone
  receipt matching repository, branch, goal ID, prompt ID, HEAD SHA and
  QA classification. Without it, returns `REVIEW_REQUIRED` and a
  compact list of commit SHAs/subjects for Codex to inspect.
- `evaluateContinuation`: applies existing approval, budget,
  stagnation, QA, permitted action and DONE/VERIFY logic.

The resulting `REVIEWED` is a **proposal**, not permission to send.
`nextPromptAllowed=false` in all returned results; the existing
registry/outbox lease and native host must reconcile/persist the
verified checkpoint before any subsequent prompt.

`chat_goal.progress_review` was added to the **internal Node** deferred
capability catalog behind the same four public MCP tool names, but
`mcp-gateway.mjs` does not instantiate its provider. It is
discoverable only if a trusted host injects `goalReview`. Installed
Rust desktop MCP remains a separate unmodified entrypoint.

## Executed evidence

Environment: Linux x64, Node.js v22.16.0, no network/Windows/Rust,
no ChatGPT account, no new model/API usage.

| Exact runner | Assertions | Scope |
| --- | ---: | --- |
| `node tests/run-github-goal-review.mjs` | **86 PASS** | Real GoalReview, GitHubEvidence, ReceiptReconciler and DecisionEngine source; fake HTTP, trusted-host fixture and outbox/registry interfaces |
| `node tests/run-github-goal-mcp.mjs` | **21 PASS** | Exact staged CapabilityRouter, CapabilityRegistry and input validator; synthetic review provider and no browser launched |
| **Total** | **107 PASS** | Node-only |

The five changed implementation/test source blobs were byte-compared to
the locally executed files at staging SHA. A RemoteBrowser test stub
stood in for an **unused import**; no real browser was started.
Native/Windows, installed MCP, actual GitHub API calls from the app
and live ChatGPT have not been tested.

## Negative scenarios exercised

Wrong workspace/session/prompt/response-handle/context revision; pending
outbox not ACKed; PAUSED workspace; host-verifier absence; UI-only
completion; branch changed during GitHub read; wrong project scope;
untrusted/contradictory milestone receipt; false QA PASS; absent
GitHub commit; STOP, stagnation and unauthorized next action. A
read-only review cannot authorize sending or write another repository.

## Remaining functional gap — explicitly not implemented

- Officially supported, authenticated ChatGPT Classic final-turn
  transport and reliable status; extension UI inference is not authority.
- Durable native-host CAS+outbox release, scheduler admission and
  checkpoint after review, with exact replay and restart handling.
- Real GitHub read permissions and project-bound token injection
  in the installed Windows host.
- Validated WebView2, Rust and extension implementation on exact SHA,
  and user-approved Temporary Chat rollover.

Next: one native-owned, durable approval/reconciliation path
before exposing any `workspace_chat.submit` on real ChatGPT.
This change does not enable consumer ChatGPT automated scraping or
unattended Web UI prompting.

See [plan](../architecture/codex-chat-workspace-plan.md) and
[active state](../operations/current-state.md).
