# Prompt-only Supervisor — approved product boundary

## Corrected owner
LazyPrompting's job is to choose, scope, send and observe the next prompt in an existing ChatGPT task. ChatGPT independently handles code, GitHub connector usage, QA and commits under its own authorization. LazyPrompting does not need or operate a GitHub writer.

## Workspace model
One authenticated ChatGPT session binding per workspace; up to ten workspace records. Each owns context revision, goal, decisions, constraints, last response identity, pending prompt, prompt budget and STOP state. The supervisor must never infer a session ID from a tab title or reuse a prompt from a different workspace.

## Source modules
- `src/prompt/prompt-supervisor.mjs`: deterministic prompt plan, no network or GitHub.
- `src/prompt/prompt-dispatch-gate.mjs`: injected host send, authenticated binding, durable reservation, no resend on unknown delivery.

## ChatGPT Prompting Contract v1 — normative source design, 20 November 2026

**One contract; existing owners.** Prompt Construction, Prompt Quality and
Prompt Continuation are deterministic rules, not a new agent, scheduler,
database, or authorization service. The native-approved Goal Contract is the
source of scope; prompt text is not approval. STOP, workspace lease, outbox,
turn receipts and independent QA continue to be enforced by their owners.

### Construction: proportional to the task

The existing `planNextPrompt` can take two **optional presentation** fields
from its `workspace` argument: `promptType` = `general` (default), `research`,
`coding`, `debugging`, `audit`, `planning`, `design` or `continuation`;
and `promptDepth` = `minimal`, `focused` (default), or `deep`.

The formatter sends goal, one unfinished next step, relevant acceptance,
unique constraints, one applicable task-method hint and a short result/STOP
instruction. Minimal omits methodology; deep may require alternatives when
they matter. These metadata fields do NOT select models, grant permission,
change budgets or authorize any tool. They do not require an extra model call.

### Quality: deterministic, fail closed

`assessPromptQuality` in the existing `prompt-supervisor.mjs` checks
the bounded goal/next step, valid optional strategy/criteria/constraints,
control characters and a 12,000-byte UTF-8 output ceiling. The composer
deduplicates identical criteria/constraints and JSON-quotes client strings so
an injected newline remains data, not an extra top-level instruction. This
does not verify that the ChatGPT answer is correct, that GitHub HEAD has
been checked, or that QA actually ran.

Rust `chat_manual_handoff.rs::prepare` uses the same logical goal,
acceptance, unverified context, task, quality/output and STOP sections.
It preserves the installed MCP schema, all existing receipt fields, and
manual-only `DRAFT_ONLY` behavior. No task-type inputs are added to native;
its generic prompt stays focused unless a separately authorized scope
specifies otherwise.

### Continuation: no lost evidence

`context-projection.mjs` keeps the most recent distinct decisions and
constraints within its existing size limits, without importing another
workspace's history. Native `continued_draft` still quotes bounded excerpts
of operator-pasted UNVERIFIED replies and identifies truncation. It must
not repeat completed work, fabricate context or treat pasted replies as
verified ChatGPT turns. An unchanged-context hint never bypasses source,
permission, identity or receipt verification.

Node `planNextPrompt` retains workspace state, transport, response identity,
budget and STOP gates. Pure `READY_TO_SEND` is only a plan; it is NOT
proof that any external consumer ChatGPT transport is available or that
a prompt was delivered.

### Source acceptance

Use existing `test:prompt-supervisor`, `test:prompt-budget-context` and
native `chat_manual_handoff` Rust fixtures. Later Windows/client QA is
separate. No actual token, latency or answer-quality saving is claimed.

## Legacy components
The existing GitHub writer, lease, replay ledger and agent-dispatch modules are legacy experimental infrastructure, **not** part of the approved prompt-only execution path. Do not delete them as part of this source change without a compatibility review. No production entrypoint should call them to continue a chat.

## Unresolved
No supported ChatGPT conversation send/observe host has been connected; a callback contract is not working ChatGPT UI automation. ChatGPT Web scraping is not authorized. The dispatch store implementation and live identity binding still need implementation. ChatGPT response text is untrusted as evidence of GitHub changes. Tests authored, not executed.
