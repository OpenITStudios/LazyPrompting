# Native Desktop Shell — Source Only

Tauri 2 Rust host with exactly one registered read-only command: runtime_status.
No process launch, browser navigation, ChatGPT session control, filesystem writes, credential storage or automation commands are exposed.
The capability file contains core:default only. Keep the command allowlist narrow and add native browser lifecycle commands only after explicit admission and a separate security review.

The Rust project and frontend have not been compiled, executed or tested on Windows. The app icon, distribution signing, resource policies and real browser management are future work.
