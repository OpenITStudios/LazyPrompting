# Chat-only session recovery

**Operator-selected mode (12 November 2026):** ordinary, persistent ChatGPT Chat only. A crash/restart must first restore and verify the **original** workspace conversation and reconcile uncertain sends; it must not trigger a new Temporary Chat or unnecessary rollover. Current source-only handoff callbacks do not implement or prove live ChatGPT same-session recovery; if the host lacks reliable identity proof, enter `PAUSED_NEEDS_USER`.

The active HandoffCoordinator now prepares a ChatGPT-owned continuation bootstrap prompt before reserving a new session. It passes that prompt to the trusted createSession callback, alongside minimal chat context. No GitHub read, checkpoint or repository verification is required in the handoff path.

Session health is classified only from authenticated host signals. CONTEXT_EXHAUSTED may initiate handoff after PAUSED/pending-prompt checks. RATE_LIMITED or QUOTA_EXHAUSTED means wait, not create another chat to evade limits. GENERATING and TOOL_RUNNING mean observe only; uncertain delivery means reconcile, not retry. Missing host evidence means pause.

A host callback is not itself a live ChatGPT integration. Old chats are retained; ChatGPT must verify any unavailable prior context rather than assume perfect cross-chat memory. Native tests remain deferred.
