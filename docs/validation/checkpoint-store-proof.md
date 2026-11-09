# Durable Checkpoint Store — Source and Proof Boundary

## Implementation
`src/supervisor/checkpoint-store.mjs` is a Node.js filesystem checkpoint adapter using:
- Exclusive lock directory per checkpoint file to serialize single-host writers (no silent lock stealing).
- Versioned compare-and-swap through `transitionCheckpoint`.
- Write-to-unique-temp + file sync + atomic rename, with best-effort parent-directory sync.
- On restart, any pending/uncertain task returns `RECONCILE_REQUIRED`, not automatic resend.
- No browser, Codex, GitHub mutation, external model or dispatch capability.

## Required assumptions
One trusted host/process family, one local filesystem with compatible atomic rename and directory locking semantics; storage path must be supplied by a trusted host and protected from symlink/path substitution. This is NOT a distributed lock or proof of durability across all operating systems and filesystems.

## Important limitations
- Crash can leave a lock directory; operator recovery is needed. Do not automatically remove it without validating that no writer is alive.
- A crash between dispatch and acknowledgement requires querying the authoritative transport for task ID, not retrying blindly.
- Disk failure, permissions, symlinks, NFS/SMB and Windows filesystem semantics require platform-specific tests.
- A file replacement may fail on certain host configurations. Failure is not permission to dispatch.
- The store accepts `trustedEvidence`/authorization flags supplied by caller; only a trusted broker can validate them.
- The store does not yet enforce immutable goal hash on every event, historical replay across unlimited task IDs, or retention quotas.

## QA
`tests/run-checkpoint-store.mjs` authors 11 Node filesystem scenarios for initialization, duplicate init, reserve, stale CAS, reopening, uncertain dispatch, untrusted/trusted result, replay and lock contention.

**Status: TEST_AUTHORED_NOT_RUN.** The source has been committed to GitHub but no native Node/filesystem execution of this store has occurred in this session. The earlier 22/22 checkpoint transition function-level result remains separate.

## Next proof gate
Execute the exact source/fixture revision in a trusted Node environment and report runner command, platform, SHA, and results; then add crash/restart fault injection before any transport integration.
