// Lightpanda CDP is separate from WebView2. Configuration discovery only.
// Never spawn a process, connect to an endpoint or enable automation here.
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::io::{Read, Write};
use std::time::Duration;

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
// Explicit one-shot TCP reachability probe. A successful socket is NOT a CDP handshake.
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct LightpandaProbeResult {
    pub source: &'static str,
    pub backend: &'static str,
    pub endpoint_configured: bool,
    pub tcp_reachable: bool,
    pub cdp_verified: bool,
    pub automation_enabled: bool,
    pub reason: &'static str,
}
#[tauri::command]
pub async fn lightpanda_probe() -> LightpandaProbeResult {
    let endpoint=std::env::var(ENDPOINT_ENV).ok();
    let parsed=endpoint.as_deref().and_then(parse_loopback_endpoint);
    let Some(address)=parsed else {
        return LightpandaProbeResult {
            source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",
            endpoint_configured:false,tcp_reachable:false,cdp_verified:false,
            automation_enabled:false,
            reason:if endpoint.is_some() {"INVALID_ENDPOINT_CONFIGURATION"} else {"NOT_CONFIGURED"},
        };
    };
    // Blocking socket connect is moved off the async command thread.
    let reachable=tauri::async_runtime::spawn_blocking(move ||
        TcpStream::connect_timeout(&address,Duration::from_millis(350)).is_ok()
    ).await.unwrap_or(false);
    LightpandaProbeResult {
        source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",
        endpoint_configured:true,tcp_reachable:reachable,cdp_verified:false,
        automation_enabled:false,
        reason:if reachable {"TCP_REACHABLE_CDP_UNVERIFIED"} else {"TCP_UNREACHABLE"},
    }
}


fn validate_cdp_http_response(received: &[u8], port: u16) -> bool {
    if received.len()>8192 {return false;}
    let Ok(text)=std::str::from_utf8(received) else {return false};
    let Some((headers,body))=text.split_once("\r\n\r\n") else {return false};
    let mut lines=headers.split("\r\n");
    if !matches!(lines.next(),Some("HTTP/1.1 200 OK")|Some("HTTP/1.0 200 OK")) {return false;}
    let mut length=None;
    let mut content_type=false;
    for line in lines {
        let Some((name,value))=line.split_once(':') else {return false};
        let value=value.trim();
        if name.eq_ignore_ascii_case("transfer-encoding") {return false;}
        if name.eq_ignore_ascii_case("content-type") {
            if content_type || !value.to_ascii_lowercase().starts_with("application/json") {return false;}
            content_type=true;
        }
        if name.eq_ignore_ascii_case("content-length") {
            if length.is_some() || !value.bytes().all(|b|b.is_ascii_digit()) {return false;}
            length=value.parse::<usize>().ok();
        }
    }
    if !content_type || length!=Some(body.len()) || body.len()>4096 {return false;}
    let Ok(value)=serde_json::from_str::<serde_json::Value>(body) else {return false};
    let Some(browser)=value.get("Browser").and_then(|v|v.as_str()) else {return false};
    let Some(protocol)=value.get("Protocol-Version").and_then(|v|v.as_str()) else {return false};
    let Some(ws)=value.get("webSocketDebuggerUrl").and_then(|v|v.as_str()) else {return false};
    let Ok(url)=tauri::Url::parse(ws) else {return false};
    !browser.is_empty() && browser.len()<=128 &&
      !protocol.is_empty() && protocol.len()<=32 &&
      url.scheme()=="ws" && url.host_str()==Some("127.0.0.1") &&
      url.port()==Some(port) && url.username().is_empty() &&
      url.password().is_none() && url.query().is_none() &&
      url.fragment().is_none() && url.path().starts_with("/devtools/browser/") &&
      url.path().len()>"/devtools/browser/".len()
}

