# Repository checkpoint enforcement at chat handoff

A planned handoff must first verify the project's repository checkpoint. The source verifier must independently confirm exact repository, branch, commit SHA, canonical status path and rules. The generated resume prompt instructs ChatGPT in the new session to re-read the repository, compare HEAD and continue only unresolved work.

`RepositoryHandoffPreflight` is an injected read-only verifier. `HandoffCoordinator` can require this preflight before reserving or creating a replacement session, and passes the verified resume prompt to the supported host callback. Old chat remains retained.

An unexpected context limit may occur before a checkpoint is committed. In that case, the supervisor must use the last verified checkpoint or stop and request reconciliation. This feature does not create commits, access GitHub independently, or control existing consumer ChatGPT sessions. Runtime tests not executed.
