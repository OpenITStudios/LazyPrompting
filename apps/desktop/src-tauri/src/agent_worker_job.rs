// Native Windows worker *process-tree containment*, not a filesystem or
// network sandbox. AppContainer/LPAC (or equivalent OS isolation) must be
// verified by the trusted host BEFORE a suspended child can be attached,
// resumed or admitted as a v2 worker. Never expose this owner through MCP.
//
// A Job Object without AppContainer would still allow same-user file/secret
// reads; no code here is permitted to create a worker under an ordinary token.
use std::{
    collections::HashMap,
    os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
    ptr::null,
    sync::Mutex,
    time::{Duration, Instant},
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_ACTIVE_PROCESS, JOB_OBJECT_LIMIT_JOB_MEMORY,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOB_OBJECT_LIMIT_PROCESS_MEMORY,
};
use windows_sys::Win32::System::Threading::TerminateJobObject;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct WorkerJobBudget {
    pub(crate) max_processes: u32,
    pub(crate) total_memory_mib: u32,
    pub(crate) process_memory_mib: u32,
    pub(crate) wall_minutes: u32,
}

impl WorkerJobBudget {
    pub(crate) fn bounded(
        max_processes: u32,
        total_memory_mib: u32,
        process_memory_mib: u32,
        wall_minutes: u32,
    ) -> Result<Self, &'static str> {
        if !(1..=4).contains(&max_processes)
            || !(256..=2048).contains(&total_memory_mib)
            || !(128..=total_memory_mib).contains(&process_memory_mib)
            || !(1..=30).contains(&wall_minutes)
        {
            return Err("AGENT_JOB_BUDGET_INVALID");
        }
        Ok(Self {
            max_processes,
            total_memory_mib,
            process_memory_mib,
            wall_minutes,
        })
    }
}

pub(crate) struct WorkerJobLease {
    job: OwnedHandle,
    deadline: Instant,
    attached: bool,
}

impl WorkerJobLease {
    // Private native source only. Creating an empty Job Object never runs a
    // subprocess or establishes read-only filesystem/network isolation.
    pub(crate) fn create(budget: WorkerJobBudget) -> Result<Self, &'static str> {
        let budget = WorkerJobBudget::bounded(
            budget.max_processes, budget.total_memory_mib,
            budget.process_memory_mib, budget.wall_minutes
        )?;
        let raw = unsafe { CreateJobObjectW(null(), null()) };
        if raw.is_null() {
            return Err("AGENT_JOB_CREATE_FAILED");
        }
        let job = unsafe { OwnedHandle::from_raw_handle(raw) };
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        // Deliberately omit both breakaway flags. The job owns the process
        // tree, enforces memory/count limits and kills on final handle close.
        limits.BasicLimitInformation.LimitFlags =
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
            JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
            JOB_OBJECT_LIMIT_JOB_MEMORY |
            JOB_OBJECT_LIMIT_PROCESS_MEMORY;
        limits.BasicLimitInformation.ActiveProcessLimit = budget.max_processes;
        limits.JobMemoryLimit = budget.total_memory_mib as usize * 1024 * 1024;
        limits.ProcessMemoryLimit = budget.process_memory_mib as usize * 1024 * 1024;
        if unsafe {
            SetInformationJobObject(
                job.as_raw_handle(), JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&limits) as u32,
            )
        } == 0 {
            return Err("AGENT_JOB_LIMITS_NOT_ENFORCED");
        }
        let deadline = Instant::now()
            .checked_add(Duration::from_secs(u64::from(budget.wall_minutes) * 60))
            .ok_or("AGENT_JOB_DEADLINE_INVALID")?;
        Ok(Self { job, deadline, attached: false })
    }

    // May be called ONLY by a future AppContainer/LPAC launcher after Windows
    // has created a child with CREATE_SUSPENDED and confirmed its restricted
    // security token. This function DOES NOT resume it. Keeping this step
    // separate ensures job assignment cannot race the first worker instruction.
    pub(crate) fn attach_suspended(
        &mut self, suspended_process: &OwnedHandle
    ) -> Result<(), &'static str> {
        if self.attached || Instant::now() >= self.deadline {
            return Err("AGENT_JOB_ATTACH_NOT_ADMITTED");
        }
        if unsafe {
            AssignProcessToJobObject(self.job.as_raw_handle(),
                suspended_process.as_raw_handle())
        } == 0 {
            return Err("AGENT_JOB_ASSIGN_FAILED");
        }
        self.attached = true;
        Ok(())
    }

    pub(crate) fn expired(&self) -> bool {
        Instant::now() >= self.deadline
    }

    // STOP is a tree-wide action. Job close is still the final kill fallback
    // if explicit termination fails or the host process dies.
    pub(crate) fn terminate(&self) -> Result<(), &'static str> {
        if unsafe { TerminateJobObject(self.job.as_raw_handle(), 1) } == 0 {
            return Err("AGENT_JOB_TERMINATE_UNCONFIRMED");
        }
        Ok(())
    }
}

