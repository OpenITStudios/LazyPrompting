# Multi-workspace architecture — up to 10 independent ChatGPT tasks

## Decision
One global LazyPrompting control plane, many explicitly bound Task Workspaces. Each chat maps to a stable workspaceId/taskId pair established by a trusted host, never by guessing chat titles or browser tab positions. A workspace can survive ChatGPT tab closure, browser restart or agent completion. No workspace can read another's context, checkpoints, browser storage or credentials without a separately authorized explicit transfer.

## Pinned reference
M-Minecraft-Emulator Local at f24a1aad133ad80eb15d779545805769eca492f4:
- docs/product/unified-workspace.md blob b2e499d4de5e4d28e16e8b02e534f38542b58fc1: stable profile IDs, selection independent of session lifecycle, no stale status claim
- docs/system/independent-isolation.md blob fd79154f231fc7edc6c6c63da4edbc59cda3e0a3: profile storage/account isolation and source-only proof separation
- GITHUB_RULES.md blob c7cdafe878a868e8dde32204647b5f46a146226f: target-bound context recovery, exact HEAD, no inferred history
The emulator's Windows sandbox/driver model is NOT imported. Historical four-client pilot is explicitly superseded, not current design authority.

## Isolation model
- Global (read-only policy): capability schemas, protected prompt templates, security rules and versioned implementation.
- Workspace: immutable id, owning conversation binding, repository and branch scopes, allowed operations, grant issuer, context revision, checkpoint path, ledger path, budget.
- Task/run: task ID, agent execution receipt, SHA baseline, task-local evidence, continuation decision and STOP reason.
- Browser: the current native desktop deliberately uses one persistent normal WebView2 browser profile across ten workspace-owned views and up to three supporting tabs per workspace, sharing account cookies and browser storage. Tabs and logical workspace ownership do NOT isolate account credentials. Conversation references, repository scopes, task permissions and checkpoints remain distinct and may not cross workspace boundaries. Lightpanda/Playwright is a different runtime and must not be assumed to share WebView2 accounts or profiles. Separate account profiles are a future explicit feature, not the current default.
- Agent: separate session IDs, prompts, output and budget counters; no cross-session implicit resume.
- Filesystem: separate root per workspace, no user-controlled path traversal or shared writable storage. Hard links/symlinks and processes require host-level isolation checks.
- GitHub: source authority is repository+branch+HEAD, not global latest commit. For multiple workspaces on the same branch, one writer lease or separate working branches followed by explicit review. The current Local-only policy still restricts writes; no automatic branch creation or merge.
- MCP: stable four public tools; internal capabilities take authenticated workspace context bound by host session. An untrusted argument workspaceId must not select another workspace.

## Coordination
A single bounded scheduler queues ready workspaces by fair rotation. Suggested initial max active agent tasks: 2, browser contexts: 2; 10 workspaces may exist but do not imply 10 running browsers or models. Every workspace has independent token/time budgets and STOP/PAUSE guards. Scheduling a different workspace never changes the first one's checkpoint.

## Resume
Resolve trusted conversation→workspace binding, then load only that workspace's compact checkpoint and exact source observations. Require workspaceId, taskId, repository, branch, source SHA, context revision and grant scope to match. On missing, ambiguous, stale or foreign binding: BLOCK, never guess or borrow another chat's context.

## Sharing knowledge
Cross-workspace reuse must be an explicit approved export of sanitized, versioned artifacts. Global reusable engineering principles may be registered centrally, but workspace-specific observations/instructions must not leak through caches or embeddings. Retrieval index must be namespace-filtered before ranking.

## Proof and activation
Architecture only, not operational isolation. No ChatGPT browser automation, 10 active chat controllers, live MCP or concurrent agent runner is currently verified. Native multi-session and cross-scope negative tests are release gates.
