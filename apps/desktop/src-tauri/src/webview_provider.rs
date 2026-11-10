use serde::Serialize;

// Read-only candidate discovery; a filesystem observation is not a usability proof.
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
#[cfg(target_os = "windows")]
fn detect_webview2_candidate() -> bool {
    // Presence-only: do not run binaries, inspect profiles, or infer login compatibility.
    // Fixed system installation roots only; never trust renderer-supplied paths.
    let roots = [
        std::env::var_os("ProgramFiles(x86)"),
        std::env::var_os("ProgramFiles"),
    ];
    for root in roots.into_iter().flatten() {
        let base = std::path::PathBuf::from(root)
            .join("Microsoft")
            .join("EdgeWebView")
            .join("Application");
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let Some(version) = path.file_name().and_then(|s| s.to_str()) else {
                    continue;
                };
                if !version.contains('.')
                    || !version.chars().all(|c| c.is_ascii_digit() || c == '.')
                {
                    continue;
                }
                if path.join("msedgewebview2.exe").is_file() {
                    return true;
                }
            }
        }
    }
    false
}
pub fn status() -> WebviewProviderStatus {
    #[cfg(target_os = "windows")]
    let observed = detect_webview2_candidate();
    #[cfg(not(target_os = "windows"))]
    let observed = false;
    WebviewProviderStatus {
        candidate: "SYSTEM_WEBVIEW",
        os: std::env::consts::OS,
        configured: false,
        runtime_observed: observed,
        runtime_usable_verified: false,
        runtime_version: None,
        discovery_source: if observed {
            "WINDOWS_SYSTEM_FILES"
        } else {
            "NOT_OBSERVED"
        },
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
    fn candidate_never_enables_browser_automatically() {
        let s = status();
        assert!(
            !s.configured
                && !s.runtime_usable_verified
                && !s.navigation_enabled
                && !s.automation_enabled
        );
        assert!(s.runtime_version.is_none());
        assert_eq!(
            s.runtime_observed,
            s.discovery_source == "WINDOWS_SYSTEM_FILES"
        );
    }
}