// Bounded, read-only HTTP discovery. Never follow redirects or connect to returned WS URLs.
fn discover_cdp_version(address: SocketAddr) -> bool {
    let Ok(mut stream)=TcpStream::connect_timeout(&address,Duration::from_millis(350)) else {return false};
    if stream.set_read_timeout(Some(Duration::from_millis(350))).is_err() ||
       stream.set_write_timeout(Some(Duration::from_millis(350))).is_err() {return false;}
    let request=format!("GET /json/version HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\nAccept: application/json\r\n\r\n",address.port());
    if stream.write_all(request.as_bytes()).is_err(){return false;}
    let mut buffer=[0u8;2048];
    let mut received=Vec::new();
    let mut expected_total=None;
    loop {
        let Ok(count)=stream.read(&mut buffer) else {return false};
        if count==0 {break;}
        if received.len()+count>8192 {return false;}
        received.extend_from_slice(&buffer[..count]);
        if expected_total.is_none() {
            if let Some(header_end)=received.windows(4).position(|part|part==b"\r\n\r\n") {
                let header_end=header_end+4;
                let Ok(headers)=std::str::from_utf8(&received[..header_end]) else {return false};
                let mut declared=None;
                for line in headers.split("\r\n") {
                    if let Some((name,value))=line.split_once(':') {
                        if name.eq_ignore_ascii_case("content-length") {
                            if declared.is_some() {return false;}
                            declared=value.trim().parse::<usize>().ok();
                        }
                    }
                }
                let Some(length)=declared else {return false};
                if length>4096 || header_end+length>8192 {return false;}
                expected_total=Some(header_end+length);
            }
        }
        if let Some(total)=expected_total {
            if received.len()>total {return false;}
            if received.len()==total {break;}
        }
    }
    validate_cdp_http_response(&received,address.port())
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct LightpandaDiscoveryResult {
    pub source: &'static str,
    pub backend: &'static str,
    pub discovery_shape_valid: bool,
    pub identity_verified: bool,
    pub websocket_connected: bool,
    pub automation_enabled: bool,
    pub reason: &'static str,
}
#[tauri::command]
pub async fn lightpanda_discover() -> LightpandaDiscoveryResult {
    let endpoint=std::env::var(ENDPOINT_ENV).ok();
    let address=endpoint.as_deref().and_then(parse_loopback_endpoint);
    let valid=if let Some(address)=address {
        tauri::async_runtime::spawn_blocking(move ||discover_cdp_version(address)).await.unwrap_or(false)
    } else {false};
    LightpandaDiscoveryResult {
        source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",
        discovery_shape_valid:valid,identity_verified:false,
        websocket_connected:false,automation_enabled:false,
        reason:if valid {"CDP_DISCOVERY_SHAPE_ONLY"} else {"CDP_DISCOVERY_UNAVAILABLE"},
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_loopback_endpoint,validate_cdp_http_response};
    #[test]
    fn strict_http_discovery_rejects_malformed_framing_and_ws_urls() {
        let body=r#"{"Browser":"Lightpanda/1","Protocol-Version":"1.3","webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/browser/abc"}"#;
        let make=|length:usize,extra:&str|format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {length}\r\n{extra}\r\n\r\n{body}");
        assert!(validate_cdp_http_response(make(body.len(),"").as_bytes(),9222));
        assert!(!validate_cdp_http_response(make(body.len()+1,"").as_bytes(),9222));
        assert!(!validate_cdp_http_response(make(body.len(),"Transfer-Encoding: chunked\\r\\n").as_bytes(),9222));
        assert!(!validate_cdp_http_response(make(body.len(),"Content-Length: 10\\r\\n").as_bytes(),9222));
        let remote=body.replace("127.0.0.1:9222","example.com:9222");
        let response=format!("HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\nContent-Length: {}\\r\\n\\r\\n{}",remote.len(),remote);
        assert!(!validate_cdp_http_response(response.as_bytes(),9222));
    }
    #[test]
    fn accepts_numeric_ipv4_loopback_only() {
        assert!(parse_loopback_endpoint("127.0.0.1:9222").is_some());
        for bad in ["localhost:9222","0.0.0.0:9222","192.168.1.1:9222","127.0.0.1:0","127.0.0.1:99999","http://127.0.0.1:9222","127.0.0.1:9222/path","127.0.0.1:9222?x=1","127.0.0.1:9222 ","127.0.0.2:9222"] {
            assert!(parse_loopback_endpoint(bad).is_none(),"{bad}");
        }
    }
}
