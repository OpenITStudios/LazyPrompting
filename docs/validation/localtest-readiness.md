# Windows localtest readiness — historical evidence and active local gates

**Historical starting HEAD (11 November):** `c8d9e7e57191bc005d5db1274187886f5dcea636`.
**Current 19 November source candidate (NOT tested):** `Local@80c4df338f7e9559622224164ba88842e4e4f534`.
**Executable localtest checklist:** [Windows test scenarios, A01–D14](windows-localtest-scenarios-2026-11-19.md). Use the **actual** full SHA recorded on the operator's PC; do not reuse old commit evidence or assume this documentation change was tested. The paragraphs below preserve historical steps and receipts; when a duplicated instruction conflicts with the current checklist, follow the current checklist.
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
git status --short  # inspect first; stop on unknown/dirty state
git switch Local    # only after operator confirms it is safe
git pull --ff-only origin Local
git rev-parse HEAD
node --version
npm ci --no-audit --no-fund
npm ci --prefix apps/desktop --no-audit --no-fund
npm run preflight:localtest
```

The historical [manual workflow definition](https://github.com/OpenITStudios/LazyPrompting/actions/workflows/localtest-readiness.yml)
exists but is **not** a permitted substitute for local PC validation
under the current project policy. Do not dispatch GitHub Actions or use
a hosted runner. Record the actual Windows PC agent, full checked-out SHA,
exit code, and first failed step from `npm run preflight:localtest`.
Prior commits' PASS results remain historical only.

**Optional focused source feedback (not Gate A):** when a local
development iteration changes only Goal Contract, Code Mode or MCP
routing, `npm run preflight:targeted` runs eleven existing Node suites:
repository structure, script entrypoints, goal contract/guardian,
native-goal source fixtures, Code Mode contracts/usage,
verified-goal continuation, prompt construction/context quality, stdio handshake
and packaged-gateway import closure. It starts no browser, Codex worker,
Rust build or Windows installer. It cannot replace
`npm run preflight:localtest` (all 71 listed npm suites plus desktop
build and Rust checks/tests) or the installed Windows safety gates.
The focused lane was authored in GitHub source and has **not** been
executed on the current revision; compare elapsed time only after
a matched local run.

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


## 8. Integrated browser source-to-local acceptance — 15 November 2026

This is a **future single Windows acceptance**, not a request to start
localtest now. The current surface is CHATGPT_GITHUB, so no source,
browser, network or installer test has been executed for these changes.
The operator will choose LOCAL_PC_AGENT independently later.
Pin the exact then-current `Local` HEAD; do not reuse old SHA receipts.

| Gate | One installed acceptance requirement | Hold |
|---|---|---|
| Build | Run the repo's approved desktop Svelte and Windows Cargo build/test gates at the pinned SHA | API/compiler behavior unverified |
| Tabs | 10 workspaces, at most 3 native supporting tabs each, shared intended profile, unique reservation, async WebView2 creation, recover from failed construction/close | Native deadlock, login and lifecycle proof |
| UI/MCP/CLI | Confirm identical selected tab for desktop/installed MCP/CLI; deny main ChatGPT mutation, including MCP `open` to a different existing conversation; external `open` becomes a pending manual offer; recover after late UI startup; exact-URL accept/dismiss | An emitted event is not operator acceptance |
| Native Codex V1 results | Compare recent goal list and per-task checks with `goal_run.report`; reject base SHA, mode, ordered criterion, malformed terminal state and recorded-check mismatches; keep STOP precedence and private content excluded | Native scope/report reconciliation and installed Windows comparison not executed |
| Navigation diagnosis | Run the existing `preflight:localtest` including root `test:desktop-browser-state` and desktop `test:browser-shortcuts`, then on disposable pages distinguish deliberate cancellation/redirect from offline, DNS and TLS failures. `IsSuccess=false` must remain `NAVIGATION_FAILED_UNCLASSIFIED` until a separately verified error code is available | Source assertions are authored, not executed; do not claim that every failure is a network outage |
| Observation | Desktop-only versus MCP/CLI-only one-shot 60s grants; reject changed URL/tab/document/recipient, stale page, private labels and oversized tree; compare reorder/duplicate delta | Page-load Finished is not HTTP success |
| Downloads/site permissions | Default-deny; match the approved HTTPS page origin to the reported download request URL (reject cross-site host, port and scheme); revoke on tab/workspace changes; test redirects and prior grants on disposable profiles | In-progress file-size cap, redirect/DNS containment, persisted grants |
| Efficiency | Identical authorized fixture tasks at 1/4/10 workspaces; compare full/compact/delta using **total input/output model tokens per successful task**, calls, retries, elapsed time, RAM/CPU | Byte truncation does not prove cost savings |

Promote results only after matching native host receipts and independent
acceptance. Keep unattended ChatGPT consumer sending/extraction and
agent V2 write dispatch under their existing holds. Do not replace
Windows proof with GitHub Actions, a cloud runner or another prototype.

## Deferred native Lightpanda preview validation (16 Nov 2026)

This is a **future acceptance contract, not a test request now**.
After the integrated source is ready and the user selects an actual
user-PC phase, pin the new `Local` SHA, execute approved preflight,
then run the separately ignored native fixture
`pinned_wsl_lightpanda_reports_interactive_fixture` on the sealed
binary in disposable WSL. Confirm support for `LP.waitForSelector`, `LP.getSemanticTree`
and `LP.getNodeDetails` (pinned 1.0.3 predates `LP.waitUntil`),
and the read-only native button review with no exposed node IDs,
plus visible `Preview query`,
`Preview checked`, `Check preview` controls. Record real
CDP elapsed time and failures.

Once the native action flow is genuinely implemented, confirm one
checkbox click and search-input fill, exact one-use grant/STOP,
durable unknown-turn hold and independent after-action observation.
Check 1/2/5/10 workspaces, Chrome-style UI regression, RAM/CPU,
actual token counts and site compatibility at the same source SHA.
Do not replace this with GitHub Actions/cloud proof or claim an
automatic ChatGPT consumer transport.

## Deferred Lightpanda B2 grant acceptance (16 Nov 2026)

In a separately selected user-PC phase, test the target-scoped
grant's workspace, fixed origin, epoch, fingerprint, backend ID,
role, operation, text hash, reservation identity, expiration,
STOP and replay. No production constructor or executable action
exists yet, so these fixtures are **not** proof of a working
click/fill or independent QA. Require actual native document
review and a durable reservation before authorizing an effect.

## Browser-action outbox source acceptance (16 Nov 2026)

The optional browser action reservation is in the existing
PromptOutbox file; no separate ledger or executable action is
introduced. When native validation is independently selected
later, execute `npm run test:browser-action-outbox` on the
same checkout as other outbox/worker regression tests.
Expected cases: old v1 files remain readable, one pending
browser action blocks another and blocks new prompt/agent
dispatch, a browser reservation cannot overlap a pending
prompt, an unknown action survives restart, a sealed
DISPATCH_PENDING action cannot be resealed,
RECONCILE_REQUIRED never authorizes re-execution,
forged approval keys and corrupt/repeated records fail closed,
and the read-side reservation match cannot claim authority.

There is currently NO native action-grant consumer and NO
verified browser effect. A passing Node fixture does not
authorize CDP clicks, remove pending holds, or upgrade B3
to installed acceptance. Require an authenticated host-owned
exact reservation check and independent after-effect receipt
before any positive action gate.

## Native pre-effect outbox proof — 16 Nov 2026

Deferred PC gate: verify exact DISPATCH_PENDING row,
host-selected app-data path, workspace, origin, epoch,
snapshot/target digest, action ID, nonce and operation.
Reject RESERVED, forged/mismatched/duplicate, symlink
and out-of-root files. The Rust positive grant methods
are test-only; no active browser effect or QA exists.

## Private preview identity source acceptance (16 Nov 2026)

On the selected actual user-PC phase only, test that
reopening a Lightpanda preview creates a new random
document epoch and private HMAC key, the same snapshot
in another workspace has a different digest, same-URL
reloads rotate the key, and public target-review receipts
never reveal backend IDs, target digests, selectors or
input contents. Actual pinned 1.0.3 CDP and Windows
acceptance are NOT_EXECUTED on this source revision.

## Deferred Browser AI offline action acceptance — 16 November 2026

**Not a request to run tests during ChatGPT-GitHub source development.**
The current source adds an explicit native `lightpanda_preview_action`
from the existing desktop Browser Activity panel. After an independently
selected PC validation phase, pin its *actual* then-current `Local`
commit SHA; historical Windows PASS receipts do not apply.

- **Source/build and packaging:** complete registered Node source fixtures,
  frontend `svelte-check` and build, `cargo fmt/check/test` at the same
  SHA, and installed staged signed gateway. Confirm private Node
  `lazyprompting/browserAction` cannot be invoked from public MCP or
  Code Mode; prove the exact app-local outbox path.
- **Offline positive controls:** confirm `LP.getNodeDetails`,
  `LP.clickNode` and `LP.fillNode` are implemented by the
  **installed** pinned WSL Lightpanda binary, open local preview with
  OS confirmation, click one checkbox and fill one bounded search
  value on a disposable fixture, independently read back and
  verify the persisted exact `VERIFIED` result digest.
- **Native negative controls:** refuse denied operator dialog,
  replayed one-use grant, changed workspace, URL, role, backend
  node, epoch, snapshot/target HMAC, nonce, text digest, outbox
  path, STOP, unexpected CDP error, tampered node details, broken
  reply and truncated/late CDP response. No automatic retries.
- **Restart and busy states:** prove `RESERVED` and
  `DISPATCH_PENDING` do not become implicit success;
  `RECONCILE_REQUIRED` survives restart and blocks new actions.
  Verify completed history allows the next distinct reservation
  while a pending row in that workspace cannot overlap. Check
  Codex goal per-task outbox collision separately; no assumption
  of global cross-file exclusion.
- **Performance and delivery:** compare 1/2/5/10 approved
  workspaces, total model tokens per successful task (if a future
  supported model path exists), tool calls/retries, latency,
  RAM/CPU and browser stability on the same test SHA. Assess
  Lightpanda license and distribution before release.

Until matched evidence is recorded, report **SOURCE_COMMITTED /
TEST_AUTHORED_NOT_RUN** for the fixed fixture and
**NOT_EXECUTED / DISABLED** for public-site AI browsing and
unattended consumer ChatGPT Web automation. There is no installed
browser agent PASS on this current source.


## 9. PC-local handoff — current test packet (19 November 2026)

The historical final handoff was based on `Local@dbb334d17ed1325ff6134dfc58fa76785e98cd0c`; it is **not** the current test target.
Start from the [current runnable scenario matrix](windows-localtest-scenarios-2026-11-19.md), not from that historical SHA. The **PC agent must pin the actual `Local` HEAD** for all tests. The source candidate inspected here is `80c4df338f7e9559622224164ba88842e4e4f534` before this documentation-only change. `LOCAL_PC_AGENT` requires a real, user-selected PC host; a Git branch named `Local` is not host evidence.

### A. Prepare and pin one real Windows revision

Use a disposable Windows account/profile and disposable
test project, separate from valuable ChatGPT/WebView2
profiles and production repositories. First review
`AGENTS.md`, `GITHUB_RULES.md`,
`.agent-standard/profile.json` and
`.agent-standard/project-policy.md` from the checked-out
revision. Do not discard uncommitted local changes;
resolve a dirty working tree before switching refs.

From the **repo root**, after verifying that it is safe
to update this checkout:

```powershell
git status --short
git status --short  # inspect first; stop on unknown/dirty state
git switch Local    # only after operator confirms it is safe
git pull --ff-only origin Local
git rev-parse HEAD
node --version
cargo --version
npm ci --no-audit --no-fund
npm ci --prefix apps/desktop --no-audit --no-fund
```

Required environment from the existing Windows guide:
Node 22.16.0 for the reviewed development baseline,
Rust MSVC toolchain, Visual Studio C++ Build Tools,
Windows SDK and WebView2 Runtime. The separately
packaged gateway Node 24.14.1 is **not** the developer
Node 22 baseline. If a required tool is missing or
the checkout is not clean/pinned, report **BLOCKED**
rather than silently changing versions or branches.

### B. Deterministic source/compile gate — no API charges

The canonical `preflight:localtest` **already includes**
`test:prompt-outbox`, `test:browser-action-outbox`,
`test:code-mode`, `test:code-mode-usage`,
`test:goal-run-scope-fingerprint`,
the source/desktop matrix, frontend build and Cargo fmt/check/test.
Only run additional checks not already in that matrix:

```powershell
npm run test:desktop-source
npm run test:existing-chat-transport-gate
npm run test:prompt-recovery-policy
npm run test:prompt-budget-context
npm run preflight:localtest
```

`test:code-mode-usage` measures JSON bytes/outer
round trips **not actual model tokens**.

Gate **B PASS** only if every required fixture,
Svelte/TypeScript/Vite and Cargo fmt/check/test
is actually successful on the same SHA. Capture
the first failing command, exit code and sanitized
log. A compiler error or test mismatch means
**FAIL / source correction needed**, not installed
acceptance. Do not dispatch GitHub Actions/cloud
CI to replace a genuine PC run.

### C. Stage, build and install the actual desktop

Follow the canonical, checksum-pinned
[desktop packaging instructions](../../apps/desktop/README.md),
including the official Windows x64 Node 24.14.1
binary/license and
`node scripts/stage-gateway-resources.mjs`.
Do not reuse a stale staged gateway or silently
overwrite user profiles. From the repo root:

```powershell
npm run preflight:gateway-stage
npm --prefix apps/desktop run build:app -- --debug --config src-tauri/tauri.gateway.conf.json
```

Gate **C PASS** requires the real NSIS artifact
under `apps/desktop/src-tauri/target/debug/bundle/nsis/`,
successful install/launch of that exact revision,
matching staged gateway, and observed native MCP
handshake. Record installer SHA-256 and sanitized
build log. If the gateway stage is missing, run
its canonical staging procedure first; a stage
PASS alone is not an installer PASS.

### D. Native UI / Browser AI / Code Mode acceptance

In the installed app and disposable workspace:

1. Open/close one ordinary WebView2 workspace;
   test navigation, saved `/c/<uuid>` chat link,
   switching tabs, the four public MCP tools
   and an approved bounded Code Mode read.
   Confirm Code Mode cannot expose raw ChatGPT
   responses, arbitrary page
   click or native action grant escape to MCP.
2. On fixed localhost Lightpanda preview only,
   verify installed pinned WSL Lightpanda binary,
   control index/target identity, explicit Windows
   permission, one checkbox click and one
   bounded search-field fill. Verify real
   `LP.getNodeDetails`, `LP.clickNode`,
   `LP.fillNode` support and independent
   persisted result readback; unknown outcomes
   must stay `RECONCILE_REQUIRED` with
   **no repeat dispatch**.
3. Test ordinary consumer ChatGPT **operator-
   reviewed** `Send once` with the exact
   saved existing conversation. Check pending
   status, content-free adaptive monitoring,
   manually pasted reply, next draft,
   duplicate prevention, restart/STOP and
   a refused or mismatched chat. Do not
   scrape an answer or test unattended sending.
4. Force a disposable gateway restart between
   reservation and result handling. Verify
   durable attempt/outbox survival, matching
   native review and safe dead-owner lock
   recovery. Live/unknown owners must not
   be cleared automatically.
5. Test 1, 2, 5 and 10 workspace browser
   isolation/CPU/RAM and polling frequency
   under both idle and active workloads. Confirm
   **no model token use for UI/status polls**;
   measure real CPU/RAM and latency rather
   than inventing percentages.

**D PASS** requires each permitted browser/native
effect, protection and STOP to be observed on
the installed binary. Real installed UI and
native Code Mode status still do not grant
consumer-chat autonomous output retrieval.

### Report / STOP conditions

Capture, outside public Git and with
secrets/profile data removed:

| Gate | Exact evidence expected |
| --- | --- |
| A | Real PC host, `Local` full SHA, clean/intentional checkout, dependency versions |
| B | Test command + PASS/FAIL, Cargo/Svelte build logs, first source error |
| C | Staging verification, real NSIS artifact SHA-256, installed MCP and launch |
| D | Operator dialog/STOP, WebView2 and Lightpanda results, restart/holds, workspace isolation and CPU/RAM |
| Product | Ordinary ChatGPT unattended answer retrieval remains BLOCKED by transport |

**STOP the affected run immediately** on a mismatched
SHA, failed auth/consent, credential leakage,
duplicate billed or browser dispatch,
unstoppable effect, unknown action
being auto-retried, false QA PASS,
or unexpected writes to user data.
Do not merge `Local` into `main`, tag
or release merely because tests passed.
Fix the first demonstrated blocker
in scope, re-pin SHA and repeat the
affected consumers and gates, not
unrelated speculative polishing.

**Final source-phase status on 16 Nov 2026:**
`SOURCE_COMMITTED / TEST_AUTHORED_NOT_RUN`,
`LOCAL_PC_AGENT: NOT_EXECUTED`.
This is a handoff for a future separately
selected PC phase, not evidence that it
already happened.
