# Prompt-only Supervisor — approved product boundary

## Corrected owner
LazyPrompting's job is to choose, scope, send and observe the next prompt in an existing ChatGPT task. ChatGPT independently handles code, GitHub connector usage, QA and commits under its own authorization. LazyPrompting does not need or operate a GitHub writer.

## Workspace model
One authenticated ChatGPT session binding per workspace; up to ten workspace records. Each owns context revision, goal, decisions, constraints, last response identity, pending prompt, prompt budget and STOP state. The supervisor must never infer a session ID from a tab title or reuse a prompt from a different workspace.

## Source modules
- `src/prompt/prompt-supervisor.mjs`: deterministic prompt plan, no network or GitHub.
- `src/prompt/prompt-dispatch-gate.mjs`: injected host send, authenticated binding, durable reservation, no resend on unknown delivery.

## Legacy components
The existing GitHub writer, lease, replay ledger and agent-dispatch modules are legacy experimental infrastructure, **not** part of the approved prompt-only execution path. Do not delete them as part of this source change without a compatibility review. No production entrypoint should call them to continue a chat.

## Unresolved
No supported ChatGPT conversation send/observe host has been connected; a callback contract is not working ChatGPT UI automation. ChatGPT Web scraping is not authorized. The dispatch store implementation and live identity binding still need implementation. ChatGPT response text is untrusted as evidence of GitHub changes. Tests authored, not executed.
