// Windows AppContainer suspended-process preparation. This file is NOT on any
// public MCP, native goal-run or worker-dispatch route. No process is resumed.
//
// The safe ordering for a future worker is:
// 1. Resolve only host-approved executable and cwd, and check its SHA-256.
// 2. Create a fresh zero-capability AppContainer profile.
// 3. CreateProcessW(CREATE_SUSPENDED, SECURITY_CAPABILITIES,
//    inherited child stdin/stdout/stderr ONLY via HANDLE_LIST,
//    scrubbed environment, exact executable path).
// 4. Independently query the child's TokenIsAppContainer.
// 5. Attach it to the bounded, kill-on-close native Job Object.
// 6. Only AFTER verified read-only ACL grants, output capture, model broker,
//    host dispatch consent and STOP binding may the initial thread resume.
//
// This milestone implements steps 1–4 only and retains process/profile
// ownership. The code that would resume a child is deliberately absent.
use std::{
    ffi::OsStr,
    os::windows::{
        ffi::OsStrExt,
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
    },
    path::Path,
    ptr::{null, null_mut},
};
use windows_sys::Win32::Security::{
    GetTokenInformation, SECURITY_CAPABILITIES, TokenIsAppContainer, TOKEN_QUERY,
};
use windows_sys::Win32::System::Threading::{
    CreateProcessW, DeleteProcThreadAttributeList,
    InitializeProcThreadAttributeList, OpenProcessToken, TerminateProcess,
    UpdateProcThreadAttribute, WaitForSingleObject, CREATE_NO_WINDOW,
    CREATE_SUSPENDED, CREATE_UNICODE_ENVIRONMENT,
    EXTENDED_STARTUPINFO_PRESENT, LPPROC_THREAD_ATTRIBUTE_LIST,
    PROCESS_INFORMATION, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
    PROC_THREAD_ATTRIBUTE_HANDLE_LIST, STARTF_USESTDHANDLES,
    STARTUPINFOEXW,
};
use windows_sys::Win32::Foundation::WAIT_OBJECT_0;
use crate::agent_worker_appcontainer::WorkerAppContainer;
use crate::agent_worker_stdio::{NativeParentStdio, WorkerStdioPipes};
use windows_sys::Win32::Foundation::HANDLE;
use crate::agent_worker_profiles::{
    revalidate_approved_worker, ApprovedWorkerIdentity,
};

// The caller must keep a sized, pointer-aligned attribute-list allocation
// alive until CreateProcessW completes; Windows stores live pointers in it.
struct AttributeList {
    storage: Vec<usize>,
    pointer: LPPROC_THREAD_ATTRIBUTE_LIST,
    // UpdateProcThreadAttribute retains a pointer to this value until
    // CreateProcessW completes. It MUST outlive this attribute list.
    security: Box<SECURITY_CAPABILITIES>,
    // Stable array of precisely the three allowed inherited STDIO handles.
    // The attribute list retains this pointer through CreateProcessW.
    stdio_handles: Box<[HANDLE; 3]>,
}

impl AttributeList {
    fn for_appcontainer(
        profile: &WorkerAppContainer, handles: [HANDLE; 3]
    ) -> Result<Self, &'static str>
    {
        let mut required = 0usize;
        // First call supplies the required buffer size, not a valid list.
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), 2, 0, &mut required);
        }
        if required == 0 || required > 64 * 1024 {
            return Err("AGENT_SECURITY_ATTRIBUTES_SIZE_INVALID");
        }
        let words = required.div_ceil(std::mem::size_of::<usize>());
        let mut storage = vec![0usize; words];
        let pointer = storage.as_mut_ptr().cast();
        if unsafe {
            InitializeProcThreadAttributeList(pointer, 2, 0, &mut required)
        } == 0 {
            return Err("AGENT_SECURITY_ATTRIBUTES_INIT_FAILED");
        }
        let mut attributes = Self {
            storage, pointer,
            security: Box::new(SECURITY_CAPABILITIES {
                AppContainerSid: profile.sid(),
                Capabilities: null_mut(),
                CapabilityCount: 0,
                Reserved: 0,
            }),
            stdio_handles: Box::new(handles),
        };
        if unsafe {
            UpdateProcThreadAttribute(
                attributes.pointer, 0,
                PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES as usize,
                (&mut *attributes.security as *mut SECURITY_CAPABILITIES).cast(),
                std::mem::size_of::<SECURITY_CAPABILITIES>(),
                null_mut(), null(),
            )
        } == 0 {
            return Err("AGENT_APPCONTAINER_ATTRIBUTES_FAILED");
        }
        if unsafe {
            UpdateProcThreadAttribute(
                attributes.pointer, 0,
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                attributes.stdio_handles.as_mut_ptr().cast(),
                std::mem::size_of::<[HANDLE; 3]>(),
                null_mut(), null(),
            )
        } == 0 {
            return Err("AGENT_STDIO_INHERITANCE_LIST_FAILED");
        }
        Ok(attributes)
    }
}

