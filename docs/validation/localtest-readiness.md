# Windows localtest readiness — active source gate, 11 November 2026

**Branch:** `Local`. **Audited starting HEAD:** `c8d9e7e57191bc005d5db1274187886f5dcea636`.
**Decision:** `CANDIDATE_FOR_CONTROLLED_LOCALTEST`, **not**
`WINDOWS_BUILD_VERIFIED`, `INSTALLER_TESTED`, or `PRODUCT_ACCEPTED`.

Localtest is now split into four separate checkpoints. A successful
source simulation or a SHA-pinned gateway manifest cannot prove another
checkpoint. Do **not** give one overall completion percentage as though
all product capabilities were equally tested.

## 1. Recorded evidence before Windows localtest
| Gate | Evidence as of this review | Readiness |
| --- | --- | --- |
| M2 Codex goal event, process/stdio, scope, recovery, pause | **27/27 Linux Node v22.16.0** subprocess/synthetic-host tests PASS, plus **34 event assertions** (exact Git source blobs on selected modules) | `EXECUTED_TEST_PASS` for named source only |
| Supervisor/storage source contracts | Previous **202** injected external-host assertions PASS | Source-only; not authenticated native/QA proof |
| Root + desktop npm lockfiles, Cargo.lock, NSIS overlay and icon | Present at pinned source | `SOURCE_REVIEWED` |
| Windows complete npm preflight / Cargo fmt/check/test | **Executed on Windows** for revision `5869d30`: `npm run preflight:localtest` returned `PASS (0 issues)`, `cargo test` 35 passed / 8 ignored | `EXECUTED_TEST_PASS` for that SHA |
| Signed staged Windows gateway (Node 24.14.1 and license) | Staged from the reviewed source; `npm run preflight:gateway-stage` returned `SOURCE_STAGE_VERIFIED` for 29 files | `EXECUTED_TEST_PASS` for that SHA |
| NSIS installer, installed WebView2 and MCP named-pipe | Debug x64 installer built and installed; installed MCP answered discovery, ten browser slots and browser navigation; no child process or pipe leaked after exit | `EXECUTED_TEST_PASS` for that SHA |
| Real signed-in Codex final turn, operator approval, pause/resume/STOP | Five targeted ignored native tests passed with the signed-in CLI `0.167.0-alpha.3.2` and pinned WSL2 Lightpanda 1.0.3, including restart recovery of the exact turn | `EXECUTED_TEST_PASS` for the harness path; the **operator dialog** and an installed pause/resume session are still `NOT_VERIFIED` |
| Ordinary ChatGPT Chat automation | Supported/authorized production transport and final-result handoff still unproven | `BLOCKED_BY_TRANSPORT` |

**Localtest is appropriate as a controlled engineering experiment**, starting
with build and launch on a disposable Windows environment. It is **not yet
appropriate for daily use, external release, or unattended ChatGPT Chat
automation**.

## 2. Phase A — pin and execute source/native preflight

On Windows x64 with Node **22.16.0**, Rust MSVC toolchain, Visual Studio
C++ Build Tools, Windows SDK and WebView2 Runtime installed:

```powershell
git switch Local
git pull --ff-only origin Local
git rev-parse HEAD
node --version
npm ci --no-audit --no-fund
npm ci --prefix apps/desktop --no-audit --no-fund
npm run preflight:localtest
```

