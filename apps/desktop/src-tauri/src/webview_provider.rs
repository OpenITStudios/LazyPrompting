use serde::Serialize;

// A read-only host boundary. This is NOT evidence that WebView login or navigation works.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewProviderStatus {
    pub candidate: &'static str,
    pub os: &'static str,
    pub configured: bool,
    pub runtime_observed: bool,
    pub runtime_usable_verified: bool,
    pub runtime_version: Option<String>,
    pub discovery_source: &'static str,
    pub shared_login_verified: bool,
    pub tab_identity_verified: bool,
    pub browser_install_authorized: bool,
    pub navigation_enabled: bool,
    pub automation_enabled: bool,
}
pub fn status() -> WebviewProviderStatus {
    // No trusted OS probe is wired yet. Do not interpret an unverified registry GUID as WebView2.
    WebviewProviderStatus {
        candidate: "SYSTEM_WEBVIEW",
        os: std::env::consts::OS,
        configured: false,
        runtime_observed: false,
        runtime_usable_verified: false,
        runtime_version: None,
        discovery_source: "NOT_IMPLEMENTED",
        shared_login_verified: false,
        tab_identity_verified: false,
        browser_install_authorized: false,
        navigation_enabled: false,
        automation_enabled: false,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_gate_is_closed() {
        let s=status();
        assert!(!s.configured && !s.runtime_usable_verified && !s.navigation_enabled && !s.automation_enabled);
        assert_eq!(s.runtime_observed, s.runtime_version.is_some());
    }
}
