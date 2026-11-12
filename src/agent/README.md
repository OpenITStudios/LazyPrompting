# Universal Agent Backend — source contract v1

**Source-only migration stage; not a new running MCP catalog or worker provider.**

The files here define strict host-attested worker profiles, capability
selection, receipt/event correlation, a monotonic event cursor, and a separate
v2 goal-scope fingerprint. They are not imported by the installed runtime yet.

- `agent-contract.mjs` owns the provider-neutral manifest and backend method
  contract; the host must establish executable identity and native capability
  proof independently. Manifest declarations cannot authorize activity.
- `agent-backend-registry.mjs` accepts only profiles attested by a trusted host
  callback; unknown and unverified capabilities fail closed. It must not be
  instantiated from arbitrary MCP/model arguments.
- `agent-events.mjs` binds a turn and its events to exact approved identity,
  requires a host-origin attestation callback, rejects stale/replayed events,
  and always returns `qa=NOT_EXECUTED`, `nextPromptAllowed=false`.
- `goal-scope-v2.mjs` locks worker identity, permission policy, native sandbox
  policy and the preexisting exact v1 goal scope. It does not authenticate
  approval, execute a worker, or upgrade legacy Codex checkpoints.

`npm run test:universal-agent-contract` runs deterministic fake-host tests.
No OpenCode/Claude/Gemini worker has been connected to these modules.
