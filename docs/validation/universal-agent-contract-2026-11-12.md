# Universal Agent Backend Contract — Source Gate 1 (12 November 2026)

**Repository:** `OpenITStudios/LazyPrompting`, `Local`.  
**Parent/source baseline:** `b76a1e92760bb558af3c3f3edcd63f0481152f44`.  
**Classification:** `SOURCE_COMMITTED` for the new implementation; `EXECUTED_TEST_PASS` for isolated Node contract tests only. Windows native, authenticated provider registration, OpenCode worker execution, production QA and multi-platform acceptance: **NOT_EXECUTED**.

## Implementation owned by `src/agent/`

| Module | Enforced property |
| --- | --- |
| `agent-contract.mjs` | Fixed versioned provider manifest, pinned binary digest, enumerated capabilities, exact backend interface |
| `agent-backend-registry.mjs` | A trusted host verification callback is mandatory; no duplicate/reentrant registration, no unverified capability promotion, no silent provider fallback |
| `agent-events.mjs` | Exact goal/task/dispatch/provider/session/turn/process/source binding; event sequence replay checks, single-flight verification and sticky unknown-outcome reconciliation |
| `goal-scope-v2.mjs` | New digest domain combining the unchanged v1 immutable scope with verified provider manifest, permission digest and native sandbox digest |

The new code is intentionally unreferenced by the installed gateway. Existing four public MCP tool names, Codex runtime, native approval and legacy v1 checkpoint formats are unchanged. This release **does not** make OpenCode a goal worker or enable write access.

## Tests and reproducibility

Runner: `node --test tests/universal-agent-contract.test.mjs`.  
Executed on a Node 22.16.0 Linux working environment in an isolated source tree, with the actual existing `src/transport/goal-run-scope.mjs` blob identical to the pinned GitHub source (blob `c50d1cdcfa9a3236ea8e53406312a5209d2f17fe`). New module/test blobs were compared using Git blob hashes before commit.

Result: **21 tests passed, 0 failed, 0 skipped**. Covered malformed/bogus provider profiles, missing backend methods, self-claimed trust, duplicate in-flight registration, registry closure race, unverified workspace writes, wrong receipt scope, model-supplied QA, event replay/order, concurrent event verification race, stale provider identity, sticky disconnect/unknown outcomes, host-verifier failures, v1/v2 digest separation and changed sandbox/permission/provider hashes.

No native Windows process, login, installed client, GitHub CI workflow, actual worker, sandbox or user profile was launched. The existing `npm run preflight:localtest` now includes this contract test plus the earlier goal-admission and MCP handshake suites, but full preflight requires the exact Windows source checkout and available toolchains.

## Remaining hard boundaries

1. The trusted host must independently confirm the installed executable hash, adapter identity/version and actual provider capabilities. An object saying `TRUSTED_HOST` from a model is not sufficient.
2. Event verification and the per-process event cursor are **not** durable state. Integrate with existing `PromptOutbox`, checkpoint and signed/native receipts before allowing goal dispatch or resume.
3. The v2 fingerprint is a consistency guard, **not** permission, sandbox isolation, executable attestation or an upgrade of legacy approved v1 Codex checkpoints.
4. `SUPPORTED_VERIFIED` must remain host-verified and scoped to actual tested capabilities. OpenCode, Claude, Gemini and other worker adapters remain absent. Any unverified provider or feature fails closed.
5. The previous Windows native multi-client code still requires `cargo fmt --check`, `cargo check`, `cargo test`, a rebuilt installer and real-client negative tests at the new exact SHA.

**Next:** run native Windows acceptance on `Local`, then extract a versioned Codex adapter behind this interface with real host-owned dispatch reservation/receipt. Only afterwards pilot an explicitly read-only OpenCode worker.
