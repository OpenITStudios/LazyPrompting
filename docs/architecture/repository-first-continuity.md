# Repository-first continuity protocol — selected design, not deployed

> **Selected target for future implementation, NOT current runtime:** the operator chose repository-first context restoration under Codex supervision. This document describes that desired recovery contract; `HandoffCoordinator` still follows the earlier ChatGPT-owned routing in source. The [new control specification](codex-chat-workspace-plan.md) and [acceptance gates](../validation/codex-chat-workspace-gates.md) must be satisfied before activation. No automatic ChatGPT consumer new-chat transport is verified.

The target project's repository is the canonical owner of progress, decisions, rules and next steps. Before planned chat handoff, ChatGPT should commit authorized work and update the project's canonical status file. LazyPrompting does not write GitHub or infer that a commit occurred from response text.

At resume: bind workspace ID to exact repository and branch; require a source-verified commit SHA, status path and rules; generate a scoped resume prompt directing the new ChatGPT conversation to re-read repository rules, compare current HEAD and continue only unresolved work. If the branch moved or checkpoint is missing, block automatic continuation until ChatGPT reconciles actual source.

A sudden limit can prevent the last checkpoint commit. Fall back to the last *verified* repository state, never assert that the uncommitted chat work survived. Preserve old chats. A generic model API is not proof of control over existing ChatGPT consumer conversations.

`repository-continuity.mjs` is a pure planner and verifier, not a GitHub client or real ChatGPT session adapter. The host must provide independently authenticated source proof and session identity. Source tests authored, not run.
