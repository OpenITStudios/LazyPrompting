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
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use crate::agent_worker_spawn::SuspendedAppContainerChild;
use crate::agent_worker_snapshot_acl::ReadOnlyWorkerSnapshot;
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_ACTIVE_PROCESS, JOB_OBJECT_LIMIT_JOB_MEMORY,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOB_OBJECT_LIMIT_PROCESS_MEMORY,
    TerminateJobObject,
};

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
    child: Option<SuspendedAppContainerChild>,
    input_snapshot: Option<ReadOnlyWorkerSnapshot>,
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
        Ok(Self { job, deadline, attached: false,
            child: None, input_snapshot: None })
    }

    // May be called ONLY by a future AppContainer/LPAC launcher after Windows
    // has created a child with CREATE_SUSPENDED and confirmed its restricted
    // security token. This function DOES NOT resume it. Keeping this step
    // separate ensures job assignment cannot race the first worker instruction.
    pub(crate) fn attach_suspended(
        &mut self, child: SuspendedAppContainerChild
    ) -> Result<(), &'static str> {
        if self.attached || Instant::now() >= self.deadline {
            return Err("AGENT_JOB_ATTACH_NOT_ADMITTED");
        }
        // Only a child created by the private AppContainer launcher can reach
        // this path. Its actual token was checked before handing out the owned
        // process handle. Assign before any possible ResumeThread call.
        if unsafe {
            AssignProcessToJobObject(self.job.as_raw_handle(),
                child.process_handle().as_raw_handle())
        } == 0 {
            return Err("AGENT_JOB_ASSIGN_FAILED");
        }
        self.child = Some(child); // process/thread/profile stay owned by job
        self.attached = true;
        Ok(())
    }

    // Ownership is transferred only AFTER the exact AppContainer SID has
    // been explicitly granted read/traverse on the sealed snapshot copies.
    // A job lacking both a restricted child and a granted snapshot cannot
    // enter the bounded live-process registry.
    pub(crate) fn hold_snapshot(
        &mut self, snapshot: ReadOnlyWorkerSnapshot
    ) -> Result<(), &'static str> {
        if !self.attached || self.child.is_none() ||
            self.input_snapshot.is_some() || self.expired() ||
            snapshot.digest().len() != 64 {
            return Err("AGENT_JOB_SNAPSHOT_NOT_ADMITTED");
        }
        self.input_snapshot = Some(snapshot);
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
    jobs: Arc<Mutex<HashMap<String, WorkerJobLease>>>,
}

impl NativeWorkerJobs {
    // Future launcher calls this only after registering an AppContainer child
    // in a bounded job. No ResumeThread/API entrypoint exists at this stage.
    pub(crate) fn register(
        &self, run_id: &str, job: WorkerJobLease,
    ) -> Result<(), &'static str> {
        if !valid_run_id(run_id) || !job.attached || job.expired() ||
            job.child.is_none() || job.input_snapshot.is_none() {
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
        let deadline = job.deadline;
        jobs.insert(run_id.to_owned(), job);
        drop(jobs);
        // Each bounded run owns one native watchdog. If the callback loop or
        // model stalls, this host thread retires the job at the hard deadline
        // without relying on a cooperative agent cancellation event.
        let owner = Arc::downgrade(&self.jobs);
        let run = run_id.to_owned();
        if thread::Builder::new().name("agent-job-deadline".into())
            .spawn(move || {
                thread::sleep(deadline.saturating_duration_since(Instant::now()));
                if let Some(owner) = owner.upgrade() {
                    if let Ok(mut map) = owner.lock() {
                        if map.get(&run).is_some_and(|job| job.deadline == deadline) {
                            map.remove(&run); // kill-on-close; no automatic retry
                        }
                    }
                }
            }).is_err()
        {
            // Never leave a job running without the native deadline owner.
            let _ = self.jobs.lock()
                .map_err(|_| "AGENT_JOB_LOCK_FAILED")?.remove(run_id);
            return Err("AGENT_JOB_WATCHDOG_START_FAILED");
        }
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
        let mut jobs = self.jobs.lock()
            .map_err(|_| "AGENT_JOB_LOCK_FAILED")?;
        if jobs.get(run_id).is_some_and(WorkerJobLease::expired) {
            jobs.remove(run_id); // enforce expiration, do not just hide it
        }
        Ok(jobs.contains_key(run_id))
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
