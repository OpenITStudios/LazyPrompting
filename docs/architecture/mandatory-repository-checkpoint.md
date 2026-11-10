# Mandatory repository checkpoint gate

Every HandoffCoordinator instance now requires RepositoryHandoffPreflight. A handoff is blocked before ledger reservation or new-session creation when the checkpoint is absent, stale or unverifiable. The trusted host must independently attest repository rules, canonical status and exact branch HEAD; ChatGPT remains responsible for authorized repository writes.

When context limits interrupt a checkpoint, chooseLastVerifiedCheckpoint can identify a prior checkpoint only if it is still verified against current branch HEAD. Uncommitted work is explicitly UNKNOWN. If no checkpoint is verifiable, stop and request reconciliation. Never fabricate a commit or silently bypass the gate.

No existing ChatGPT consumer-session transport is connected. The coordinator still needs a host that can create and verify sessions, and cross-store recovery needs runtime QA. Source tests authored, not executed.
