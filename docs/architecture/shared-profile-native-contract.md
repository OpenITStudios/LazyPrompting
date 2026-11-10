# Shared profile native contract

A single browser-owned login/profile is shared across all workspace views. Rust SharedProfileRegistry tracks at most ten distinct workspace/conversation bindings, one selected view and pending state. This is logical routing, not browser process isolation. It does not own cookies or credentials.

Current Tauri exposure is intentionally read-only. Rust mutation methods are internal and cannot be invoked from the UI; their eventual command admission must require trusted host evidence, ownership checks, and pending-prompt reconciliation. The older InstanceRegistry represents provisional identities, not separate browser processes; it must not be used to spawn per-workspace profiles.

Before installing a browser: choose supported provider, establish one profile's lifecycle and explicit user login, verify navigation and tab identity, recovery after restart, shared logout, and measured memory/CPU. No browser was installed or launched. Rust/frontend tests remain unexecuted.
