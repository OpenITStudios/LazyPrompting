# Universal Agent v2 source integration — 12 November 2026

**Target:** `OpenITStudios/LazyPrompting`, branch `Local`. 
**Classification:** SOURCE_COMMITTED on the final commit; isolated Linux
Node source tests are separately EXECUTED_TEST_PASS. All installed Windows,
live Codex/OpenCode and native security acceptance remains NOT_EXECUTED.

## Implemented source

- `src/agent/agent-run-controller.mjs`: host-injected read-only v2
  start/observe/cancel; exact worker profile/scope hash; host approval before
  worker probe; canonical `PromptOutbox` durable reservation before dispatch;
  session recovery must match the recorded scope and session; no blind retry.
- `src/agent/adapters/codex-app-server-backend.mjs`: adapter using the
  existing Codex App Server dialect. The existing Codex v1 runner is **not
  modified** and old outboxes are not upgraded.
- `src/agent/adapters/opencode-cli-readonly-backend.mjs`: OpenCode CLI
  JSONL read-only adapter, requiring a host-owned executable, session
  authority and independently verified OS sandbox. No implicit account
  authentication or external subprocess is launched by merely importing it.
- `src/agent/adapters/opencode-jsonl.mjs`: bounded, exact-session JSONL
  parser. Even exit code 0 without a verified terminal stop/text remains
  UNKNOWN. Unapproved tools and malformed/oversize records are rejected.
- Tests cover host/profile scope rejection, stale/foreign receipts, missing
  terminal event, no repeat after uncertain dispatch, independent host
  attestation, session restore checks, cancellation and file-backed
  restart/idempotence with the real `PromptOutbox`.

## Executed test evidence

**Node.js 22.16.0 isolated source environment, 45/45 tests passing:**

```sh
node --test tests/universal-agent-contract.test.mjs \
  tests/universal-agent-runtime.test.mjs \
  tests/universal-agent-adapters.test.mjs \
  tests/universal-agent-file-backed.test.mjs
```

The standalone source suite uses injected **fake trusted-host callbacks**
and a Codex transport test double, not a signed-in Codex CLI, OpenCode
worker or native Windows process. File-backed tests exercise the real
`PromptOutbox` and Linux `publishStateFile` path from the existing
source. The source bytes were published to GitHub only after confirming
that each created Git blob hash matched the tested file's content hash.

The v2 controller returns `qa=NOT_EXECUTED` and
`nextPromptAllowed=false` even after a result is host-attested. It is not
equivalent to independent QA or permission to continue.

## Explicit remaining gates

1. Trusted Tauri/Windows native host composition and verified registration
   callbacks are not implemented as an active v2 gateway. No new public MCP
   surface has been registered; `lazyprompting/codex` still uses v1.
2. The OpenCode adapter is source-ready for a host-injected **read-only**
   pilot only. OS isolation, operator approval, and actual CLI JSONL behavior
   must be proven on Windows before enabling worker execution. Writable
   operation stays blocked.
3. Full Windows Cargo, gateway staging, NSIS installation, multiple native
   clients, STOP/pause/resume, true worker result and false-QA rejection must
   be tested at the exact new `Local` commit when the PC becomes available.
   Historical tests at earlier SHAs cannot be reused.
4. Provider-specific terminal events, authenticated resume after host
   generation change, native write sandbox/QA, macOS/Linux IPC and
   additional provider adapters are still deferred. This milestone is
   **not a claim of production completeness**.

## Source references

- [Contract stage](universal-agent-contract-2026-11-12.md)
- [Universal architecture](../architecture/universal-agent-orchestrator.md)
- [Migration QA](universal-agent-migration-gates.md)
- [OpenCode CLI](https://opencode.ai/docs/cli/commands)
- [OpenCode SDK](https://opencode.ai/docs/build/sdk)
- [OpenCode permission model](https://opencode.ai/docs/permissions/)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
