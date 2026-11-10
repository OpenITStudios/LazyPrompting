use serde::Serialize;

// A read-only host boundary. This is NOT evidence that WebView login or navigation works.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewProviderStatus {
    pub candidate: &'static str,
    pub os: &'static str,
    pub configured: bool,
    pub runtime_observed: bool,
    pub runtime_version: Option<String>,
    pub discovery_source: &'static str,
    pub shared_login_verified: bool,
    pub tab_identity_verified: bool,
    pub browser_install_authorized: bool,
    pub navigation_enabled: bool,
    pub automation_enabled: bool,
}
pub fn status() -> WebviewProviderStatus {
    let version = discover_runtime_version();
    WebviewProviderStatus {
        candidate: "SYSTEM_WEBVIEW",
        os: std::env::consts::OS,
        configured: false,
        runtime_observed: version.is_some(),
        runtime_version: version,
        discovery_source: if cfg!(windows) { "WINDOWS_REGISTRY_READ_ONLY" } else { "NOT_IMPLEMENTED" },
        shared_login_verified: false,
        tab_identity_verified: false,
        browser_install_authorized: false,
        navigation_enabled: false,
        automation_enabled: false,
    }
}
// A registry version is only installation evidence; it does not prove that a WebView can start.
#[cfg(windows)]
fn discover_runtime_version() -> Option<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;
    // WebView2 Evergreen runtime product GUID, read-only. No process invocation.
    const WEBVIEW2: &str = r"Software\Microsoft\EdgeUpdate\Clients\{F1E7E1A8-0E0B-4B4B-AB7A-11F4AFA5F3B7}";
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        let root = RegKey::predef(hive);
        if let Ok(key) = root.open_subkey_with_flags(WEBVIEW2, KEY_READ) {
            if let Ok(version) = key.get_value::<String, _>("pv") {
                if version.len() <= 64 && version.split('.').all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
                    && version != "0.0.0.0" { return Some(version); }
            }
        }
    }
    None
}
#[cfg(not(windows))]
fn discover_runtime_version() -> Option<String> { None }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_gate_is_closed() {
        let s=status();
        assert!(!s.configured && !s.navigation_enabled && !s.automation_enabled);
        assert_eq!(s.runtime_observed, s.runtime_version.is_some());
    }
}
