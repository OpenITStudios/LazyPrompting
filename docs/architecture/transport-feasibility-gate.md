# Existing ChatGPT conversation transport — feasibility gate

Product requirement: operate up to ten EXISTING ChatGPT consumer conversations independently. This is not equivalent to creating separate OpenAI API conversations.

The source admission gate now requires documented, approved unattended operation, existing consumer chat support, attested binding to those existing sessions, and six callbacks: createSession, sendPrompt, observeResponse, lookupSession, verifySession and lookupDelivery. lookupDelivery must be authoritative for the original idempotency key, not a text search. Missing any capability blocks OPERATE.

Current evidence: no verified provider or approved integration satisfies these conditions. The ChatSessionHost is an injected interface, not a working transport. Do not substitute ChatGPT Web scraping, undocumented endpoints, browser session cookies or API conversations while claiming existing-chat support. If no provider is found, stop at source architecture and seek explicit user decision on a changed product boundary.

Next: obtain official documentation and real attestation from an eligible provider, then perform an authorized limited live pilot with one existing conversation before scaling to ten. No native or live test has been run.