impl Drop for AttributeList {
    fn drop(&mut self) {
        unsafe { DeleteProcThreadAttributeList(self.pointer); }
    }
}

fn wide(source: &OsStr) -> Vec<u16> {
    source.encode_wide().chain(std::iter::once(0)).collect()
}

// This function invokes the image directly, never through cmd.exe, PowerShell,
// a batch file or a search PATH lookup. It quotes each argument following
// Windows CRT rules and rejects NUL/control input.
fn quote_arg(text: &str) -> Result<String, &'static str> {
    if text.is_empty() || text.len() > 2048 ||
       text.chars().any(|ch| ch == '\0' || ch.is_control()) {
        return Err("AGENT_CHILD_ARG_INVALID");
    }
    // Windows CRT command line quoting: backslashes before quote are
    // doubled, and trailing backslashes are doubled before closing quote.
    // lpApplicationName is always the verified absolute executable path.
    let mut result = String::from("\"");
    let mut slashes = 0usize;
    for ch in text.chars() {
        if ch == '\\' {
            slashes += 1;
        } else {
            if ch == '"' {
                result.push_str(&"\\".repeat(slashes * 2 + 1));
                result.push('"');
            } else {
                result.push_str(&"\\".repeat(slashes));
                result.push(ch);
            }
            slashes = 0;
        }
    }
    result.push_str(&"\\".repeat(slashes * 2));
    result.push('"');
    Ok(result)
}

fn scrubbed_environment() -> Result<Vec<u16>, &'static str> {
    let root = std::env::var_os("SystemRoot")
        .ok_or("AGENT_SYSTEMROOT_REQUIRED")?;
    if !Path::new(&root).is_absolute() || root.encode_wide().any(|ch| ch == 0) {
        return Err("AGENT_SYSTEMROOT_INVALID");
    }
    // Explicit UTF-16 environment block. No inherited CODEX_HOME,
    // USERPROFILE, APPDATA, token, custom MCP, PATH or secret variables.
    let mut env = wide(OsStr::new(&format!(
        "SystemRoot={}", root.to_string_lossy()
    )));
    env.push(0); // second terminal UTF-16 NUL for the Win32 block
    Ok(env)
}

// A unique, restricted, suspended process created by the host. The process
// and its initial thread are held open; only the three explicit child
// standard stream handles can be inherited, never arbitrary host handles.
// It MUST be moved under the Job Object before a future resume.
pub(crate) struct SuspendedAppContainerChild {
    process: OwnedHandle,
    thread: OwnedHandle,
    profile: Option<WorkerAppContainer>,
    stdio: Option<WorkerStdioPipes>,
    process_id: u32,
}

