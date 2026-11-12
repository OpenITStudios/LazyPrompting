# Universal Agent — migration acceptance gates (design only)

**Authority:** proposed [Universal Agent Orchestrator](../architecture/universal-agent-orchestrator.md) on `Local` HEAD `f6b4df15a5e6c4f5fb1a2f33e2cfcaeac6470e8e`. This is a forward-looking QA plan, NOT an executed test report.

## Evidence levels

`SOURCE_REVIEWED`, `SOURCE_COMMITTED`, `TEST_AUTHORED_NOT_RUN`, `EXECUTED_TEST_PASS/FAIL`, `LIVE_INTEGRATION_VERIFIED` and `UNKNOWN/NOT_EXECUTED` stay distinct. Reference legacy Windows results only at their exact SHA. Neither an MCP handshake nor an agent's own success text proves its worker runtime or QA.

## Matrix (every cell is a separate gate)

| Scenario | Codex adapter | OpenCode adapter | Claude/Gemini | macOS/Linux |
| --- | --- | --- | --- | --- |
| Client MCP initialize/tools/list/status | Preserve existing | OpenCode real app | Per-client real app where installed | Per-OS native MCP |
| Worker probe/auth/version and executable pin | Must pass | Read-only pilot | Future gated | Per-OS verified binary |
| Read-only goal with host-attested terminal | Must regress | Must pass | Future gated | Future gated |
| Write outside worktree denied by OS | Must regress | Required **before write enable** | Required before write | Per-OS sandbox |
| Provider turn uncertain / crash / restart | Must regress | Must pass | Required | Required |
| Pause/resume/STOP and false QA | Must regress | Must pass | Per-capability gate | Per-OS |
| Mixed-worker concurrent goals | Codex + OpenCode | Codex + OpenCode | After adapters verified | Native exclusive leases |

## Mandatory negative fixtures

1. Unauthorized MCP client calls another client's live workspace or goal: reject without modifying state.
2. Same `requestId` with different approved scope, provider, executable digest, repo, SHA or limits: `REQUEST_CONFLICT` or `RECONCILE_REQUIRED`.
3. After `submitTurn` transport timeout, provider turn cannot be matched: leave `OUTCOME_UNKNOWN`, do **not** replay.
4. Wrong `sessionId`/`turnId`/`taskId` in a delivered event: reject and hold; stale terminal callback cannot complete another run.
5. OpenCode with default broad `edit`, `shell` or `external_directory` permission: independent native sandbox still denies unapproved writes.
6. Worker claims passing tests while host QA did not run or diff digest changed: `QA_REQUIRED`/`QA_FAILED`, never DONE.
7. Provider without resume/cancel/pause capabilities: do not fabricate support; stop future work and hold for an explicit operator decision.
8. Same-repo writer competition, symlink/junction/hardlink escape, .git edits, sibling worktree mutation: fail closed.
9. Separate agent receives another agent's browser profile identity, transcript or secrets by default: fail.
10. Host restart or MCP client exit with an in-flight run: original owner, scope and terminal receipt remain authoritative; no orphan replay.
11. STOP during a pending permission request, and STOP after a provider reconnect: no extra dispatch/approval.
12. A producer sends excessive/malformed JSONL event data or unrecognized protocol version: bounded failure and no authority escalation.

## Required test layers, in order

- Source/unit: generic adapter manifest+event+receipt mocks, deterministic state transition, source package imports; current tests must remain green.
- Process protocol: actual child subprocess with JSONL/JSON-RPC fixtures, bounded buffers, corrupted messages, reconnect/recovery.
- Native Windows: Rust build/tests, named-pipe peer identity, 24-connection bounded concurrency, cold-start mutex, process exit reclamation, approval and pause/STOP.
- Installed: stage integrity -> NSIS build -> reinstall -> exact SHA/digest -> Codex + OpenCode real client sessions, then worker tasks in disposable repositories.
- True multi-agent: concurrent two-goal read-only; same checkout write rejection; disjoint task test, independently verified QA, system load bounds and no duplicate dispatch.
- Additional OS: signed/packaged native host and OS isolation for macOS/Linux; browser backend selection and credentials separately.

## Operator commands (no automatic execution)

```powershell
npm run test:repository
npm run test:goal-admission
npm run test:mcp-stdio-handshake
npm run preflight:localtest
# after restaging the gateway resources:
npm run preflight:gateway-stage
# then official Windows Cargo/NSIS build and installed acceptance per localtest-readiness.md
```

Keep `main` stable and `Harness` retained. No CI workflow dispatch, auto-release, browser login manipulation, or cross-repository writes without separately scoped operator authorization.

**Stop:** The first failed gate, unknown agent event, denied operator grant, altered branch SHA, stale checkpoint, failed sandbox probe, or irreconcilable delivery. Publish exact SHA, command, exit, scoped log and unresolved state; never describe a designed capability as runtime verified.
