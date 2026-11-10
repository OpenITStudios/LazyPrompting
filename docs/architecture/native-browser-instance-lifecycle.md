# Native browser instance lifecycle — admission-first

Initial Rust implementation owns a bounded, in-memory registry of ten workspace identities and reports two reserved preview slots. Registration and removal do NOT create, navigate, suspend, or destroy a browser. The native command boundary is read-only until an explicitly approved browser provider is implemented and verified.

Future lifecycle states: UNBOUND → ADMITTED → STARTING → RUNNING → SUSPENDING → SUSPENDED → RESUMING → RUNNING → STOPPING → STOPPED; failures go to RECOVERY_REQUIRED. Each transition requires retained process identity, per-workspace storage isolation, permission scope and observed native evidence. Never infer a successful close or session state from a command receipt alone.

Capacity: ten logical workspaces, two default active previews; per-instance CPU/memory metrics require actual OS observation and are not claimed here. ChatGPT consumer session automation remains prohibited without a documented supported interface. No tests executed.
