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
| Windows complete npm preflight / Cargo fmt/check/test | No current-SHA execution record or CI check | `NOT_EXECUTED` |
| Signed staged Windows gateway (Node 24.14.1 and license) | Generated packaging output, **not present in Git**; must be staged and SHA-checked on Windows | `NOT_STAGED` |
| NSIS installer, installed WebView2 and MCP named-pipe | No artifact or execution on current-SHA source | `NOT_VERIFIED` |
| Real signed-in Codex final turn, operator approval, pause/resume/STOP | Earlier historical Windows work is not a test of the current combined revision | `NOT_VERIFIED` |
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

The manual-only
[Windows GitHub Actions workflow](../../.github/workflows/localtest-readiness.yml)
can run this without using the user's desktop, **but must not be dispatched
silently**. Record workflow run ID and the **exact SHA**. Do not promote an
earlier passing Windows check to a later commit.

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
