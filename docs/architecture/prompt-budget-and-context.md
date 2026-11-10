# Prompt budget and context projection

The supervisor controls prompt count per workspace, not GitHub operations. `checkPromptBudget` admits a prompt only when its workspace is READY, the outbox has no unresolved prompt, a per-workspace count remains and the global active capacity is available. Host must serialize the budget check with durable reservation; the pure gate alone does not prevent races.

`projectPromptContext` creates a bounded summary of the target workspace's own goal, decisions, constraints, progress, last response and next action. It rejects an explicitly mismatched last-response identity. This is not semantic understanding, and the host must authenticate the provenance of every input; never let untrusted model text select another workspace.

The transport still needs a documented authenticated send/observe API for existing ChatGPT conversations. No web UI scraping or direct GitHub write is part of this feature. Source tests authored, not run.
