# Supported Chat Session Host — admission boundary

LazyPrompting must not claim it can control existing ChatGPT consumer chats from generic model APIs. A host is eligible only after a documented, approved integration attests that it can create sessions, send prompts, observe completed responses, look up a handoff-created session, and verify session identity. The manifest rejects scraping and undocumented endpoints.

The ChatSessionHost module is an injected callback contract, not a working provider integration. Attestation and manifest must be issued by a trusted operator outside model text. Host callback outputs also require independent correlation checks by the Prompt Outbox and Handoff Reconciler; a callback returning `trusted:true` is not proof by itself.

The selected product mode is **ordinary, persistent ChatGPT Chat (non-temporary)**. A future eligible host must verify the actual chat mode and bind/recover an existing conversation after crash before any optional new ordinary-chat creation. Temporary Chat, including `?temporary-chat=true`, is not an accepted mode. These are **new design/admission requirements**, not capabilities implemented by the present callback contract.

No production transport is connected. Do not bypass platform restrictions, reuse consumer cookies, or substitute the Responses API as though it accessed existing ChatGPT conversation IDs. Old chats must be retained.
