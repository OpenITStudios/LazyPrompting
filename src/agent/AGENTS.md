# Universal Agent — Nearest-Owner Rules

Inherit root `AGENTS.md` and `GITHUB_RULES.md`. This directory does
**not** own native consent, credential storage, a second scheduler or a
second checkpoint/outbox.

- Keep the existing `PromptOutbox`, approval authority and worktree
  state owners canonical. Do not create shadow durable stores.
- Register providers only after trusted-host verification of actual
  binary, version, capabilities and scope. Model/MCP-supplied metadata is not
  proof of identity or permission.
- Persist the exact dispatch reservation **before** sending to a provider.
  Ambiguous outcome, disconnected worker or missing terminal record is
  `RECONCILE_REQUIRED`; never auto-repeat an unacknowledged turn.
- Preserve all old Codex v1 data, public MCP tool names and native STOP.
- Until independent OS write-sandbox and QA are proven, v2 remains read-only.
  Provider config alone is not a filesystem, network or secret boundary.
- An authenticated provider completion still does not equal acceptance or
  independently verified QA PASS. Each adapter requires negative tests.
