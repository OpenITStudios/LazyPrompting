// Explicit anonymous-pipe ownership for a future suspended AppContainer
// worker. Only child stdin/read, stdout/write, stderr/write handles may be
// inherited through PROC_THREAD_ATTRIBUTE_HANDLE_LIST. All parent ends are
// made NONINHERITABLE and held only by the native process owner.
//
// This is NOT a model transport, execution grant, trusted provider receipt
// or a subprocess launcher. The parent must drain stdout AND stderr with
// independent bounded readers before permitting ResumeThread. No public MCP
// or renderer route can obtain these handles.
use std::{
    fs::File,
    os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
    ptr::null_mut,
};
use windows_sys::Win32::Foundation::{
    HANDLE, HANDLE_FLAG_INHERIT, SetHandleInformation,
};
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::System::Pipes::CreatePipe;

const PIPE_CAPACITY: u32 = 8192;

fn pipe_pair() -> Result<(OwnedHandle, OwnedHandle), &'static str> {
    let mut attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: null_mut(),
        bInheritHandle: 1,
    };
    let mut read: HANDLE = null_mut();
    let mut write: HANDLE = null_mut();
    // SAFETY: Windows writes two kernel handles; on failure no handle pair is
    // accepted. Callers wrap them in unique OwnedHandle owners immediately.
    if unsafe { CreatePipe(&mut read, &mut write, &mut attributes, PIPE_CAPACITY) } == 0
        || read.is_null() || write.is_null()
    {
        return Err("AGENT_STDIO_PIPE_CREATE_FAILED");
    }
    Ok((
        unsafe { OwnedHandle::from_raw_handle(read) },
        unsafe { OwnedHandle::from_raw_handle(write) },
    ))
}

fn noninheritable(handle: &OwnedHandle) -> Result<(), &'static str> {
    if unsafe {
        SetHandleInformation(handle.as_raw_handle(), HANDLE_FLAG_INHERIT, 0)
    } == 0 {
        return Err("AGENT_STDIO_PARENT_HANDLE_INHERITABLE");
    }
    Ok(())
}

// Three parent endpoints remain native-only. The host must write a bounded
// approved input exactly once then close stdin; concurrent stdout/stderr
// drainers must terminate the native job on timeout/overflow.
pub(crate) struct NativeParentStdio {
    pub(crate) stdin: File,
    pub(crate) stdout: File,
    pub(crate) stderr: File,
}

pub(crate) struct WorkerStdioPipes {
    child_stdin: Option<OwnedHandle>,    // READ
    parent_stdin: Option<OwnedHandle>,   // WRITE
    child_stdout: Option<OwnedHandle>,   // WRITE
    parent_stdout: Option<OwnedHandle>,  // READ
    child_stderr: Option<OwnedHandle>,   // WRITE
    parent_stderr: Option<OwnedHandle>,  // READ
}

impl WorkerStdioPipes {
    pub(crate) fn create() -> Result<Self, &'static str> {
        let (child_stdin, parent_stdin) = pipe_pair()?;
        let (parent_stdout, child_stdout) = pipe_pair()?;
        let (parent_stderr, child_stderr) = pipe_pair()?;
        noninheritable(&parent_stdin)?;
        noninheritable(&parent_stdout)?;
        noninheritable(&parent_stderr)?;
        Ok(Self {
            child_stdin: Some(child_stdin), parent_stdin: Some(parent_stdin),
            child_stdout: Some(child_stdout), parent_stdout: Some(parent_stdout),
            child_stderr: Some(child_stderr), parent_stderr: Some(parent_stderr),
        })
    }

    pub(crate) fn child_handles(&self) -> Result<[HANDLE; 3], &'static str> {
        Ok([
            self.child_stdin.as_ref().ok_or("AGENT_STDIO_CHILD_HANDLE_CLOSED")?
                .as_raw_handle(),
            self.child_stdout.as_ref().ok_or("AGENT_STDIO_CHILD_HANDLE_CLOSED")?
                .as_raw_handle(),
            self.child_stderr.as_ref().ok_or("AGENT_STDIO_CHILD_HANDLE_CLOSED")?
                .as_raw_handle(),
        ])
    }

    // After CreateProcessW, close child-only pipe ends in the parent so EOF
    // is observable when the child closes stdout/stderr. This doesn't close
    // the handles inherited by the new process.
    pub(crate) fn retire_child_ends(&mut self) {
        self.child_stdin.take();
        self.child_stdout.take();
        self.child_stderr.take();
    }

    pub(crate) fn take_parent(&mut self)
        -> Result<NativeParentStdio, &'static str>
    {
        // This transfer is one-shot. It must happen under the same native
        // run owner that controls STOP and the Job Object deadline.
        if self.parent_stdin.is_none() ||
            self.parent_stdout.is_none() || self.parent_stderr.is_none() {
            return Err("AGENT_STDIO_ALREADY_TAKEN");
        }
        Ok(NativeParentStdio {
            stdin: File::from(self.parent_stdin.take().unwrap()),
            stdout: File::from(self.parent_stdout.take().unwrap()),
            stderr: File::from(self.parent_stderr.take().unwrap()),
        })
    }
}
