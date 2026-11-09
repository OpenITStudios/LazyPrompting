# Workspace Context Packet — normative proposal

A packet is created by a trusted host following an authenticated chat/workspace binding, not a language model or web page. Required keys:

```json
{
  "workspaceId":"ws1",
  "sessionId":"chat1",
  "taskId":"task1",
  "repository":"OpenITStudios/LazyPrompting",
  "branch":"Local",
  "headSha":"<40-lowercase-hex>",
  "contextRevision":1,
  "checkpointVersion":0,
  "grantId":"grant1"
}
```

Context retrieval must reject cross-namespace reads. BrowserContext ownership is one-to-one to workspace ID and browser cookies/storage are never treated as transferable context. Multi-session chat IDs must be supplied by supported host APIs; no DOM scraping or inferred chat-title mapping.

The pure `workspace-router.mjs` source only implements a conservative exact binding check and round-robin scheduling policy for up to ten registered workspaces; it is not a real browser/session manager and currently limits repository/branch to the already approved LazyPrompting Local target. General multi-repository support requires explicit repo+branch-scoped grants, owner permissions and separate storage layouts.

Both source tests and true concurrent isolation tests remain unexecuted.