The [manual Windows preflight workflow](https://github.com/OpenITStudios/LazyPrompting/actions/workflows/localtest-readiness.yml)
is now **registered on default branch `main`**. It requires a
`local_sha` input containing the current **full 40-character `Local`
HEAD** and checks out `Local`, not `main`; a mismatch stops the job
before npm installs. There is **no automatic dispatch**. GitHub Actions
must be started manually by the operator, or the equivalent preflight
run on an approved Windows machine. Record the exact tested SHA,
workflow run URL, exit status and first failed step. No successful
Windows run has been demonstrated here.

**Important limitation of Cargo's default test run:** live tests that
require staged gateway resources, signed-in Codex CLI and/or WSL2 Lightpanda
are explicitly marked `#[ignore]` in Rust. A successful `cargo test`
therefore **does not** prove those integration paths. Do **not** run
every ignored test indiscriminately. The disposable, approved
read-only Codex scenario can be exercised later with a targeted
`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml packaged_gateway_runs_an_approved_read_only_goal -- --ignored`
only after verifying all required test files, signed-in CLI, scopes
and environment variables.

**Gate A PASS:** all Node tests, Svelte/TypeScript, Vite build,
`cargo fmt --check`, `cargo check`, and `cargo test` exit successfully
on the same checkout. Rust Cargo is not available in the current
source-only Linux tool environment, so this is not a claimed PASS.

## 3. Phase B — stage, verify and build the installer

**Do not use the base Tauri configuration alone to create a distributable.**
`tauri.conf.json` intentionally has `bundle.active=false`.
`tauri.gateway.conf.json` is the **NSIS override** that enables bundling
and includes the staged gateway resource directory.

Follow the official checksum-pinned staging instructions in
[desktop packaging](../../apps/desktop/README.md). It requires the
exact Windows x64 **Node 24.14.1** executable and license; development
Node 22.16.0 is **not** the bundled gateway binary.

After `node scripts/stage-gateway-resources.mjs <node24-absolute-path>
<license-absolute-path>` succeeds, run from repository root:

```powershell
npm run preflight:gateway-stage
npm --prefix apps/desktop run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
```

`preflight:gateway-stage` is **read-only** and verifies staged
`node.exe`, license and manifest hashes, refuses path escapes, checks
all packaged source file digests against the current checkout, and
requires the staging-script SHA pins to match. It returns a failure
for missing, corrupted or stale staging. It does **not** compile Rust
or certify an installer. The staging script itself refuses overwriting
an existing generated gateway directory; do not delete application
profiles or user data to make a stage succeed.

**Gate B PASS:** a successful Gateway Stage check **and** an actually
produced NSIS artifact for the exact source SHA. Preserve the installer
SHA-256 and full build log.

## 4. Phase C — installed Windows smoke, safest sequence

Use a disposable local Windows user/profile and disposable test project;
do not aim this smoke test at production repositories, signed-in
consumer ChatGPT sessions or a valuable existing WebView2 profile.

**Pin check:** before the goal-run stage, the absolute
`LAZYPROMPTING_CODEX_EXE` path must point to an intentionally
approved Codex CLI whose `--version` output is
`codex-cli 0.167.0-alpha.3.2`, matching the currently hardcoded
transport checks. A newer upstream CLI release is **not**
automatically compatible. Missing/mismatched CLI blocks this test,
without invalidating unrelated source tests.


1. Launch and close the installed desktop. Check Windows runtime,
   signed resource loading, and native MCP readiness. Verify no leaked
   Codex/gateway child process after exit.
2. Exercise **one** browser workspace with neutral content and verify
   open, address, back, forward and reload; only then expand to
   two workspaces and ten slots.
3. Test a **read-only, explicitly approved** `goal_run.start` against
   the disposable project. Read `goal_run.status`, `report`,
   `turn_receipt`. Verify exact thread/turn/prompt correlation.
4. Test the new native `goal_run.control.pause`: request pause, observe
   `PAUSE_REQUESTED` then `PAUSED`; only resume from a quiescent
   checkpoint. Verify unchanged original goal fingerprint, no duplicate
   turn and no deadline extension.
5. STOP during an active turn. Confirm the STOP flag overrides pause,
   the original pending response remains for reconciliation, and
   restart does not dispatch again.
6. Test an interrupted run and stale/missing receipt in a **separate
   disposable run**; conflicting evidence must stay
   `RECONCILE_REQUIRED`. Escalate from one to multiple slots only
   when identity and resource isolation have been observed.

**Gate C PASS:** actual installed Windows behavior observed and
recorded at the pinned SHA. Model-generated text, a fake Codex
process or file presence alone is not native acceptance.

## 5. Phase D — separate product/ChatGPT capability

The desired ordinary/Personalized Temporary Chat worker is **not**
made operational by the installer test. Consumer-Web unattended
submission and response extraction are not an approved transport
in this repository. A supported, permitted host result channel,
account-specific capability checks, and independent live completion
proof remain separate P0 gates. Until then, ChatGPT Chat automation
must stay disabled and review must return `REVIEW_REQUIRED` or
operator handoff.

## When to stop localtest

Stop if the Windows build/preflight fails, staging integrity is
unconfirmed, native approval or requested scope cannot be proven,
a different workspace/turn is targeted, an uncertain send is retried,
STOP is ignored, profile data changes unexpectedly, or any test tries
to automate consumer ChatGPT Web without independent approval.

Report the first failed gate, the exact command/exit code,
the `Local` SHA, and sanitized host logs; do not silently change
branches, source authorizations or staged resources.

## 6. Executed localtest run — 12 November 2026

Revision `5869d30bb593799e7a1fb49124117a4a516b46ec` on `Local`, Windows x64,
Node 24.14.1, Rust MSVC, signed-in Codex CLI `0.167.0-alpha.3.2`, pinned
WSL2 Lightpanda 1.0.3. This run supersedes the "not executed" rows above for
that SHA only.

- **Gate A PASS.** `npm run preflight:localtest` → `PASS (0 issues)`.
  All npm `test:*` entrypoints, `svelte-check` (0 errors), `vite build`,
  `cargo fmt --check`, `cargo check`, `cargo test` (35 passed, 0 failed,
  8 ignored).
- **Gate B PASS.** `npm run preflight:gateway-stage` →
  `SOURCE_STAGE_VERIFIED`, 29 files, 26 source files.
  `npm --prefix apps/desktop run build:app -- --debug --config
  src-tauri/tauri.gateway.conf.json` produced the NSIS installer with
  SHA-256 `6665918f3470ac4623bab93a30656a0f52f5265dab433eadc72e361c3f6a6533`.
- **Gate C PASS for the installed desktop and the goal-run harness.**
  Installed `lazyprompting-desktop.exe mcp` answered `initialize`,
  `tools/list` and `search_capabilities`. Browser 01 exercised
  open/navigate/location/back/forward/reload; all ten slots opened and
  reported their page; `workspace-11` was refused. After closing the window
  no gateway or Codex child remained and the named pipe was gone.
  Ignored native tests passed: `packaged_gateway_initializes_and_stops`,
  `packaged_codex_recovers_turn_after_gateway_restart`,
  `packaged_gateway_runs_an_approved_read_only_goal`,
  `private_wsl_browser_isolates_ten_workspaces` and
  `packaged_gateway_verifies_five_coding_worktrees`.
- **Gate D still blocked.** Consumer ChatGPT Chat automation is not
  enabled. The synthetic arithmetic probe reached a temporary HTTPS tunnel
  and answered MCP discovery and widget resource reads; that is a transport
  diagnostic for synthetic content only and is not consumer acceptance.

Defects found and fixed in this run: `chat_fixture_native.rs` did not
compile (moved `url_string` read after its move); the capability catalog
count assertion was stale after `chat_goal.progress_review` was added;
the native fixture source contract asserted formatting-dependent source text;
and a transient App Server rejection stopped the managed Codex poll and
failed goal tasks.

## 7. Client-agnostic MCP and automatic setup — 12 November 2026

Measured on the installed bundle of revision `d346c75`
(installer SHA-256 `9adbd974b6e7495db52a6bf992b1aacc983ac994f2d22c9e87ac28052b6ddeec`).

- **Third-party clients.** The official MCP Inspector CLI listed the four
  public tools with `--strict` and reported no schema portability problem,
  then opened `workspace-03` and read `https://example.com/` from the
  installed application. The Inspector requests protocol `2025-11-25`; the
  facade answers `2025-03-26` and the client proceeds. An OpenCode agent
  turn called the `status` tool and received the expected payload.
- **One command for every client.** `npm run setup:local -- --apply`
  registered Codex CLI, OpenCode, Claude Code, Claude Desktop, Cursor,
  VS Code, Windsurf and Zed, and verified each one with a real stdio
  handshake that listed four tools. A configuration that already holds the
  exact entry is never rewritten, because a client reloads its configuration
  on change and drops a working server connection. Eighteen deterministic
  assertions cover the merge, the idempotence and the per-client entry
  shapes.
- **Automatic host start.** With the application stopped, one Inspector
  `tools/call` completed in **1.9 seconds** and the window was started by
  the facade. The same call previously took **591 seconds**: the started
  window inherited the client's stdout handle and kept the client's pipe
  open. The window is now created with `bInheritHandles=FALSE`, and the
  host is detected with a pipe-presence check that never occupies the host
  accept loop. The first request waits up to 15 seconds for the pipe.
- **Known limits.** Claude, Cursor, VS Code, Windsurf and Zed are not
  installed on this host, so only their registration and protocol were
  verified, not an agent session. OpenCode logs a transport error when its
  configuration file is rewritten while the client is running; the setup
  script no longer rewrites an unchanged configuration. `LAZYPROMPTING_CODEX_EXE`
  and `LAZYPROMPTING_LIGHTPANDA_BINARY` must be set for the user, because an
  automatically started window inherits only the client's environment.

