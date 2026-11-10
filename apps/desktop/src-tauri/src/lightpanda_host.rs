// Lightpanda CDP is separate from WebView2. Configuration discovery only.
// Never spawn a process, connect to an endpoint or enable automation here.
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};

const ENDPOINT_ENV: &str = "LAZYPROMPTING_LIGHTPANDA_CDP_ENDPOINT";
fn parse_loopback_endpoint(raw: &str) -> Option<SocketAddr> {
    // Numeric loopback only: no DNS resolution, userinfo, paths, queries or remote hosts.
    if raw.is_empty() || raw.trim()!=raw || raw.len()>64 { return None; }
    let (host,port)=raw.rsplit_once(':')?;
    let ip: IpAddr=host.parse().ok()?;
    if !ip.is_loopback() || !matches!(ip,IpAddr::V4(_)) {return None;}
    let port: u16=port.parse().ok()?;
    if port==0 || host!=Ipv4Addr::LOCALHOST.to_string() {return None;}
    Some(SocketAddr::new(ip,port))
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct LightpandaHostStatus {
    pub source: &'static str,
    pub backend: &'static str,
    pub connected: bool,
    pub verified: bool,
    pub automation_enabled: bool,
    pub endpoint_configured: bool,
    pub reason: &'static str,
}
#[tauri::command]
pub fn lightpanda_host_status() -> LightpandaHostStatus {
    let configured=std::env::var(ENDPOINT_ENV).ok();
    let valid=configured.as_deref().and_then(parse_loopback_endpoint).is_some();
    LightpandaHostStatus {
        source:"NATIVE_LIGHTPANDA_HOST",
        backend:"LIGHTPANDA_CDP",
        connected:false,
        verified:false,
        automation_enabled:false,
        endpoint_configured:valid,
        reason:if valid {"ENDPOINT_CONFIGURED_NOT_CONNECTED"} else if configured.is_some() {"INVALID_ENDPOINT_CONFIGURATION"} else {"NOT_CONFIGURED"},
    }
}
#[cfg(test)]
mod tests {
    use super::parse_loopback_endpoint;
    #[test]
    fn accepts_numeric_ipv4_loopback_only() {
        assert!(parse_loopback_endpoint("127.0.0.1:9222").is_some());
        for bad in ["localhost:9222","0.0.0.0:9222","192.168.1.1:9222","127.0.0.1:0","127.0.0.1:99999","http://127.0.0.1:9222","127.0.0.1:9222/path","127.0.0.1:9222?x=1","127.0.0.1:9222 ","127.0.0.2:9222"] {
            assert!(parse_loopback_endpoint(bad).is_none(),"{bad}");
        }
    }
}
