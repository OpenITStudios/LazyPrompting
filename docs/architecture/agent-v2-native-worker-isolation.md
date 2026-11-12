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
| `apps/desktop/src-tauri/src/agent_worker_snapshot.rs` | Explicit, operator-reviewed tracked-file allowlist; no secrets/`.git`/reparse points; checked open-handle path; ≤24 inputs, ≤1 MiB/file and ≤8 MiB total; unique staged directory and SHA-256 content manifest |
| `apps/desktop/src-tauri/src/agent_worker_snapshot_acl.rs` | AppContainer SID-specific read/traverse DACL changes on **staged copies only**, applied using checked open handles. A typed `ReadOnlyWorkerSnapshot` retains the input directory until job cleanup |

The app registers one `NativeWorkerJobs` Tauri state owner. `agent_run.stop` persists STOP **before** retiring an owned Job Object. The app shuts down all live worker job handles before closing its gateway. A future child can be attached to the job only through an owned `SuspendedAppContainerChild`, avoiding an untyped Win32 process-handle shortcut.

The source launcher **only creates a suspended child**. A private native prelaunch function composes approved input staging → AppContainer creation → SID-specific read-only ACL grants on staged copies → Job Object attachment → source/STOP revalidation, with RAII cleanup on failure. Native stdio handles, bounded capture and parallel readers are now authored, but **no native worker is resumed**, no model/network call is made and no I/O capture has been accepted as a provider receipt. Neither MCP nor `AgentRunControllerV2` can dispatch v2 workers. Merely importing or registering the modules does not create a profile or process; the native gateway always denies v2 start/observe/cancel/reconcile until its other authority gates exist.

## Why both layers are necessary

A Job Object controls process count, memory, lifetime and the descendant tree, but does **not** prevent reading other user files or using the network. An AppContainer's security token is the OS resource-access boundary. An AppContainer with zero capabilities does not carry `internetClient`, `privateNetworkClientServer` or device capability SIDs. The child must be created suspended with the container attribute, and the host must inspect its actual token rather than trusting a command-line flag.

Windows Job Objects and AppContainers are not substitutes for independent native operator consent, validated source/QA, or a provider receipt. A timestamp, binary SHA-256 or model-generated explanation is not a sandbox proof.


### Explicit source snapshot policy

The `agent_run.prepare` scope accepts optional `readOnlyInputs` (up to 24 relative filenames). Those names are shown in the operator approval dialog and bound to its immutable approval digest. A prior v2 record without the field stays readable and approves **no input files**. There is no repository-wide automatic copy.

`stage_reviewed_worker_inputs` is native-only and requires current source approval, distinct execution intent, correct worker SHA and no STOP. The host copies only literal Git-tracked files from a clean pinned checkout into a fresh private input directory. Every source component and file handle is checked for reparse points and a final open-handle path that stays inside the checkout. Snapshot bytes and ordered names are hashed into a content manifest. It is staged again only after an explicit request by a future trusted launcher, never by querying MCP status.

`grant_snapshot_to_container` changes access control on the **staged file handles** to allow the exact per-run AppContainer SID to traverse directories and read files, without a write ACE or inheritable grants. The typed grant owner and suspended process become members of the Job Object so STOP/deadline cleanup retires the copy and process together. Windows DACL changes and read-only attributes do **not** prove that all undesired filesystem/network access is denied; runtime security probes are still mandatory.

## Universal Agent native I/O source — bounded, host-owned

The following source modules are present, but no live worker has been resumed or observed through them:

| Owner | Source contract |
| --- | --- |
| `agent_worker_stdio.rs` | Creates anonymous stdin/stdout/stderr pipes, marks parent ends noninheritable, exposes precisely three child handles and one-shot native parent ownership |
| `agent_worker_spawn.rs` | Uses `STARTF_USESTDHANDLES`, `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, and AppContainer `SECURITY_CAPABILITIES`; `bInheritHandles=TRUE` only with the exact whitelist |
| `agent_worker_io_pump.rs` | Drains stdout/stderr concurrently, bounded 16-chunk queue, ≤250 ms poll intervals, requires both streams to reach EOF |
| `agent_worker_io.rs` | Strict OpenCode JSONL parsing (≤1 MiB stdout, ≤128 KiB stderr, ≤128 KiB per frame, ≤512 events), session/tool/terminal guards and SHA-256 digests without returning transcript bytes |
| `agent_worker_job.rs` | Retains suspended process, AppContainer identity, approved input snapshot and one-shot native STDIO transfer under Job Object STOP/deadline ownership |

Output is only a `WorkerIoCandidate` with source `NATIVE_PROCESS_OUTPUT_CAPTURE_ONLY`. A clean exit or provider `step_finish` may yield `TERMINAL_CANDIDATE`, **never** an authenticated provider receipt or QA pass. Missing terminal records, bad/oversized events, conflicting session identity, pipe errors and unknown exits require `RECONCILE_REQUIRED`; never automatically repeat a dispatch. `PromptOutbox` remains the only durable dispatch and receipt owner.

Native requirements still missing: start both drainers before permitting child resume; kill the job on output overflow or timeout; verify OS PID and run/dispatch/session ownership; implement authorized provider network access via a host broker; reconcile against provider-persisted turn evidence; run native file/network denial fixtures. No source-only capture is security enforcement proof.

Microsoft references: [process handle inheritance](https://learn.microsoft.com/en-us/windows/win32/procthread/creating-processes), [Win32 handle list](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute), and [pipe handles](https://learn.microsoft.com/en-us/windows/win32/ipc/pipe-handle-inheritance).
## Remaining source requirements before a real read-only worker

1. **Read-only filesystem: source implemented, native proof pending.** The operator explicitly selects `readOnlyInputs`; only tracked, regular, bounded files are copied and the AppContainer SID receives read/traverse-only ACEs on those copies, never the original checkout. Still required: real AppContainer read-success/outside-tree denial probes, ancestor traversal/loader compatibility checks, ACL audit and crash-orphan cleanup; an ACL operation alone is not sandbox acceptance.
2. **Native I/O:** exact three-handle inheritance, parallel bounded stdout/stderr capture and OpenCode terminal candidates are authored. Still required: PID/session/dispatch correlation, integration with native job STOP, provider reconciliation and actual runtime acceptance.
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
- [Windows handle-based security DACLs](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo)
- [Reparse point semantics](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations)
- [Final path from opened handle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew)
- [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [Job Object resource limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information)
