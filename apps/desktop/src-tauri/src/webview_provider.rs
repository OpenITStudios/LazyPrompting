use serde::Serialize;

// A read-only host boundary. This is NOT evidence that WebView login or navigation works.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewProviderStatus {
    pub candidate: &'static str,
    pub os: &'static str,
    pub configured: bool,
    pub runtime_observed: bool,
    pub shared_login_verified: bool,
    pub tab_identity_verified: bool,
    pub browser_install_authorized: bool,
    pub navigation_enabled: bool,
    pub automation_enabled: bool,
}
pub fn status() -> WebviewProviderStatus {
    WebviewProviderStatus {
        candidate: "SYSTEM_WEBVIEW",
        os: std::env::consts::OS,
        configured: false,
        runtime_observed: false,
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
        assert!(!s.configured && !s.runtime_observed && !s.navigation_enabled && !s.automation_enabled);
    }
}
