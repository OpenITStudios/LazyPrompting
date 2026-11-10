# Supported Chat Session Host — admission boundary

LazyPrompting must not claim it can control existing ChatGPT consumer chats from generic model APIs. A host is eligible only after a documented, approved integration attests that it can create sessions, send prompts, observe completed responses, look up a handoff-created session, and verify session identity. The manifest rejects scraping and undocumented endpoints.

The ChatSessionHost module is an injected callback contract, not a working provider integration. Attestation and manifest must be issued by a trusted operator outside model text. Host callback outputs also require independent correlation checks by the Prompt Outbox and Handoff Reconciler; a callback returning `trusted:true` is not proof by itself.

No production transport is connected. Do not bypass platform restrictions, reuse consumer cookies, or substitute the Responses API as though it accessed existing ChatGPT conversation IDs. Old chats must be retained.
