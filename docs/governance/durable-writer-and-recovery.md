# Durable writer admission and recovery journal — source-first

The new `DurableWriteLease` uses exclusive mkdir on a private single-host directory. It binds owner workspace, expected GitHub HEAD and a random token; every subsequent write must independently verify ownership and current HEAD. A stale lock is never stolen automatically. This is **not** a GitHub server-side lease, and cannot fence writers outside this host.

`RecoveryJournal` records bounded ordered stages of a task in an append-only fsynced JSONL file. Its records are diagnostic evidence, not a license to resend an uncertain mutation. A crash during a journal write can produce a torn record; this fails closed. Cross-file atomicity between journal, replay ledger and checkpoint remains unresolved.

Neither module is yet wired to the actual GitHub write tool boundary or dispatch transaction. A production host must enforce a conditional Git ref update and a fencing identity on every write, plus durable crash reconciliation. Private filesystem ownership, symlink/reparse protection, network isolation and a trusted authenticated session binding remain prerequisites.

Source tests authored, not executed per user code-first decision.
