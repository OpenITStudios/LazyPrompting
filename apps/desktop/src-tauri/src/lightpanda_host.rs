// Lightpanda is an independent CDP automation backend, not an embedded WebView.
// Read-only status until explicit host configuration, scoped approval and compliance checks.
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct LightpandaHostStatus {
    pub source: &'static str,
    pub backend: &'static str,
    pub connected: bool,
    pub verified: bool,
    pub automation_enabled: bool,
    pub reason: &'static str,
}

#[tauri::command]
pub fn lightpanda_host_status() -> LightpandaHostStatus {
    LightpandaHostStatus {
        source:"NATIVE_LIGHTPANDA_HOST",
        backend:"LIGHTPANDA_CDP",
        connected:false,
        verified:false,
        automation_enabled:false,
        reason:"NOT_CONFIGURED",
    }
}