// The Tauri host is the *single owner* of live worker containment handles.
// This map is not a checkpoint or the source of truth for dispatch receipts.
// On process crash/exit all owned Job Object handles close and kill children.
#[derive(Default)]
pub(crate) struct NativeWorkerJobs {
    jobs: Mutex<HashMap<String, WorkerJobLease>>,
}

impl NativeWorkerJobs {
    // Future sandbox launcher calls this only after verifying an OS sandbox
    // and BEFORE resuming its suspended process. No model/API entrypoint exists.
    pub(crate) fn register(
        &self, run_id: &str, job: WorkerJobLease,
    ) -> Result<(), &'static str> {
        if !valid_run_id(run_id) || !job.attached || job.expired() {
            return Err("AGENT_JOB_NOT_ADMITTED");
        }
        let mut jobs = self.jobs.lock()
            .map_err(|_| "AGENT_JOB_LOCK_FAILED")?;
        if jobs.contains_key(run_id) {
            return Err("AGENT_JOB_DUPLICATE_RUN");
        }
        if jobs.len() >= 2 {
            return Err("AGENT_JOB_CAPACITY_REACHED");
        }
        jobs.insert(run_id.to_owned(), job);
        Ok(())
    }

    // Once the native STOP marker is published, the host retires the owned
    // job. Dropping the handle kills its entire process tree even if a remote
    // provider has stopped responding.
    pub(crate) fn stop(&self, run_id: &str) -> Result<bool, &'static str> {
        if !valid_run_id(run_id) {
            return Err("INVALID_AGENT_RUN_ID");
        }
        let job = self.jobs.lock()
            .map_err(|_| "AGENT_JOB_LOCK_FAILED")?.remove(run_id);
        if let Some(job) = job {
            let terminated = job.terminate();
            drop(job);
            terminated?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    // No executable path, command line, output or token is exposed to UI.
    pub(crate) fn active(&self, run_id: &str) -> Result<bool, &'static str> {
        if !valid_run_id(run_id) {
            return Err("INVALID_AGENT_RUN_ID");
        }
        Ok(self.jobs.lock().map_err(|_| "AGENT_JOB_LOCK_FAILED")?
            .get(run_id).is_some_and(|job| !job.expired()))
    }

    pub(crate) fn stop_all(&self) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.clear(); // kill-on-close, even if a child ignores cancellation
        }
    }
}

fn valid_run_id(run_id: &str) -> bool {
    let Some((uuid, nonce)) = run_id.split_once('.') else { return false };
    uuid.len() == 36 && nonce.len() == 32
        && uuid.bytes().enumerate().all(|(i, b)| {
            if matches!(i, 8 | 13 | 18 | 23) { b == b'-' }
            else { b.is_ascii_hexdigit() }
        }) && nonce.bytes().all(|b| b.is_ascii_hexdigit())
}
