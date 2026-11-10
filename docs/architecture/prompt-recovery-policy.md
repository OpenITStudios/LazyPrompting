# Prompt recovery and trusted budget policy

PromptRecovery classifies the outbox on restart without network sends: no pending record is READY; an ACK with a host response handle is OBSERVE_ONLY; a RESERVED or uncertain record is RECONCILE_REQUIRED; a cross-session or ambiguous record is BLOCKED. No automatic retry is allowed.

TrustedPromptPolicy fetches promptLimit and workspace identity from an authenticated host-owned source, not from model-provided values. The dispatch path must call it immediately before reservation and pass its returned budget. The policy is a source contract until wired to a real host identity and supported ChatGPT conversation transport.

Known limits: stale lock recovery, retention/archiving, cross-process host access, and actual ChatGPT send/observe API are not implemented. Do not use undocumented ChatGPT Web automation. Tests authored, not executed.
