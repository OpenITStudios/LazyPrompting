# Windows native worker isolation — AppContainer + Job Object source

**Repository:** `OpenITStudios/LazyPrompting` → `Local`.  
**Evidence:** SOURCE_COMMITTED / NOT_EXECUTED. No Rust build, native process execution or Windows sandbox QA is claimed.

## Source implemented

The Windows v2 worker isolation source is split into three owners:

| Owner | Implemented source boundary |
| --- | --- |
| `apps/desktop/src-tauri/src/agent_worker_job.rs` | Bounded Windows Job Object creation, process count and per-process/job memory limits, no breakaway flags, kill-on-close, deadline watchdog, native STOP and Tauri shutdown cleanup |
| `apps/desktop/src-tauri/src/agent_worker_appcontainer.rs` | Fresh per-run random AppContainer profile and SID with zero capability grants; RAII cleanup |
| `apps/desktop/src-tauri/src/agent_worker_spawn.rs` | Host-approved executable SHA validation, CRT-quoted direct invocation, scrubbed Unicode environment, noninherited handles, `CreateProcessW(CREATE_SUSPENDED)` with `SECURITY_CAPABILITIES`, post-create `TokenIsAppContainer` check, suspended process/thread/profile ownership |

The app registers one `NativeWorkerJobs` Tauri state owner. `agent_run.stop` persists STOP **before** retiring an owned Job Object. The app shuts down all live worker job handles before closing its gateway. A future child can be attached to the job only through an owned `SuspendedAppContainerChild`, avoiding an untyped Win32 process-handle shortcut.

The source launcher **only creates a suspended child**. It contains **no `ResumeThread` call**, no model/network operation, no stdout/stderr capture and no process dispatch route from MCP or `AgentRunControllerV2`. Merely importing or registering the modules does not create a profile or process; the native gateway always denies v2 start/observe/cancel/reconcile until its other authority gates exist.

## Why both layers are necessary

A Job Object controls process count, memory, lifetime and the descendant tree, but does **not** prevent reading other user files or using the network. An AppContainer's security token is the OS resource-access boundary. An AppContainer with zero capabilities does not carry `internetClient`, `privateNetworkClientServer` or device capability SIDs. The child must be created suspended with the container attribute, and the host must inspect its actual token rather than trusting a command-line flag.

Windows Job Objects and AppContainers are not substitutes for independent native operator consent, validated source/QA, or a provider receipt. A timestamp, binary SHA-256 or model-generated explanation is not a sandbox proof.

## Remaining source requirements before a real read-only worker

1. **Explicit read-only files:** grant the per-run AppContainer SID only the smallest approved, canonical repository snapshot/input paths; traverse ancestors without directory-list/WRITE grants. Reject symlinks, reparse points and drive escapes; record/revoke ACEs precisely. Avoid granting a whole user profile or the original `.git` tree.
2. **Native I/O:** provide only approved and bounded stdin/stdout/stderr handles or a private authenticated IPC broker, with hard output limits. The source creates no inherited handles.
3. **Controlled network:** an ordinary CLI model session cannot reach its provider with zero network capabilities. Build an authenticated host-side provider proxy with explicit endpoint, account, request and budget limits; do not add an unrestricted `internetClient` grant or leak user credentials into the child.
4. **Validated resume:** attach a verified suspended AppContainer child to the bounded Job Object, confirm grants/limits/STOP, register the exact run owner, and only then resume the initial thread. If any step fails, terminate/reap the child and retire its profile.
5. **Receipt and QA:** host must observe session/turn identity, actual provider completion, source diff and independent QA. A worker exit code or JSONL text alone is not acceptance; missing terminal records remain `RECONCILE_REQUIRED`.
6. **Durable recovery:** after native crash, killed jobs and uncertain dispatches must reconcile from the existing `goal-runs` scope and `PromptOutbox` without auto-replaying. Leftover AppContainer profiles after a hard crash require a native owner-validated scavenger; never delete an arbitrary profile by guessed name.
7. **Native acceptance:** only once the PC is available, compile and test actual AppContainer/Job Object behavior, outside-scope file/network denial, STOP, deadline, output and provider connectivity. Do not use older Windows evidence as proof for this tree.

The existing four MCP public tools, installed client leases, v1 Codex checkpoints and source intent review remain unchanged.

## Official Microsoft reference material

- [AppContainer design and launch](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)
- [CreateAppContainerProfile](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-createappcontainerprofile)
- [Extended process startup attributes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute)
- [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)
- [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [Job Object resource limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information)
