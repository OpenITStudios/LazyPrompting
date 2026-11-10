// Dedicated bounded MCP stdout reader. Not an authorization channel.
// The owner must stop/reap the child to unblock a stalled pipe before joining this worker.
use serde_json::Value;
use std::io::{BufReader, Read};
use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use super::gateway_stdio::read_message;

const QUEUE_CAPACITY: usize = 16;
pub(crate) struct GatewayReader {
    rx: Receiver<Result<Value, &'static str>>,
    worker: Option<JoinHandle<()>>,
}
impl GatewayReader {
    pub(crate) fn start<R: Read + Send + 'static>(output:R) -> Result<Self,&'static str> {
        let (tx,rx)=sync_channel(QUEUE_CAPACITY);
        let worker=thread::Builder::new().name("mcp-stdout-reader".into()).spawn(move||{
            let mut reader=BufReader::new(output);
            loop {
                let item=read_message(&mut reader);
                let terminal=item.is_err();
                if tx.send(item).is_err() || terminal {break;}
            }
        }).map_err(|_|"MCP_READER_START_FAILED")?;
        Ok(Self{rx,worker:Some(worker)})
    }
    // Timeout applies to waiting for a parsed message, not to OS pipe cancellation.
    pub(crate) fn recv(&self,timeout:Duration)->Result<Value,&'static str> {
        if timeout.is_zero() || timeout>Duration::from_secs(30) {return Err("MCP_INVALID_TIMEOUT");}
        match self.rx.recv_timeout(timeout) {
            Ok(value)=>value,
            Err(RecvTimeoutError::Timeout)=>Err("MCP_READ_TIMEOUT"),
            Err(RecvTimeoutError::Disconnected)=>Err("MCP_READER_STOPPED"),
        }
    }
    // Call only after child process shutdown closes stdout; joining a live blocked pipe can hang.
    pub(crate) fn join_after_child_stop(self)->Result<(),&'static str> {
        let Self {rx,mut worker}=self;
        // Disconnect the bounded channel before join: a full queue must not
        // leave the producer blocked in send after the child has exited.
        drop(rx);
        worker.take().ok_or("MCP_READER_STOPPED")?
            .join().map_err(|_|"MCP_READER_PANICKED")
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    #[test]
    fn reads_message_and_reaches_eof() {
        let source=Cursor::new(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n".to_vec());
        let reader=GatewayReader::start(source).unwrap();
        assert_eq!(reader.recv(Duration::from_secs(1)).unwrap()["id"],1);
        assert!(matches!(reader.recv(Duration::from_secs(1)),Err("MCP_EOF")));
        reader.join_after_child_stop().unwrap();
    }
    #[test]
    fn shutdown_does_not_deadlock_when_queue_is_full() {
        let frame=b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n";
        let mut source=Vec::new();
        for _ in 0..(QUEUE_CAPACITY+32) {source.extend_from_slice(frame);}
        let reader=GatewayReader::start(Cursor::new(source)).unwrap();
        reader.join_after_child_stop().unwrap();
    }
    #[test]
    fn rejects_invalid_wait_duration() {
        let reader=GatewayReader::start(Cursor::new(Vec::<u8>::new())).unwrap();
        assert!(matches!(reader.recv(Duration::ZERO),Err("MCP_INVALID_TIMEOUT")));
        reader.join_after_child_stop().unwrap();
    }
}
