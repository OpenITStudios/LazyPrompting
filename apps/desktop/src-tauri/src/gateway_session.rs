// Native-owned MCP gateway session. Not a renderer command and not browser authorization.
// All blocking methods must run off the Tauri UI thread.
use std::path::Path;
use std::process::ChildStdin;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde_json::{json, Value};
use super::gateway_child::GatewayChild;
use super::gateway_reader::GatewayReader;
use super::gateway_stdio::{write_message, RequestTracker};

#[derive(Default)]
pub(crate) struct GatewaySession {
    child: GatewayChild,
    input: Mutex<Option<ChildStdin>>,
    reader: Mutex<Option<GatewayReader>>,
    tracker: Mutex<RequestTracker>,
    operation: Mutex<()>,
}

impl GatewaySession {
    // Trusted host caller only: path provenance and packaging must be checked before use.
    pub(crate) fn start(&self, node: &Path, script: &Path) -> Result<u32, &'static str> {
        let _guard=self.operation.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_some() {return Err("GATEWAY_ALREADY_RUNNING");}
        // Reap a prior exited session and disconnect its reader before reuse.
        self.stop_inner()?;
        let pid=self.child.spawn(node,script)?;
        let setup=(||{
            let (input,output)=self.child.take_stdio()?;
            let reader=GatewayReader::start(output)?;
            *self.input.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?=Some(input);
            *self.reader.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?=Some(reader);
            Ok::<(),&'static str>(())
        })();
        if let Err(err)=setup {
            let _=self.stop_inner();
            return Err(err);
        }
        Ok(pid)
    }

    // Strict single-flight request/response. Never use for unauthorized browser operations.
    pub(crate) fn request(&self,method:&str,params:Value,timeout:Duration)->Result<Value,&'static str> {
        let _guard=self.operation.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
        if self.child.pid()?.is_none() {return Err("GATEWAY_NOT_RUNNING");}
        if !matches!(method,"initialize"|"ping"|"tools/list") {
            return Err("MCP_METHOD_NOT_ADMITTED");
        }
        let mut tracker=self.tracker.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
        let id=tracker.begin_with_timeout(timeout)?;
        let result=(||{
            let input_guard=self.input.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
            let mut input=input_guard.as_ref().ok_or("MCP_WRITER_NOT_READY")?;
            write_message(&mut input,&json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))?;
            drop(input_guard);
            let deadline=Instant::now().checked_add(timeout).ok_or("MCP_INVALID_TIMEOUT")?;
            let reader_guard=self.reader.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
            let reader=reader_guard.as_ref().ok_or("MCP_READER_NOT_READY")?;
            loop {
                let remaining=deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {return Err("MCP_REQUEST_TIMEOUT");}
                let message=reader.recv(remaining)?;
                if tracker.accept(&message)? {return Ok(message);}
            }
        })();
        tracker.cancel();
        result
    }

    pub(crate) fn stop(&self)->Result<(),&'static str> {
        let _guard=self.operation.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?;
        self.stop_inner()
    }

    fn stop_inner(&self)->Result<(),&'static str> {
        self.input.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?.take();
        // The child must be stopped before joining the potentially blocking stdout reader.
        self.child.stop()?;
        if let Some(reader)=self.reader.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?.take() {
            reader.join_after_child_stop()?;
        }
        self.tracker.lock().map_err(|_|"MCP_SESSION_LOCK_POISONED")?.cancel();
        Ok(())
    }
}
impl Drop for GatewaySession {
    fn drop(&mut self) {
        let _=self.stop_inner();
    }
}
