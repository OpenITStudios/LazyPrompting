// Native-owned MCP gateway session. Not a renderer command and not browser authorization.
// All blocking methods must run off the Tauri UI thread.
use super::gateway_child::GatewayChild;
use super::gateway_reader::GatewayReader;
use super::gateway_stdio::{write_message, RequestTracker};
use serde_json::{json, Value};
use std::path::Path;
use std::process::ChildStdin;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Default)]
pub(crate) struct GatewaySession {
    child: GatewayChild,
    input: Mutex<Option<ChildStdin>>,
    reader: Mutex<Option<GatewayReader>>,
    tracker: Mutex<RequestTracker>,
    operation: Mutex<()>,
    probe: Mutex<()>,
    #[cfg(windows)]
    pipe: Mutex<Option<super::native_ipc_pipe::NativePipeListener>>,
}

impl GatewaySession {
    pub(crate) fn probe_packaged(&self, root: &Path) -> Result<(), &'static str> {
        let _guard = self.probe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let deadline = Duration::from_secs(5);
        let result = (|| {
            if self.child.pid()?.is_none() {
                super::gateway_integrity::verify(root)?;
                self.start(&root.join("node.exe"), &root.join("mcp-gateway.mjs"))?;
                let initialized = self.request(
                    "initialize",
                    json!({"protocolVersion":"2025-03-26","capabilities":{},
                        "clientInfo":{"name":"lazyprompting-desktop","version":env!("CARGO_PKG_VERSION")}}),
                    deadline,
                )?;
                if initialized["result"]["protocolVersion"] != "2025-03-26"
                    || initialized["result"]["serverInfo"]["name"] != "lazyprompting-gateway"
                {
                    return Err("MCP_HANDSHAKE_FAILED");
                }
                let input = self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
                write_message(
                    &mut input.as_ref().ok_or("MCP_WRITER_NOT_READY")?,
                    &json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
                )?;
            }
            let reply = self.request("tools/list", json!({}), deadline)?;
            let tools = reply["result"]["tools"]
                .as_array()
                .ok_or("MCP_TOOL_LIST_FAILED")?;
            if !tools.iter().any(|tool| tool["name"] == "invoke_capability") {
                return Err("MCP_TOOL_LIST_FAILED");
            }
            Ok(())
        })();
        if result.is_err() {
            let _ = self.stop();
        }
        result
    }

    // Trusted host caller only: path provenance and packaging must be checked before use.
    pub(crate) fn start(&self, node: &Path, script: &Path) -> Result<u32, &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_some() {
            return Err("GATEWAY_ALREADY_RUNNING");
        }
        // Reap a prior exited session and disconnect its reader before reuse.
        self.stop_inner()?;
        let pid = self.child.spawn(node, script)?;
        let setup = (|| {
            let (mut input, output) = self.child.take_stdio()?;
            #[cfg(windows)]
            {
                use super::native_ipc_frame::write_frame;
                use super::native_ipc_pipe::{hex, NativePipeListener};
                let mut session = [0; 16];
                let mut secret = [0; 32];
                getrandom::getrandom(&mut session).map_err(|_| "IPC_ENTROPY_UNAVAILABLE")?;
                getrandom::getrandom(&mut secret).map_err(|_| "IPC_ENTROPY_UNAVAILABLE")?;
                let name = format!(r"\\.\pipe\lazyprompting-{}", hex(&session));
                let pipe = tauri::async_runtime::block_on(async {
                    let mut pipe =
                        NativePipeListener::bind(&name).map_err(|_| "IPC_PIPE_BIND_FAILED")?;
                    write_frame(
                        &mut input,
                        &json!({"type":"bootstrap","pipe":name,
                        "session":hex(&session),"secret":hex(&secret)}),
                    )?;
                    pipe.authenticate(pid, session, secret).await?;
                    Ok::<_, &'static str>(pipe)
                });
                secret.fill(0);
                *self.pipe.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(pipe?);
            }
            let reader = GatewayReader::start(output)?;
            *self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(input);
            *self
                .reader
                .lock()
                .map_err(|_| "MCP_SESSION_LOCK_POISONED")? = Some(reader);
            Ok::<(), &'static str>(())
        })();
        if let Err(err) = setup {
            let _ = self.stop_inner();
            return Err(err);
        }
        Ok(pid)
    }

    // Strict single-flight request/response. Never use for unauthorized browser operations.
    pub(crate) fn request(
        &self,
        method: &str,
        params: Value,
        timeout: Duration,
    ) -> Result<Value, &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_none() {
            return Err("GATEWAY_NOT_RUNNING");
        }
        if !matches!(method, "initialize" | "ping" | "tools/list") {
            return Err("MCP_METHOD_NOT_ADMITTED");
        }
        let mut tracker = self
            .tracker
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        let id = tracker.begin_with_timeout(timeout)?;
        let result = (|| {
            let input_guard = self.input.lock().map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let mut input = input_guard.as_ref().ok_or("MCP_WRITER_NOT_READY")?;
            write_message(
                &mut input,
                &json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}),
            )?;
            drop(input_guard);
            let deadline = Instant::now()
                .checked_add(timeout)
                .ok_or("MCP_INVALID_TIMEOUT")?;
            let reader_guard = self
                .reader
                .lock()
                .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
            let reader = reader_guard.as_ref().ok_or("MCP_READER_NOT_READY")?;
            loop {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    return Err("MCP_REQUEST_TIMEOUT");
                }
                let message = reader.recv(remaining)?;
                if tracker.accept(&message)? {
                    return Ok(message);
                }
            }
        })();
        tracker.cancel();
        result
    }

    pub(crate) fn stop(&self) -> Result<(), &'static str> {
        let _guard = self
            .operation
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?;
        self.stop_inner()
    }

    fn stop_inner(&self) -> Result<(), &'static str> {
        #[cfg(windows)]
        self.pipe
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take();
        self.input
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take();
        // The child must be stopped before joining the potentially blocking stdout reader.
        self.child.stop()?;
        if let Some(reader) = self
            .reader
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .take()
        {
            reader.join_after_child_stop()?;
        }
        self.tracker
            .lock()
            .map_err(|_| "MCP_SESSION_LOCK_POISONED")?
            .cancel();
        Ok(())
    }
}
impl Drop for GatewaySession {
    fn drop(&mut self) {
        let _ = self.stop_inner();
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires staged Windows resources"]
    fn packaged_gateway_initializes_and_stops() {
        let root = std::env::var_os("LAZY_GATEWAY_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/gateway"));
        let root = root.canonicalize().unwrap();
        let gateway = GatewaySession::default();
        gateway.probe_packaged(&root).unwrap();
        let pid = gateway.child.pid().unwrap().unwrap();
        gateway.probe_packaged(&root).unwrap();
        assert_eq!(gateway.child.pid(), Ok(Some(pid)));
        gateway.stop().unwrap();
        assert_eq!(gateway.child.pid(), Ok(None));
    }
}
