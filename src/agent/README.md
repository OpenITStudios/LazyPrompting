# Universal Agent Backend — source-only runtime

The modules in this folder are a **host-injected v2 foundation**. They do not
register a new public MCP tool, enable OpenCode writing, connect a real account,
or migrate approved Codex v1 checkpoints. The existing four MCP tools and
Codex v1 goal runner remain unchanged.

| Owner | Responsibility |
| --- | --- |
| `agent-contract.mjs` | Strict provider profile, exact capabilities, executable and adapter fingerprints |
| `agent-backend-registry.mjs` | Backend registration only after trusted host attestation |
| `agent-events.mjs` | Scope-bound event/receipt normalization, replay and ordering guards |
| `goal-scope-v2.mjs` | Immutable v2 goal/worker/permission/sandbox fingerprint |
| `agent-run-controller.mjs` | Read-only dispatch, observe, cancel, session recovery and durable outbox reconciliation |
| `adapters/codex-app-server-backend.mjs` | Codex App Server worker adapter, independent of the legacy v1 runner |
| `adapters/opencode-cli-readonly-backend.mjs` | OpenCode JSONL worker adapter, requires host-proven read-only OS sandbox |
| `adapters/opencode-jsonl.mjs` | Bounded fail-closed JSONL session and terminal event parser |

The controller uses the existing `PromptOutbox` as **the only durable
dispatch/receipt owner**. Every external action is preceded by explicit
native-host approval and a persisted reservation; a lost response holds
`RECONCILE_REQUIRED` rather than retrying. A model-provided flag does not
authenticate anything. A provider completion is **not** independent QA.

The OpenCode adapter constructs a noninteractive read-only CLI invocation
only inside a separately host-verified process. No standalone CLI launch,
default permission relaxation, account login, generic shell access or writing
is enabled by this source.

Source checks:
```sh
npm run test:universal-agent-contract
npm run test:universal-agent-runtime
npm run test:universal-agent-adapters
npm run test:universal-agent-file-backed
```

See [runtime evidence](../../docs/validation/universal-agent-source-runtime-2026-11-12.md)
and [architecture](../../docs/architecture/universal-agent-orchestrator.md).
Windows Rust, packaging and real provider integration remain separately gated.
