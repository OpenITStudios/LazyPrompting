# GitHub checkpoint verification adapter

GitHubCheckpointVerifier implements the read-only source verification contract for RepositoryHandoffPreflight. A trusted host injects authenticated getBranchHead and readFile callbacks. It pins exact repository, branch and commit SHA; reads AGENTS.md, GITHUB_RULES.md and canonical status at immutable commit ref; re-reads branch HEAD to detect concurrent movement.

It never writes GitHub. File content and status metadata are evidence of source existence, not evidence that all work is complete or that tests passed. The caller must separately enforce workspace permissions and authenticate the injected GitHub client. A fabricated callback is not independent proof.

No GitHub SDK, credentials, ChatGPT session API or runtime execution is bundled. Existing ChatGPT consumer chat handoff remains blocked without a supported transport.
