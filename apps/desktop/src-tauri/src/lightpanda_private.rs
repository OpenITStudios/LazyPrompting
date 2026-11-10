use serde_json::{json, Value};
use std::io::{self, Read, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};
use tungstenite::{client, Message, WebSocket};

const PREVIEW: &str = include_str!("../../public/browser-preview.html");
const RELAY: &str = include_str!("lightpanda_relay.py");
const MAX_FRAME: usize = 1024 * 1024;

struct Relay {
    process: Child,
    stdin: Option<ChildStdin>,
    stdout: ChildStdout,
}

impl Read for Relay {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        self.stdout.read(bytes)
    }
}

impl Write for Relay {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.stdin
            .as_mut()
            .ok_or(io::ErrorKind::BrokenPipe)?
            .write(bytes)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.stdin
            .as_mut()
            .ok_or(io::ErrorKind::BrokenPipe)?
            .flush()
    }
}

impl Drop for Relay {
    fn drop(&mut self) {
        self.stdin.take();
        let deadline = Instant::now() + Duration::from_secs(3);
        while matches!(self.process.try_wait(), Ok(None)) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        if matches!(self.process.try_wait(), Ok(None)) {
            let _ = self.process.kill();
        }
        let _ = self.process.wait();
    }
}

// All operations run off the UI thread. No TCP connection is exposed to
// Windows or the rest of the WSL distro.
pub(crate) struct PrivateLightpanda {
    socket: WebSocket<Relay>,
    next_id: u32,
}

impl PrivateLightpanda {
    pub(crate) fn connect(binary: &str) -> Result<Self, &'static str> {
        if !binary.starts_with('/') || binary.len() > 2048 || binary.contains('\0') {
            return Err("LIGHTPANDA_BINARY_PATH_REQUIRED");
        }
        let system_root = std::env::var_os("SystemRoot").ok_or("WINDOWS_SYSTEM_ROOT_REQUIRED")?;
        let wsl = PathBuf::from(&system_root).join("System32/wsl.exe");
        if !wsl.is_absolute() {
            return Err("WINDOWS_SYSTEM_ROOT_REQUIRED");
        }
        let mut process = Command::new(wsl)
            .args([
                "-d",
                "Ubuntu",
                "--exec",
                "/usr/bin/unshare",
                "-Urn",
                "/usr/bin/python3",
                "-I",
                "-c",
                RELAY,
                binary,
                PREVIEW,
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "LIGHTPANDA_RELAY_SPAWN_FAILED")?;
        let relay = Relay {
            stdin: process.stdin.take(),
            stdout: process.stdout.take().expect("piped relay stdout"),
            process,
        };
        let config = tungstenite::protocol::WebSocketConfig {
            max_message_size: Some(MAX_FRAME),
            max_frame_size: Some(MAX_FRAME),
            ..Default::default()
        };
        let (socket, _) = client::client_with_config("ws://127.0.0.1:9222/", relay, Some(config))
            .map_err(|_| "LIGHTPANDA_PRIVATE_HANDSHAKE_FAILED")?;
        let mut connection = Self { socket, next_id: 0 };
        let version = connection.rpc("Browser.getVersion", json!({}), None)?;
        // The sealed binary supplies identity. Lightpanda advertises Chrome
        // here for CDP compatibility.
        if version["protocolVersion"] != "1.3" {
            return Err("LIGHTPANDA_PROTOCOL_MISMATCH");
        }
        Ok(connection)
    }

    pub(crate) fn rpc(
        &mut self,
        method: &str,
        params: Value,
        session: Option<&str>,
    ) -> Result<Value, &'static str> {
        let id = self.next_id.checked_add(1).ok_or("CDP_ID_EXHAUSTED")?;
        self.next_id = id;
        let mut request = json!({"id":id,"method":method,"params":params});
        if let Some(session) = session {
            request["sessionId"] = json!(session);
        }
        self.socket
            .send(Message::Text(request.to_string().into()))
            .map_err(|_| "CDP_WRITE_FAILED")?;
        for _ in 0..256 {
            let message = self.socket.read().map_err(|_| "CDP_READ_FAILED")?;
            if let Message::Text(text) = message {
                let reply: Value =
                    serde_json::from_str(&text).map_err(|_| "CDP_INVALID_RESPONSE")?;
                if reply["id"] != id {
                    continue;
                }
                if reply.get("sessionId").and_then(Value::as_str) != session {
                    return Err("CDP_SESSION_MISMATCH");
                }
                return reply
                    .get("result")
                    .filter(|result| result.is_object())
                    .cloned()
                    .ok_or("CDP_COMMAND_FAILED");
            }
        }
        Err("CDP_RESPONSE_LIMIT")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires a pinned Lightpanda binary in Ubuntu WSL2"]
    fn private_wsl_browser_opens_local_preview() {
        let binary = std::env::var("LAZY_LIGHTPANDA_TEST_BINARY").unwrap();
        let mut cdp = PrivateLightpanda::connect(&binary).unwrap();
        let context = cdp
            .rpc("Target.createBrowserContext", json!({}), None)
            .unwrap();
        let target = cdp
            .rpc(
                "Target.createTarget",
                json!({
                    "url":"about:blank","browserContextId":context["browserContextId"]
                }),
                None,
            )
            .unwrap();
        let attached = cdp
            .rpc(
                "Target.attachToTarget",
                json!({
                    "targetId":target["targetId"],"flatten":true
                }),
                None,
            )
            .unwrap();
        let session = attached["sessionId"].as_str().unwrap();
        cdp.rpc(
            "Page.navigate",
            json!({"url":"http://127.0.0.1:1425/browser-preview.html"}),
            Some(session),
        )
        .unwrap();
        let title = cdp
            .rpc(
                "Runtime.evaluate",
                json!({
                    "expression":"document.title","returnByValue":true
                }),
                Some(session),
            )
            .unwrap();
        assert_eq!(title["result"]["value"], "Browser 01 · Local WebView Proof");
        cdp.rpc("Target.disposeBrowserContext", context, None)
            .unwrap();
    }
}
