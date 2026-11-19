**Development authority**: `OpenITStudios/LazyPrompting` → `Local`.
**Archived handoff baseline**: `3a7f277d05852ccf2d113c61b45421907402fa89`.

This file is the active continuation owner. Earlier milestones are preserved
in the [16 November GitHub checkpoint](https://github.com/OpenITStudios/LazyPrompting/blob/3a7f277d05852ccf2d113c61b45421907402fa89/docs/operations/current-state.md).
Historical installed Windows and MCP proof applies to `5869d30` and
`d346c75`. See [Windows localtest evidence](../validation/localtest-readiness.md).

## Source handoff — 16 November 2026 (historical)

The original ChatGPT/GitHub source-only handoff at `dbb334d` is preserved
in the [16 November committed checkpoint](https://github.com/OpenITStudios/LazyPrompting/blob/3a7f277d05852ccf2d113c61b45421907402fa89/docs/operations/current-state.md).
It introduced ten WebView2 workspaces, operator-controlled ChatGPT handoff,
canonical PromptOutbox recovery, the offline Lightpanda fixture, Codex V1,
source-only V2, confined Code Mode and separately approved OpenAI Platform
API goals. Consumer ChatGPT answer extraction and unattended reply remain
unsupported. ChatGPT Web `/c/<uuid>` and Platform `conv_...` are separate.
Unknown effects require reconciliation, not replay. Source approval, model
DONE or provider completion is not QA or installed-host proof; API token
limits are not a dollar cap. Later evidence and holds follow below.

## Windows PC validation — 18 November 2026

The Codex desktop terminal tested local corrections on `Local` at
`3a7f277`. The Git tree of the corrected working copy, with this checkpoint
held at its baseline for hashing, is `8cf2b954b41d50788312b106fbbecb19399c2576`.
This records the pre-publication working tree used for testing. The
[work transcript](history/2026-11-18-windows-localtest.md) records the
chronology and the limits of that evidence.

| Gate | Observed evidence |
| --- | --- |
| Deterministic preflight | Node 22.16.0 and Rust MSVC 1.96.0. 65 checks passed, including Svelte/Vite and Cargo fmt/check/test. Cargo reported 111 passed and 9 ignored. The separate Code Mode and optional API Goal fixtures passed with mock HTTP. |
| Gateway staging | Pinned Node 24.14.1 and license. The import parser now follows multiline declarations. 47 files verified, and the real wrapped gateway initialized and stopped via native IPC. |
| Native Lightpanda | The sealed binary passed its interactive localhost fixture test and the ten-workspace isolation test on WSL2. Operator-confirmed click and fill remain pending. |
| NSIS debug artifact | `LazyPrompting_0.1.0_x64-setup.exe`, SHA-256 `2890efe969e6e026de974ec178c6bfc8a6bdbbf95e7d20196703b0dfe021694a`. All 48 bundled gateway files, including the manifest, match staging. The extracted desktop executable passed MCP stdio discovery with four tools. |
| Codex CLI | The pinned `0.167.0-alpha.3.2` Windows package was checked against its SHA-512 integrity. Use the complete vendor layout, including `codex-resources` and `codex-path`, for the Windows sandbox helpers. |

### Installed smoke in an offline Windows Sandbox

The same installer completed in a disposable Windows Sandbox after installing
Microsoft's signed offline WebView2 Runtime (157.0.4341.60). The first attempt
on the clean guest exited with code 2. The NSIS package uses a download
bootstrapper when WebView2 is missing, so offline installs need the
[standalone runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
first. Networking remained disabled in the guest.

The installed gateway manifest matched staging. The repository's stdio verifier
discovered all four MCP tools on the installed executable after a PowerShell
pipeline probe produced a handshake mismatch. Browser CLI calls opened
workspaces 01–10 and returned their native locations. Graceful shutdown
completed and no installed desktop or bundled Node process remained.

| Open workspaces | Private commit (MiB) |
| --- | ---: |
| 1 | 279.6 |
| 2 | 292.2 |
| 5 | 316.8 |
| 10 | 352.6 |

These are short offline idle samples across the desktop and new WebView2
processes. The two-second CPU samples registered zero at the available
precision. Active browsing, latency and signed-in workload remain unmeasured.

### Signed-in Codex goal and gateway restart

The first signed-in read-only goal returned an unresolved answer because the
locally extracted CLI lacked the Windows sandbox helpers. A direct read-only
App Server command reproduced the failure without a model turn. After
extracting the complete pinned Windows package, the same command read the
fixture marker with the sandbox still enforced.

The staged native gateway test
`packaged_gateway_runs_an_approved_read_only_goal` then passed against fixture
commit `f50b9d32f49d89c58964a1b3f6508cb705a3da03`. It verified the marker,
restarted the gateway, and reconciled the original pending turn and outbox
entry without replacing the turn or extending the deadline. The fixture
checkout stayed clean. This test supplies an approved scope directly to the
gateway and provides no evidence of an installed operator dialog.

## Paused by the operator — native acceptance

The installed dialog test was staged in a separate offline Windows Sandbox.
The first two attempts installed LazyPrompting and WebView2, then stopped
before opening a dialog because Git reported the transferred fixture as
modified. Recreating the disposable checkout from its pinned commit produced
a clean status with the same portable Git on the host. The Sandbox retry was
closed at the user's request while it was still preparing WebView2.
No approval, rejection, worker launch or STOP result was recorded in this
dialog test. Keep the installed-dialog acceptance gate open.

When the operator resumes, follow the
[Windows localtest gate order](../validation/localtest-readiness.md)
with an operator-approved test profile and fixture `f50b9d3`. Verify actual
approval and rejection in the installed native dialog, pause/resume/STOP and
recovery through the installed host. Verify the native Lightpanda click/fill
path and ordinary ChatGPT Send once with the operator's consent. The optional
billable API smoke remains opt-in. Respect the first-blocker and no-replay rules.

## Gateway import graph hardening — source follow-up after Windows sync

**Surface:** `CHATGPT_GITHUB`; reviewed baseline: `Local` at
`831d34c6cfb71d042ac154af03c1c9b8f6782f40`.
The Windows-tested corrections were already synchronized before this change.
The gateway staging import scanner now uses Acorn syntax for both static
and literal dynamic ESM edges. It no longer relies on regular expressions
that could misread comments/strings or omit a legal commented dynamic import.
Unknown dynamic expressions still fail closed, and the existing package
allowlist, signed Node pins and manifest verification remain unchanged.
A positive/negative parser fixture is authored in the existing gateway-stage
verification test. **Proof:** `SOURCE_REVIEWED`, `TEST_AUTHORED_NOT_RUN`.
No Windows build, staged installer or installed browser/agent acceptance was
executed for the subsequent source revision. Native dialog/STOP, Lightpanda
consent and ordinary ChatGPT `Send once` remain on their existing holds;
future local validation must use the exact then-current source SHA.

## Native confirmation contention — source reliability follow-up

**Surface:** `CHATGPT_GITHUB`; source parent:
`Local@1a08ea9bd6b4f0f318577cccbc9dff07544b62d2`.
The shared Windows confirmation owner now distinguishes actual Yes/No
from modal contention and failed OS dialogs. Codex V1 and Agent V2
source/intent reviews store non-approval markers that resolve to
`RECONCILE_REQUIRED`, never a false `DECLINED` or an executable
grant. Existing native STOP remains dominant. API Goal, Lightpanda,
ChatGPT manual review and Codex callers propagate the explicit dialog
error before a protected effect. A pending Codex preview tool is denied
through the same gateway claim path if confirmation could not be shown;
there is no automatic retry or permission escalation. Native Rust
regressions are authored for Yes/No, a busy lock, V1/V2 durable holds
and STOP precedence. **Proof:** `SOURCE_REVIEWED` and
`TEST_AUTHORED_NOT_RUN`; actual Windows compilation, installed modal,
Codex pause/resume and browser behavior `NOT_EXECUTED` on the new
source revision. No public MCP API, second durable store, sandbox
policy or release surface changed.

## Codex runner teardown and durable lifecycle — source correction

**Source parent:** `Local@48549af392ade3414f90a8ac4b7fff004942d544`.
The original Goal Run owner could skip its final report checkpoint if the
Codex App Server `close()` rejected during cleanup. The runner now persists a
conservative `NEEDS_ATTENTION / GOAL_SERVER_CLOSE_UNCONFIRMED` state for
uncertain cleanup, retaining `STOPPED` if durable STOP already applies.
A pending pause is not promoted to completed quiescence without confirmed
worker teardown. The canonical per-task PromptOutbox and correlated turn
receipt are not rewritten or resent. Three deterministic synthetic
regressions are authored for completion/STOP/pause cleanup failure in the
existing goal-run recovery suite. **Proof:** `SOURCE_REVIEWED`,
`TEST_AUTHORED_NOT_RUN` for this revision; installed Windows/Codex
`NOT_EXECUTED`. Existing permissions and no-replay holds remain unchanged.

## Codex shutdown recovery admission — source stabilization

**Source parent:** `Local@f2b46f51ba2aa820f26776f911455c03db18f6d3`.
Source review found that a persisted `GOAL_SERVER_CLOSE_UNCONFIRMED`
checkpoint could still enter the pre-existing `NEEDS_ATTENTION` resume
route. Both the original Node Goal Run owner and native Rust admission now
reject that checkpoint without new work. The native status projection
uses `RECONCILE_REQUIRED` and disables execution rather than mistaking an
uncertain child for a safely quiescent one. STOP remains authoritative,
including if it arrives during failed child teardown. The canonical
PromptOutbox, task receipts, review decision and immutable goal identity
are preserved without automated retry. Source-owned regressions cover
held resume, unchanged durable report/outbox, STOP precedence and
late STOP during close. **Proof:** `SOURCE_REVIEWED`,
`TEST_AUTHORED_NOT_RUN`; Windows build, native dialog, installed
Codex/Lightpanda/ChatGPT acceptance `NOT_EXECUTED` on this revision.
This is not an automatic repair or manual-clear feature; unconfirmed
shutdown requires separate verified reconciliation before further dispatch.

## PromptOutbox completed-receipt integrity — source stabilization

**Source baseline:** `Local@cc5b852a038aecc1a5f3cdf98c918280eab3f465`.
The canonical outbox previously accepted a `RESPONSE_VERIFIED` item
without its acknowledged response handle or final response ID, which
could remove an actually unresolved row from the workspace pending
fence. Read-side validation now requires both identifiers on verified
items and the handle on acknowledged items. It also refuses duplicate
prompt IDs or multiple unresolved entries in one workspace. The
two identifiers may differ for an authorized transport; unknown
`RECONCILE_REQUIRED` rows remain held without requiring either.
The existing outbox fixture covers malformed receipts, duplicate and
ambiguous state, an unchanged rejected transaction, valid history,
and unknown-outcome denial. **Proof:** `SOURCE_REVIEWED`,
`TEST_AUTHORED_NOT_RUN`; no model, provider, Windows, browser or
native execution occurred for this source revision. The existing
exclusive transaction lock and explicit stale-owner recovery policy
remain unchanged; no unproven lock rewrite, new ledger, migration or
automatic prompt replay was added.

## Rust native status and MCP timeout hardening — source correction

**Surface:** `CHATGPT_GITHUB`. Baseline:
`Local@adef1a4fc86cb8d0d82ac3c43cca06dd50a26d04`.
`goal_runs.rs` now defaults `executionAvailable` to false and computes
the final hint only from a valid approval and effective
`STARTING`/`RUNNING` state. STOP, PAUSED, PAUSE_REQUESTED, completion,
stale host, and all reconciliation/invalid-checkpoint paths remain false.
A native Rust fixture covers approved STARTING versus STOPPED and denied
terminal/unknown states.

`browser_mcp_pipe.rs` no longer applies a five-second Tokio timeout to
the whole request handler; that former timer could drop an async waiter
while spawned native operations continued. Request read, reply write and
post-response drain still have five-second I/O bounds. Calls that may cause
effects use a bounded 120-second client response wait; lost/expired
acknowledgements are `BROWSER_MCP_EFFECT_RECONCILE_REQUIRED` rather
than proof that an effect was cancelled. Known read-only requests retain
a five-second client wait. The existing max-active-call semaphore remains
in place; no grant, effect, STOP or automatically retried action is added.
A Rust fixture covers classification of known/unknown calls and deadline
selection. **Proof:** `SOURCE_REVIEWED`, `TEST_AUTHORED_NOT_RUN`.
Current-HEAD Rust compilation, installed Windows MCP, active native effects
and interaction with external client timeouts remain `NOT_EXECUTED`.

## Code Mode modular binding and read-composition source increment — 19 Nov 2026

**Surface:** `CHATGPT_GITHUB`. Baseline: `Local@ec0f05907c528aaa2ac73f8771f7610e8ebb14cc`.
Schema-exact native/API status validators move into
`src/gateway/code-mode-bindings.mjs`, preserving the existing runtime
re-exports, authenticated host authority, interpreter limits, MCP names,
STOP and draft-effect admission. New source-only regression scenarios
cover leased V1 status/receipt, checkpoint projection and private API
goal review; the existing manual JSON-byte baseline includes recovery.
No paid calls, new effect capability, new control plane or native
transport change. **Proof:** `SOURCE_REVIEWED`,
`TEST_AUTHORED_NOT_RUN`; Node/Rust/Windows/installed MCP/native
security and actual token/latency savings remain `NOT_EXECUTED`.

## Rust memory and MCP admission efficiency — 19 Nov 2026

**Surface:** `CHATGPT_GITHUB`; source baseline `Local@fb4f5650`.
Prior `096f16e` streams packaged SHA-256 in 64 KiB chunks,
bounds manifest reads, and avoids browser snapshot clones;
`fb4f565` corrects fixture newline expectations.
This increment borrows parsed MCP params and object arguments
via `Cow<Value>` (parsing stringified inputs only), and
lowercases capability descriptions at most once per candidate.
Four public tools, JSON response, permissions, leases, STOP,
and uncertain-effect recovery are unchanged. Authored tests
cover object/string/null shape and multi-term/empty search parity.
**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`;
Cargo/Windows/installed MCP and measured memory/latency
`NOT_EXECUTED`. No CI, release or branch promotion.

## Rust modularization baseline — 19 November 2026

The 22-capability Rust discovery catalog, pure goal projections, gateway
object-result moves and seven native-authenticated RPC routes were integrated
through `Local@0cd6bc1f6c3da9738f1ca53ea27bd168727606f3`.
The complete source-only history and original limits remain in the
[immutable prior checkpoint](https://github.com/OpenITStudios/LazyPrompting/blob/0cd6bc1f6c3da9738f1ca53ea27bd168727606f3/docs/operations/current-state.md).
Public MCP names, Codex V1 permission owner, STOP, leases and uncertain-effect
holds remain unchanged. **Proof:** source reviewed/committed; Rust/Windows
and live installed MCP NOT_EXECUTED on this revision.

## P0 bounded state I/O and expired-callback gate — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent: `Local@0cd6bc1f6c3da9738f1ca53ea27bd168727606f3`.
A separate `goal_run_storage.rs` bounds native V1 scope (64 KiB), report
(4 MiB), task outbox (8 MiB), decision (64 B) and launch-error (4 KiB)
reads. Missing files remain distinct from oversized/unsafe records; the
original approval and STOP decisions remain in `goal_runs.rs`.
Canonical PromptOutbox now checks a 16 MiB byte limit both before JSON
parse and before atomic state replacement; oversize/ambiguous state is held
and never reset or retried. Negative tests cover oversized input/output.
The gateway rechecks its request deadline after write and before a native
effect callback; this prevents *starting* a callback after deadline expiry.
It does **not** guarantee termination of a blocking OS pipe write or an
already-running callback. Existing four MCP tools, host admission, recovery
and manual-only CI remain unchanged.
**Proof:** `SOURCE_REVIEWED`, `TEST_AUTHORED_NOT_RUN`; exact-HEAD Node,
Cargo/Windows, installed MCP, long-running IPC and memory/latency benchmarks
are `NOT_EXECUTED`. No release or promotion.

## IPC writer watchdog and shared native callback budget — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent: `Local@827df825d159b832e2fc5a3b499609eb5b691c4d`.
The existing Rust `RequestTracker` deadline is the single budget origin.
A scoped watchdog covers potentially blocking stdio writes and native
callback handshakes: when time expires it terminates the **same owned Node
child**, without retrying an uncertain action. It disarms before the
already-bounded response reader. Code Mode, Agent V2 and Lightpanda native
callback admission use the remaining parent deadline; a late frame cannot
start a new native effect. The original native lease, grant consumption,
STOP and recovery owners, MCP names and per-call time caps remain unchanged.
Unit fixtures for watchdog timeout/disarm and expired callback budgets are
authored. **Proof:** `SOURCE_REVIEWED`, `TEST_AUTHORED_NOT_RUN`.
This is not a guaranteed hard wall-clock cancellation: an in-flight
synchronous native effect, failed child termination or inherited pipe
handle may still stall. **Localtest handoff:** [A–E scenarios](../validation/windows-localtest-scenarios-2026-11-19.md).
Windows watchdog overhead and native behavior remain `NOT_EXECUTED`; no CI/release.
