// Native-only Lightpanda authorization policy. This module is deliberately NOT a Tauri command.
// Renderer/MCP JSON must never be allowed to set trusted policy or bypass process ownership.
const PREVIEW_PATH: &str = "/browser-preview.html";
pub(crate) fn workspace_allowed(workspace: &str) -> bool {
    let Some(number)=workspace.strip_prefix("workspace-") else {return false};
    number.len()==2 && matches!(number.parse::<u8>(),Ok(1..=10)) &&
        number.bytes().all(|b|b.is_ascii_digit())
}
pub(crate) fn preview_url_allowed(url: &str) -> bool {
    let Ok(parsed)=tauri::Url::parse(url) else {return false};
    parsed.scheme()=="http" &&
    parsed.host_str()==Some("127.0.0.1") &&
    parsed.port()==Some(1425) &&
    parsed.path()==PREVIEW_PATH &&
    parsed.query().is_none() &&
    parsed.fragment().is_none() &&
    parsed.username().is_empty() &&
    parsed.password().is_none()
}
pub(crate) fn admit_lightpanda_operation(
    capability: &str,
    workspace: &str,
    url: Option<&str>,
    operator_approved: bool,
    native_transport_verified: bool,
    compliance_verified: bool,
    stopped: bool,
) -> bool {
    if stopped || !operator_approved || !native_transport_verified || !compliance_verified ||
       !workspace_allowed(workspace) {return false;}
    match capability {
        "lightpanda.open" => url.is_some_and(preview_url_allowed),
        "lightpanda.snapshot" | "lightpanda.close" => url.is_none(),
        _ => false,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn denies_without_all_native_gates() {
        assert!(!admit_lightpanda_operation("lightpanda.open","workspace-01",Some("http://127.0.0.1:1425/browser-preview.html"),false,true,true,false));
        assert!(!admit_lightpanda_operation("lightpanda.open","workspace-01",Some("http://127.0.0.1:1425/browser-preview.html"),true,false,true,false));
        assert!(!admit_lightpanda_operation("lightpanda.open","workspace-01",Some("http://127.0.0.1:1425/browser-preview.html"),true,true,false,false));
        assert!(!admit_lightpanda_operation("lightpanda.open","workspace-01",Some("http://127.0.0.1:1425/browser-preview.html"),true,true,true,true));
    }
    #[test] fn canonical_workspace_and_url_only() {
        for id in ["workspace-00","workspace-11","workspace-1","workspace-01x","workspace-99"] {
            assert!(!workspace_allowed(id));
        }
        for url in ["https://example.com/browser-preview.html","http://localhost:1425/browser-preview.html","http://127.0.0.1:1425/admin","http://127.0.0.1:1425/browser-preview.html?x=1","http://127.0.0.1:1425/browser-preview.html#x"] {
            assert!(!preview_url_allowed(url));
        }
        assert!(admit_lightpanda_operation("lightpanda.open","workspace-10",Some("http://127.0.0.1:1425/browser-preview.html"),true,true,true,false));
        assert!(admit_lightpanda_operation("lightpanda.snapshot","workspace-01",None,true,true,true,false));
        assert!(!admit_lightpanda_operation("lightpanda.open","workspace-01",None,true,true,true,false));
    }
}
