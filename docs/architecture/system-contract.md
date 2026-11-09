# System Contract — Architecture First

## Outcome
An autonomous **continuation supervisor**, not a replacement coding agent or a blind auto-send bot. It consumes trusted structured status and verified development evidence, decides whether further authorized work is needed, and supplies a minimal context-specific instruction.

## Components (logical boundaries; not implemented)
1. **Goal Contract** — user scope, permissions, success criteria, budget, stop policy.
2. **Observation Adapter** — obtains the last completed agent task result via approved interface; records provenance and freshness.
3. **Evidence Reconciler** — validates claims against GitHub SHA, status and actual test receipts; does not trust model self-report alone.
4. **Context Compiler** — composes bounded objective + locked decisions + unresolved evidence + incremental change, not full transcript.
5. **Rule Engine** — deterministic first pass: CONTINUE, FIX_FAILURE, VERIFY, BLOCKED, DONE, NO_PROGRESS, WAIT.
6. **Small-Model Fallback** — only for ambiguous state; returns a constrained proposal, never permission.
7. **Prompt Composer** — targeted instruction naming exact owner, observed result and required proof.
8. **Transport** — official Codex/OpenAI interface first; optional browser backend gated separately.
9. **Evaluator** — checks scope preservation, measurable progress, failure and repetition; manages stop conditions.
10. **Audit/Checkpoint** — records concise decisions and exact evidentiary references; no duplicate live state authority.

## Data flow
Goal → approved task → official agent result → reconcile evidence → choose next policy → compose prompt → authorization gate → dispatch → repeat.

## Important boundaries
- ChatGPT remains the operator conversation surface. A detached external agent can use official supported interfaces but does **not** magically type into or retain the exact same browser conversation.
- GitHub remains canonical for code; the supervisor stores only a minimal cursor and observations, not a competing replica of repository truth.
- Lightpanda is a candidate **web navigation adapter**, not the reasoning engine, source-of-truth or required dependency.
- Do not use browser UI scraping to collect ChatGPT Web responses or bypass the platform's supported access mechanisms.
- Support one bounded task at a time initially. No autonomous branch selection, multi-agent mutation or auto-merging.

## Runtime stack decision
Architecture is runtime-neutral. Preferred initial implementation: small TypeScript/Node controller + validated JSON schema + SQLite checkpoint + official Codex/API transport. The language choice is provisional until architecture signoff and dependency/provenance review.

## Failure modes
Stale output, duplicate send, partial streaming, contradictory status, invalid schema, unauthorized next action, stalled quality, wrong branch, rate limit, context overflow, unstable browser DOM, model hallucination, unverified commit or test claims.

## Recovery principles
Idempotent task IDs; exact-result checks; exponential backoff for retriable transport faults; no retry on permissions; evidence-before-success; STOP on repeated stagnation. Never fabricate a missing result.
