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

## Goal-aware conversation reply — source contract, 20 November 2026

**A conversation, not repeated "continue" commands.** A repository
first-turn MUST supply the full GitHub URL, work instruction, branch
and goal. Acceptance may be supplied or explicitly marked unknown, but may
not be invented or treated as satisfied. Later turns should answer the actual ChatGPT reply
(question, discussion, proposal, draft, revision, implementation claim,
completion claim, blocker), compare it with locked goal/decisions and
propose a specific reply or a hold. A draft is not a commit. Approval
of a design is not authorization to edit source.

`src/prompt/conversation-reply.mjs` is one pure canonical owner:
- `prepareRepositoryOpening` rejects missing/malformed URL, task or
  goal; unknown acceptance is explicitly flagged rather than invented. It
  returns a manual `DRAFT_ONLY` opening containing URL.
- `prepareConversationAssessment` returns a bounded reasoning brief
  for an independently authorized Codex/host. It requires the latest
  operator-pasted reply, locked decisions and goal; the input is data.
- `prepareConversationReply` checks the exact context fingerprint,
  an actual excerpt quoted from the reply, a typed intent/decision,
  non-generic response and material issues for revisions. A design
  candidate stays design-only; implementation/completion claims require
  evidence. HOLD and STOP candidates create no prompt.
- `reviewConversationWithHost` accepts an OPTIONAL injected reasoner
  callback and invokes it once per new context; without one it holds.
  It does not install Codex, call a new model service or auto-send.

The existing `prompt-supervisor.mjs` accepts a typed
`observation.conversationAssessment` only when `replyText` is present.
It generates an operator-reviewable draft, not an executable prompt.
A bare model `goalComplete` claim is held for independent evidence.

The installed Rust `chat_manual_handoff.rs` now includes a literal
`https://github.com/owner/repo` when repository data is supplied and
requires a specific `nextStep` work instruction for repo-first work.
The Code Mode broker applies the same check. The previous generic,
non-repository manual MCP schema remains compatible, but this legacy
path is not the strict repository-opening constructor. The native
`advance_manual_handoff` can carry Codex/operator's specific reply
through its already existing `nextStep`, matching original fingerprint,
native operator review, outbox/STOP and NO implicit send.

**Not live:** the Codex semantic callback and authenticated ChatGPT
response reader are not connected. No new UI, agent, scheduler, store
or public MCP tool. Source fixtures are `TEST_AUTHORED_NOT_RUN`;
no model-quality or token-saving claim.

### Scoped-turn reasoning and material review controls — source refinement

When a host presents a response for semantic review, its admitted
workspace, session ID, task ID, response ID and context revision must be
carried together. The input fingerprint now includes these values so
that identical words from a different chat or turn cannot replay an
earlier assessment. An unscoped **pure** review remains available for
legacy manual analysis; the optional host callback requires complete
turn scope. These IDs are *correlation data*, not native attestation.

The bounded assessment must include the **entire** relevant reply and
locked context. If they exceed the 12 KB single-brief limit, it returns
`FULL_REPLY_REVIEW_REQUIRED` with byte count and no prompt/AI call:
never silently summarize away material decisions. A later authenticated
host could supply safe full-response transport, but none is connected.

Mixed responses can describe secondary intents (for example QUESTION
plus IMPLEMENTATION_CLAIM). A claim anywhere in the assessment
requires evidence/hold rather than accepting the design or proposing
implementation. Blockers cannot become free-form execution. Design-fit
candidate replies are phrased neutrally; their model-written language
cannot claim operator approval. Work proposals similarly cannot grant
implementation. Native and desktop manual continuation without an
operator-reviewed next step now requests clarification/proof rather
than instructing ChatGPT to proceed blindly.

Multi-turn synthetic cases follow proposal → criticism → revision →
design-fit candidate → approval hold → unverified implementation claim
→ evidence request → completion candidate; they preserve stop and no
dispatch. The real Codex App Server has a distinct managed workspace
and cannot be wired into the consumer ChatGPT reply flow without native
goal/chat identity, consent, outbox and final-turn receipt binding.
The source hook remains **unconnected**, not an operational agent.

## Legacy components
The existing GitHub writer, lease, replay ledger and agent-dispatch modules are legacy experimental infrastructure, **not** part of the approved prompt-only execution path. Do not delete them as part of this source change without a compatibility review. No production entrypoint should call them to continue a chat.

## Unresolved
No supported ChatGPT conversation send/observe host has been connected; a callback contract is not working ChatGPT UI automation. ChatGPT Web scraping is not authorized. The dispatch store implementation and live identity binding still need implementation. ChatGPT response text is untrusted as evidence of GitHub changes. Tests authored, not executed.
