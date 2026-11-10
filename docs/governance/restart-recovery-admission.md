# Restart recovery admission — source-only

A task with any previous journal entry, replay reservation or checkpoint pending identity is blocked from dispatch until independent reconciliation. The gate is wired to the trusted runtime when journalPath is configured. It is deliberately conservative: a completed journal task also cannot reuse its old taskId.

This closes the source-level blind spot where a restarted process might attempt the same task again without checking the journal. It does **not** solve cross-file atomicity or a crash between inspecting the journal and writing the intent. A real host must serialize admission and dispatch, enforce unique task IDs, and use transactional storage or an independently fenced distributed coordinator.

The current GuardedGitHubWriter requires an injected conditionalWrite function. GitHub's ordinary update-ref force:false is not an exact expected-old-SHA compare-and-swap contract, so it must not be represented as such. Until a reviewed atomic remote write primitive exists, GitHub writes remain host-gated and not production-ready.

Tests authored, not executed. No real Codex transport, host session authentication, or multi-workspace runtime verification.
