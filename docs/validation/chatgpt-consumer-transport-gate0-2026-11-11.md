# Gate 0 decision — consumer ChatGPT Chat as an unattended worker

**Date:** 11 November 2026

> **Operator requirement update — 12 November 2026:** This dated feasibility finding preserves its original scope for audit. The selected future worker is now **ordinary, persistent ChatGPT Chat (non-temporary) only**. Temporary Chat and automatic `?temporary-chat=true` launch/handoff are cancelled. The underlying `BLOCKED_COMPLIANCE / HOST_UNSUPPORTED` verdict for unattended consumer-web orchestration remains unchanged.
**Project:** OpenITStudios/LazyPrompting, development branch `Local`.
**Verdict for the requested ordinary/Personalized Temporary Chat worker:**
`BLOCKED_COMPLIANCE / HOST_UNSUPPORTED` for *unattended external orchestration*.
This is a transport feasibility finding, **not** a change of the
operator's product requirement or an installation/runtime test.

## Verified primary sources

1. [OpenAI Terms of Use, effective 1 January 2026](https://openai.com/id-ID/policies/terms-of-use/):
   the consumer service terms prohibit automatically or programmatically
   extracting data or Output. A DOM scraper, hidden webpage transcript
   reader, private backend endpoint or cookie/session impersonation
   is therefore **not an approved substitute** for a supported
   structured response channel.
2. [OpenAI Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview.md):
   programmatic application-created sessions, input, events,
   continuation, durable state and MCP tools are explicitly supported.
   This is the **OpenAI-managed Codex harness API**. Usage incurs
   API billing. It is **not** the existing ChatGPT consumer Chat.
3. [Codex as a platform](https://developers.openai.com/blog/codex-as-a-platform):
   the official Codex SDK and local Codex App Server are documented
   programmatic surfaces for starting, observing and resuming work.
   This is consistent with the existing `goal_run.*` engineering path.
4. [ChatGPT Work cloud browser](https://help.openai.com/en/articles/20001280-using-cloud-browser-in-chatgpt):
   supported user-initiated ChatGPT Work tasks do not document an
   external Codex-to-ChatGPT-Chat command/result API. Work is a
   different user mode, not interchangeable with ordinary Chat.

No published consumer ChatGPT Chat API for arbitrary unattended
external session creation, prompt submission and authenticated
final-result retrieval was established from those sources. A
browser's apparent ability to click Send **does not** establish
permission or a reliable final-turn host receipt.

## Binding implementation decision (until reviewed by the operator)

- **Keep** the original goal: one Codex-approved goal, ten
  WebView2 workspace views, ordinary ChatGPT Chat as the desired
  interactive conversational worker. Do **not** silently rewrite
  `chat_goal.*` to mean an Agents API session or a Codex turn.
- **Disable** unattended consumer ChatGPT website send/answer
  extraction. Keep the current owned localhost fixture strictly
  for sender/observer protocol QA, never as product proof.
- **Continue** source engineering on the permitted official
  Codex App Server path, independently verified GitHub/QA receipts,
  native permission binding, checkpoint/recovery and Windows build.
  That work remains useful regardless of the selected worker.
- **Fallback choices requiring an explicit product decision:**
  (A) preserve actual ChatGPT Chat for *manual* user handoff, with no
  false automatic completion claims, or
  (B) use an explicitly supported programmatic surface such as
  the Codex SDK/App Server, Agents API or Responses API as an
  automated worker. That changes the worker product semantics and
  possibly account/API billing. Do not activate it without approval.

## Gate impact

`G0` remains **blocked** for the requested unattended consumer Chat
product. Therefore `G4` live ChatGPT Chat acceptance, `G5` automatic
Temporary Chat rollover, and `G6` unattended ten-chat operation
must not be marked PASS. The locally owned browser fixture and
manual browser navigation can still be exercised independently.

The officially supported Codex engineering route is **not blocked by
this particular Terms finding**. It still needs a real native-host
identity/QA contract and Windows installed acceptance before being
considered production-ready.

This document is a public-source technical/compliance assessment, not
legal advice or a claim of account-specific entitlements. Revisit
Gate 0 if a new, documented, explicitly authorized consumer ChatGPT
transport becomes available.
