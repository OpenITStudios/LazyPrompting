# Shared-profile tab lifecycle and recovery

The shared-profile native registry is now the sole registered Tauri workspace owner. Legacy InstanceRegistry source is retained temporarily as inactive reference, not wired into the app. One browser profile remains user-owned; tabs are logically separate.

Pure TabLifecycle accepts only verified observations of workspace/conversation/tab identities. A changed tab identity blocks rather than silently retargeting. Only one view is focused. After process restart all non-closed tabs are LOST until the supported host independently verifies their identities. Parking a tab does not pause a generation.

No browser is installed, launched, controlled, or scraped. A real browser provider must furnish authoritative tab identity, process ownership, shared manual login, logout and crash recovery before any native tab commands are enabled. Tests authored but not executed.
