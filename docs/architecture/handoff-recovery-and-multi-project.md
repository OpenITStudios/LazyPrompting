# Handoff recovery and multi-project workspace metadata

The registry now accepts bounded repository/branch metadata for different projects. This is **not** a grant to write other repositories: LazyPrompting remains prompt-only, and ChatGPT's own permissions govern all GitHub work. Older routing/agent modules remain LazyPrompting/Local-specific and are not the approved multi-project prompt path.

Handoff recovery classification distinguishes a reserved handoff whose new-chat creation outcome is unknown from a registry session switch already committed but not yet recorded in the handoff ledger. Neither case automatically creates another chat. Old sessions remain retained in previousSessions.

Still open: trusted host session lookup, authenticated create/send/observe, cross-file atomic reconciliation, attachment continuity, real archival, 10-chat runtime QA. Source-only; tests authored not run.