impl SuspendedAppContainerChild {
    pub(crate) fn create(
        worker: &ApprovedWorkerIdentity,
        cwd: &Path,
        arguments: &[&str],
    ) -> Result<Self, &'static str> {
        revalidate_approved_worker(worker)
            .map_err(|_| "AGENT_WORKER_IDENTITY_CHANGED")?;
        let directory = dunce::canonicalize(cwd)
            .map_err(|_| "AGENT_APPROVED_CWD_INVALID")?;
        if !directory.is_dir() || !directory.is_absolute() ||
            arguments.len() > 16 {
            return Err("AGENT_CHILD_LAUNCH_SCOPE_INVALID");
        }
        let executable = worker.executable.to_str()
            .ok_or("AGENT_EXECUTABLE_ENCODING_UNSUPPORTED")?;
        let mut parts = vec![quote_arg(executable)?];
        for arg in arguments {
            parts.push(quote_arg(arg)?);
        }
        let line = parts.join(" ");
        if line.len() > 12_000 {
            return Err("AGENT_CHILD_COMMAND_TOO_LARGE");
        }
        let application = wide(worker.executable.as_os_str());
        let mut cmd = wide(OsStr::new(&line));
        let wcwd = wide(directory.as_os_str());
        let environment = scrubbed_environment()?;
        let profile = WorkerAppContainer::create_fresh()?;
        let mut pipes = WorkerStdioPipes::create()?;
        let inherited = pipes.child_handles()?;
        let attributes = AttributeList::for_appcontainer(&profile, inherited)?;
        let mut startup = STARTUPINFOEXW::default();
        startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = inherited[0];
        startup.StartupInfo.hStdOutput = inherited[1];
        startup.StartupInfo.hStdError = inherited[2];
        startup.lpAttributeList = attributes.pointer;
        let mut info = PROCESS_INFORMATION::default();
        // SAFETY: all in/out buffers live through CreateProcessW, and the
        // extended startup attribute references the unique AppContainer SID.
        // The main thread is suspended before the new binary executes.
        let created = unsafe {
            CreateProcessW(
                application.as_ptr(), cmd.as_mut_ptr(),
                null(), null(), 1, // TRUE with exact HANDLE_LIST only
                CREATE_SUSPENDED | CREATE_NO_WINDOW |
                    CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
                environment.as_ptr().cast(), wcwd.as_ptr(),
                &startup.StartupInfo, &mut info,
            )
        };
        if created == 0 || info.hProcess.is_null() || info.hThread.is_null() {
            return Err("AGENT_APPCONTAINER_SPAWN_FAILED");
        }
        pipes.retire_child_ends();
        let child = Self {
            process: unsafe { OwnedHandle::from_raw_handle(info.hProcess) },
            thread: unsafe { OwnedHandle::from_raw_handle(info.hThread) },
            profile: Some(profile), stdio: Some(pipes),
            process_id: info.dwProcessId,
        };
        // Do not infer sandboxing from a successful CreateProcessW call alone.
        // Query the actual process token before ever handing it to a Job.
        if !child.verify_appcontainer_token() {
            return Err("AGENT_CHILD_APPCONTAINER_TOKEN_UNVERIFIED");
        }
        Ok(child)
    }

    fn verify_appcontainer_token(&self) -> bool {
        let mut raw = null_mut();
        if unsafe {
            OpenProcessToken(self.process.as_raw_handle(), TOKEN_QUERY, &mut raw)
        } == 0 || raw.is_null() {
            return false;
        }
        let token = unsafe { OwnedHandle::from_raw_handle(raw) };
        let mut appcontainer = 0u32;
        let mut returned = 0u32;
        unsafe {
            GetTokenInformation(
                token.as_raw_handle(), TokenIsAppContainer,
                (&mut appcontainer as *mut u32).cast(),
                std::mem::size_of::<u32>() as u32, &mut returned,
            )
        } != 0 && appcontainer == 1 && returned as usize >=
            std::mem::size_of::<u32>()
    }

    pub(crate) fn process_id(&self) -> u32 { self.process_id }
    pub(crate) fn process_handle(&self) -> &OwnedHandle { &self.process }
    pub(crate) fn appcontainer(&self) -> Result<&WorkerAppContainer, &'static str> {
        self.profile.as_ref().ok_or("AGENT_APPCONTAINER_OWNER_LOST")
    }

    // A one-time transfer to the native I/O owner after Job Object
    // containment. Not an MCP response or a provider receipt.
    pub(crate) fn take_parent_stdio(&mut self)
        -> Result<NativeParentStdio, &'static str>
    {
        self.stdio.as_mut().ok_or("AGENT_STDIO_NOT_CONFIGURED")?
            .take_parent()
    }
}

impl Drop for SuspendedAppContainerChild {
    fn drop(&mut self) {
        // Even a never-resumed child is a real kernel process. Always terminate
        // and reap it before the owned AppContainer profile is deleted.
        let result = unsafe {
            let _ = TerminateProcess(self.process.as_raw_handle(), 1);
            WaitForSingleObject(self.process.as_raw_handle(), 5_000)
        };
        if result != WAIT_OBJECT_0 {
            // Keep the unique profile/SID rather than deleting it while a
            // process might still be using its security identity. A later,
            // native owner-validated orphan-reaper must handle this rare case.
            if let Some(profile) = self.profile.take() {
                std::mem::forget(profile);
            }
            eprintln!("Agent sandbox process exit unconfirmed; profile preserved for recovery");
        }
        // OwnedHandle closes process/thread handles; after a confirmed exit
        // the remaining profile Option is dropped and the registration removed.
    }
}

