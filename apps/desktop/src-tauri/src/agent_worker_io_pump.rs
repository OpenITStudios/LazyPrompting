// Native-owned, bounded parallel STDOUT/STDERR pump for a future Windows
// AppContainer worker. No process is resumed by this module. Output remains
// untrusted until a separate host/provider session reconciliation succeeds.
//
// This module consumes exactly the handles returned from
// SuspendedAppContainerChild -> WorkerJobLease, not user-controlled filenames,
// model messages, MCP sockets or an arbitrary local process. All chunks are
// bounded in memory. The native job owner MUST retire the Job Object on any
// fault or deadline; do not retry an uncertain dispatch or block the UI.
use crate::agent_worker_io::{
    OpenCodeIoCapture, WorkerIoCandidate, WorkerIoIdentity,
};
use crate::agent_worker_stdio::NativeParentStdio;
use std::{
    fs::File,
    io::Read,
    sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender},
    thread::{self, JoinHandle},
    time::Duration,
};

const MAX_CHUNK: usize = 8 * 1024;
const MAX_QUEUED_CHUNKS: usize = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stream { Stdout, Stderr }
enum Chunk {
    Data(Stream, Vec<u8>),
    Eof(Stream),
    Failed(Stream),
}
fn reader(
    source: Stream,
    mut file: File,
    sender: SyncSender<Chunk>,
) {
    let mut buffer = [0u8; MAX_CHUNK];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => {
                let _ = sender.send(Chunk::Eof(source));
                return;
            }
            Ok(n) => {
                // Strict bounded backpressure. A stalled receiver cannot
                // create an unbounded transcript in the native host.
                if sender.send(Chunk::Data(source, buffer[..n].to_vec())).is_err() {
                    return;
                }
            }
            Err(_) => {
                let _ = sender.send(Chunk::Failed(source));
                return;
            }
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum IoPumpPoll {
    Progress,
    Idle,
    BothStreamsClosed,
}

pub(crate) struct WorkerIoPump {
    receiver: Receiver<Chunk>,
    capture: Option<OpenCodeIoCapture>,
    reader_threads: Vec<JoinHandle<()>>,
    stdout_eof: bool,
    stderr_eof: bool,
    failed: bool,
}

impl WorkerIoPump {
    // Called by the trusted Job Object owner before ANY worker thread is
    // resumed. Consumes the one-shot parent handles and closes child stdin.
    // This source supports only the known OpenCode JSONL format; Codex
    // App Server uses a different verified session protocol and adapter.
    pub(crate) fn start(
        handles: NativeParentStdio, identity: WorkerIoIdentity,
    ) -> Result<Self, &'static str> {
        let capture = OpenCodeIoCapture::new(identity)?;
        let NativeParentStdio { stdin, stdout, stderr } = handles;
        drop(stdin); // no interactive/shell/tool stdin authority
        let (tx, rx) = sync_channel(MAX_QUEUED_CHUNKS);
        let a = thread::Builder::new()
            .name("agent-opencode-stdout".to_owned())
            .spawn({
                let sender = tx.clone();
                move || reader(Stream::Stdout, stdout, sender)
            })
            .map_err(|_| "AGENT_IO_STDOUT_READER_FAILED")?;
        let b = match thread::Builder::new()
            .name("agent-opencode-stderr".to_owned())
            .spawn(move || reader(Stream::Stderr, stderr, tx))
        {
            Ok(handle) => handle,
            Err(_) => {
                // Dropping rx disconnects the first worker's bounded channel.
                drop(rx);
                drop(a); // detached reader exits after its next send/EOF
                return Err("AGENT_IO_STDERR_READER_FAILED");
            }
        };
        Ok(Self {
            receiver: rx, capture: Some(capture),
            reader_threads: vec![a,b],
            stdout_eof: false, stderr_eof: false,
            failed: false,
        })
    }

    // Poll in an off-UI native worker. A 250 ms maximum prevents callers
    // from accidentally starving STOP/deadline checks. On error the caller
    // MUST terminate the owned job and retain existing PromptOutbox holds.
    pub(crate) fn poll(&mut self, wait: Duration)
        -> Result<IoPumpPoll, &'static str>
    {
        if self.failed { return Err("AGENT_IO_RECONCILE_REQUIRED"); }
        if self.stdout_eof && self.stderr_eof {
            return Ok(IoPumpPoll::BothStreamsClosed);
        }
        if wait.is_zero() || wait > Duration::from_millis(250) {
            return Err("AGENT_IO_INVALID_POLL_WAIT");
        }
        let next = match self.receiver.recv_timeout(wait) {
            Ok(value) => value,
            Err(RecvTimeoutError::Timeout) => return Ok(IoPumpPoll::Idle),
            Err(RecvTimeoutError::Disconnected) => {
                self.failed = true;
                return Err("AGENT_IO_PIPE_DISCONNECTED");
            }
        };
        let capture = self.capture.as_mut()
            .ok_or("AGENT_IO_ALREADY_FINALIZED")?;
        let result = match next {
            Chunk::Data(Stream::Stdout, data) if !self.stdout_eof =>
                capture.stdout(&data),
            Chunk::Data(Stream::Stderr, data) if !self.stderr_eof =>
                capture.stderr(&data),
            Chunk::Eof(Stream::Stdout) if !self.stdout_eof => {
                self.stdout_eof = true; Ok(())
            }
            Chunk::Eof(Stream::Stderr) if !self.stderr_eof => {
                self.stderr_eof = true; Ok(())
            }
            Chunk::Failed(_) => Err("AGENT_IO_PIPE_READ_FAILED"),
            _ => Err("AGENT_IO_STREAM_ORDER_INVALID"),
        };
        if let Err(error) = result {
            self.failed = true;
            return Err(error);
        }
        if self.stdout_eof && self.stderr_eof {
            Ok(IoPumpPoll::BothStreamsClosed)
        } else {
            Ok(IoPumpPoll::Progress)
        }
    }

    // Only after both native handles report EOF and the host independently
    // checks the exact OS child PID/exit code. A clean stream produces just
    // TERMINAL_CANDIDATE, NEVER a durable QA or provider receipt.
    pub(crate) fn finalize(mut self, exit_code: Option<i32>)
        -> Result<WorkerIoCandidate, &'static str>
    {
        if self.failed || !self.stdout_eof || !self.stderr_eof {
            return Err("AGENT_IO_INCOMPLETE_RECONCILIATION_REQUIRED");
        }
        // EOF guarantees read threads exited; join cannot hang on a live pipe.
        for thread in self.reader_threads.drain(..) {
            thread.join().map_err(|_| "AGENT_IO_READER_PANIC")?;
        }
        let capture = self.capture.take()
            .ok_or("AGENT_IO_ALREADY_FINALIZED")?;
        Ok(capture.finish(exit_code))
    }
}
