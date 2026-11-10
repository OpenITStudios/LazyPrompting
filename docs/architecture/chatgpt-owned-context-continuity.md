# ChatGPT-owned context continuation — canonical product boundary

LazyPrompting supervises chat workspaces, session limits, retries, prompt preparation, handoff routing and retained chat references. ChatGPT owns the task context, user decisions, connected source access and optional GitHub operations. LazyPrompting does not read or verify project repositories, maintain task checkpoint files or commit user projects.

Chat continuation carries minimal routing identity (workspace, old session, task, goal, next step, optional project hint). The new ChatGPT chat must recover context using its available capabilities and verify any missing details; ChatGPT memory is not guaranteed to include the complete prior conversation.

The earlier repository-first continuity, checkpoint verifier and preflight modules remain historical source but are **not on the active handoff path**. HandoffCoordinator no longer requires repositoryPreflight. No ChatGPT consumer chat transport is connected, and no live automatic chat creation is claimed. Old chats are retained.
