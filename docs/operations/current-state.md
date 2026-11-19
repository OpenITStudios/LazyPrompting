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
path and ordinary ChatGPT Send once with the operator's consent. Respect the
first-blocker and no-replay rules.

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

## Rust native status and MCP timeout hardening

The [source checkpoint](https://github.com/OpenITStudios/LazyPrompting/blob/d9f312e0a07be17eef3880addbcbc5ccaaddee4d/docs/operations/current-state.md#rust-native-status-and-mcp-timeout-hardening--source-correction)
records the approval/STOP state gate and how the native pipe handles
uncertain effects. That source review preceded Windows fixture execution.

## Code Mode and Rust modularization — 19 November 2026

The [pinned source handoff](https://github.com/OpenITStudios/LazyPrompting/blob/d9f312e0a07be17eef3880addbcbc5ccaaddee4d/docs/operations/current-state.md)
records the Code Mode bindings split, Rust catalog/projection separation,
private gateway consolidation, streamed package hashing and borrowed MCP
inputs. Its proof was source-only. The later PC evidence is below.

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
handle may still stall. **Localtest handoff:** [A–D scenarios](../validation/windows-localtest-scenarios-2026-11-19.md).
Windows watchdog overhead and native behavior remain `NOT_EXECUTED`; no CI/release.

## Windows localtest — 19 November 2026

The PC checkout synchronized to `Local@d9f312e0a07be17eef3880addbcbc5ccaaddee4d`.
The baseline failed source fixtures and Rust fmt/test. Local corrections
update fixture wiring and types and make the repository check tolerate Rust
formatting. Tested source tree before this checkpoint update:
`9d4907d36b8e45f14420acd2062b5f6210e5367e` (uncommitted on that base).

| Gate | Observed result |
| --- | --- |
| A01–A02 | PASS on Windows 11 Pro x64 build 26100 using Codex Desktop, Node 22.16.0, Rust 1.96.0 MSVC, C++ Build Tools 17.14, Windows SDK and WebView2. |
| B01–B05 | PASS. Both lockfile installs and all four additional tests exited 0. Full preflight passed 68 checks with 0 issues, including Cargo 138 passed / 9 ignored, bounded state tests and IPC watchdog/deadline fixtures. |
| C01 | PASS. The isolated stage verified 48 files with manifest SHA-256 `7e702a258ba78c4749365f15ac5bf8054d63387d7d080d40f54b28e8a3f2e928`. The staged Node gateway answered stdio initialization and tool discovery. |
| C02 | PASS. Debug NSIS x64 built from the isolated tree. Installer SHA-256 `4dfed624df50b0073d3c035f0f29f05e8590d1d22df399b30053037e6cf80a47`. |
| C03 | PASS in offline Windows Sandbox. Installed WebView2 157.0.4341.60, verified all 49 gateway files including the manifest, then observed desktop startup, WebView2 and graceful shutdown. |
| C04 | PASS on the installed executable. MCP initialized and exposed four public tools. Status, native capability search and the exact Codex turn receipt schema responded. |

Installed operator acceptance stays paused. D01–D14 are `NOT_EXECUTED` on this source.

## Codex subscription only — 19 November 2026

The operator removed the paid OpenAI API mode. Desktop, gateway and Code
Mode entry points and the optional API acceptance gate are gone. The pinned
Codex App Server requires ChatGPT sign-in. Existing API-mode outbox records
remain inert and do not consume live Codex prompt slots.

On corrected source tree `98f2d837a0794a7efaedb6f65a39d51dc7e4eef0`,
Windows preflight passed 67 checks, including 137 Rust tests with 9 ignored.
The real pinned Codex accepted the local ChatGPT login without a model turn.
The NSIS debug installer SHA-256 is
`9c83af211bef202c19cad0d6f849800d5f48bf2892dbe8e06e33d9325ae85230`.
Offline Sandbox installation verified 46 installed gateway files, startup,
four public MCP tools and graceful shutdown. The staged gateway refused the
retired API RPC as method not found.

On direct Windows, one Yes completed D07 read-only fixture `f50b9d3`.
The report matched the marker and verified turn receipt. Prior decline
attempts recorded Yes and stopped at zero turns. Decline, D08 pause/resume,
and interrupted-turn recovery are `NOT_EXECUTED`.

Browser 01 ordinary Chat on Windows: one authorized bind, then two automatic
MCP turns (`2` → double → `4`) and STOP. Synthetic probe only, no repo task.
See [external handoff](chatgpt-chat-handoff.md#serah-terima-aktif--19-november-2026-wib).

## Source-only modular ChatGPT goal adapter — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; baseline: `Local@244470e5f4ab282c9a746426024a8ebe09cc3c41`.
A host-injected, fail-closed `src/mcp/chat-goal/` contract/bridge/MCP registration/widget source is authored for the selected Codex → LazyPrompting → ordinary ChatGPT design. Its four proposed tools are separated from the existing four desktop MCP tools and the arithmetic probe. The module has no process, credentials, outbox, scheduler, storage, direct browser reads, or public HTTP endpoint; only native host-owned transactions may eventually authorize a turn. Missing authentication or untrusted/malformed receipts hold execution. Delivery uncertainty is never auto-replayed and model `DONE_PROPOSED` never implies verified QA. A deterministic contract suite is registered in the Windows manual preflight.

**Proof:** `SOURCE_REVIEWED` / `TEST_AUTHORED_NOT_RUN` for this new source; no Windows, browser, plugin-auth, Codex-to-ChatGPT integration, native IPC, or multi-workspace validation on this revision. Existing installed Browser 01 two-turn arithmetic evidence remains historical and separate. **Next bounded source gate:** bind a genuinely authenticated native host adapter to the canonical PromptOutbox/checkpoints and separately verify the plugin's OAuth entrypoint before any live goal work. No automatic paid model API, CI, release or branch promotion.

## ChatGPT plugin canonical outbox intent — source only

**Surface:** `CHATGPT_GITHUB`; baseline `Local@81efe85a966d99161226e5d1fba47884aa6170d8`. `PromptOutbox` now supports an optional `chatPluginIntents` collection: one unresolved intent per workspace, with SHA-256 digests of bind/claim/receipt codes and goal/conversation/prompt scope. The existing exclusive lock fences native prompt, agent, browser action and operator-chat reservations against pending plugin intents, and vice versa. There is no send, response verification, model callback, success release or public plugin endpoint. Unknown state is held across restart; corrupt or duplicate rows are rejected. A deterministic Node fixture is registered in manual preflight.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`; no Windows/Rust, installed gateway, OAuth or live consumer ChatGPT validation for this source.

## Native-private ChatGPT plugin intent transport — source only

**Surface:** `CHATGPT_GITHUB`; parent `Local@90195d6919430cbc3299d675eac5d9637f6a6ae7`. The dormant Rust `GatewaySession.chat_plugin_intent_outbox` method uses an existing authenticated Node gateway request `lazyprompting/chatPluginIntent` for reserve/hold/pending. It never creates a standalone MCP tool, Tauri renderer command or send permission. Standalone gateway and unauthenticated Rust session negative fixtures are authored. The native method has no caller because OAuth issuer/audience/subject and approved goal/chat binding are not implemented; it would be incorrect to expose this path to arbitrary remote MCP callers now.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Rust/Windows, actual OAuth, ChatGPT, Codex and installed native IPC: `NOT_EXECUTED`. No public tool or release.


## ChatGPT plugin OAuth admission — source increment, 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent: `Local@1488e856d31fb004441d31997506ff1518549c5c`. A source-only `src/mcp/chat-goal/oauth-authenticator.mjs` now requires trusted OAuth verifier results and checks the HTTPS issuer, audience, bearer grant time bounds, required scope and opaque principal before delegating to the existing plugin bridge. An optional `mcp/www_authenticate` challenge supports a future HTTPS OAuth resource server. Widget-only tool visibility is explicit in `_meta.ui.visibility`; per-tool security metadata is preserved without the deprecated private visibility key. No additional model calls, scheduler, outbox or token storage are introduced.

**Proof:** `SOURCE_REVIEWED` / `TEST_AUTHORED_NOT_RUN`. The new negative OAuth fixture is registered in manual preflight. Live JWKS/opaque-token verification, issuer configuration, hosted MCP, native Rust session binding, installed Windows/ChatGPT and Codex-to-ChatGPT goal acceptance are `NOT_EXECUTED`. This source does not issue tokens or authorize a browser send.


## Native identity binding token consumption — source increment, 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent `Local@ab1e2e2f6e4ac95016363ed123cb53bb2f9f23b5`. Canonical `PromptOutbox` now issues a ten-minute bind code and records an at-most-once native-private `IDENTITY_BOUND_UNVERIFIED` transition against a host-derived opaque principal tag. Expired, repeated and legacy codes cannot be bound, but unresolved records are never automatically deleted/retried. Native packaged gateway `chatPluginIntent` recognizes `bind`; there is no actual OAuth-verified native caller, ChatGPT session attestation, prompt send or successful QA state. No second durable ledger, model polling, new public MCP tool, CI or release.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`, including negative fixtures in `test:chat-goal-host-intent`; Windows/ChatGPT/Codex execution `NOT_EXECUTED`.


## Exact native ChatGPT plugin scope binding — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent `Local@9f034628580efe855429bcc332b5e042701baaca`.
The canonical `PromptOutbox` now requires a valid bind code to
match **workspace, goal and conversation** at the atomic identity
transition. Rust's dormant native gateway method derives app-data
path itself and revalidates the live canonical ChatGPT URL against
the original saved bookmark and conversation digest on both sides
of reserve/bind. A changed tab after the effect stays unresolved
(`CHAT_PLUGIN_SCOPE_RECONCILE_REQUIRED`); no blind replay. Existing
bookmarks, PromptOutbox, permissions and STOP retain ownership.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`;
Node scope-negative fixtures and Rust bookmark/digest unit tests
authored, not executed. Windows/Cargo, real OAuth validation,
operator consent, signed-in ChatGPT identity, plugin delivery,
Codex handoff and ten-workspace acceptance are `NOT_EXECUTED`.
No public endpoint, release, CI or model API usage.


## ChatGPT plugin per-tool native authorization seam — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@57007a5632134a63f0f0814dcdcc4ff8e93a3b46`.
The modular `src/mcp/chat-goal/bridge.mjs` now requires
`authenticate` (OAuth verifier), `authorize` (trusted native
goal/workspace/chat/STOP scope), and `invoke` (native effect) as
independent callbacks. Every plugin tool call is admitted once per
request before a native effect, using strict opaque-scope parsing from
`host-admission.mjs`. A valid OAuth identity alone no longer reaches
`invoke`; a non-correlated hosting chat cannot report, claim or
record delivery, and an unbound `goal.bind` cannot return a follow-up
claim. Negative fixtures for wrong principal, workspace, goal,
conversation, STOP, epoch, malformed approval and native failure are
added to the existing manual `test:chat-goal-bridge` suite.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
The trusted native `authorize` implementation, token verifier,
OAuth resource server, host-attested ChatGPT conversation binding,
live Codex continuation, Windows build/runtime and multi-workspace
acceptance remain `NOT_EXECUTED`. No production endpoint, extra
model turn/polling, CI, release or alternative outbox was added.


## Native Codex-to-ChatGPT scope preflight — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent:
`Local@ee926046601c7e2f98459c1469b3346e45d8c7ac`. A read-only native `chat_plugin_scope_preflight`
is now wired to the existing desktop main window and goal panel.
It inspects exactly one approved, terminal Codex V1 `READ_ONLY`
`REVIEW_COMPLETE` scope through the original bounded native status
reader, validates current Git branch/HEAD and a clean source tree,
and matches the active ordinary ChatGPT chat against the original
saved native bookmark. The checks are repeated before returning,
with a conservative mismatch hold. The UI displays only eligibility
of native source scope at check time; no chat content, account token
or binding code is persisted or exposed. No dispatcher or native
permission owner was added.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Source regression `test:chat-plugin-native-preflight-source` and
pure Rust state/projection tests were authored and included in
the existing manually selected preflight; no Windows/Cargo/browser
test was run. This is **NOT OAuth linking, plugin operator
consent, signed-in ChatGPT identity, an automatic turn, or QA**.
The four-tool desktop MCP facade, prompt outbox and Codex worker
paths remain unchanged. Real OAuth-to-native identity and supported
in-thread host callback are still unavailable.

## Strict ChatGPT plugin type and receipt boundary — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent
`Local@252de2f01f89df9c64f08a6c64ded85671f1d2f1`.
Source inspection found that several plugin identity/token/digest checks
used JavaScript `RegExp.test()` directly on untrusted JSON. Arrays
holding one valid string and primitive strings with a final newline
could be accepted through implicit coercion or the `$` anchor.
The existing ChatGPT goal contract, OAuth verifier-result parser,
native admission parser and canonical `PromptOutbox` now require
primitive strings and exact matches. The MCP Zod tool metadata and
the app widget use the same rules; the widget does not submit a
malformed claimed prompt through `ui/message`. Existing tests gained
negative cases for input/receipt coercion and persisted file tampering.
No second state owner, dependency, worker, sender, or model-polling
route was added.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Existing
`test:chat-goal-bridge`, `test:chat-goal-oauth` and
`test:chat-goal-host-intent` suites were extended but not executed
on this source interface. OAuth issuer, native authenticated
authorize/invoke, official consumer ChatGPT final-turn evidence,
Windows host and multi-workspace acceptance remain `NOT_EXECUTED`.
No CI, release, private token publication or paid-model API.


## ChatGPT plugin read-only pending diagnosis — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@3090a94996063018b7c525e13fe47c9f0135a694`.
The original `PromptOutbox.pendingChatPluginIntent` now projects
a non-sensitive recovery diagnosis for one native-private workspace:
fresh binding window, expired unbound code, historical no-expiry row,
clock rollback/unknown time, identity-linked but chat-unverified,
terminal reconciliation hold, or no pending intent. It does not
alter on-disk state or infer that an expired code is safe to replay.
All results explicitly deny retry, automatic release, final-delivery
verification and next-prompt authorization. The existing authenticated
private gateway `pending` RPC is reused without another scheduler,
public tool, Tauri send command or outbox.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`; the existing
manual `test:chat-goal-host-intent` fixture now covers each
diagnostic, restart, no-state-write and token redaction. No
Windows/Cargo, installed gateway, OAuth, native chat binding or
live ChatGPT receipt was run. Safe terminal release remains
unimplemented and should not be inferred from diagnostics.

## Native desktop plugin hold inspector — source increment, 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent:
`Local@cf7caefdd7bd3acee4e04e6734589c91a5548287`.
A main-window-only, read-only `chat_plugin_pending_status` now
asks the existing authenticated packaged Node gateway for the
canonical `PromptOutbox` pending diagnosis. The native projection
rejects wrong workspace, unsupported states, invalid/extra fields,
unspecified QA, any permission/retry/delivery claim, and
inconsistent no-pending/hold combinations. Desktop Activity →
Interrupted state recovery displays one on-demand status message
with a conservative failure path. The user can inspect stale or
crash-held plugin state even when the ChatGPT WebView is closed;
no new scheduler or operator permission store was introduced.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
The existing Rust module unit fixtures and the source-only
`test:chat-plugin-native-preflight-source` were expanded; no
Windows/Cargo/WebView2 or installed gateway test has run. No
OAuth resource server, hosting-chat attestation, claim consumption,
actual plugin send or reliable final ChatGPT result exists.
The preflight and four public MCP tools retain their original
contracts. No CI, branch promotion, release or model API.

 
### Closed-WebView recovery access correction — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent:
`Local@8e78fed60219e8bda4d3360b6fd47bb930d9211f`.
The on-demand plugin hold check is now reachable both in Activity
for mounted WebViews and in the selected workspace panel when its
WebView is closed; otherwise the earlier Activity-only placement
could not support the documented crash/restart recovery use case.
A native status receipt uses explicit integer extraction rather than
a JSON numeric comparison. No additional gateway action, browser
navigation, prompt send, state writer or scheduler was introduced.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`; source
wiring fixture updated, native/Windows/UI runtime not executed.

 
## Compact ChatGPT-to-Codex report proposal — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@f28783701f39ecc22f15d6a0005dbf1715c5838b`.
The original ChatGPT hosted-plugin `goal.report` tool gains one
backward-compatible optional `nextAction` for CONTINUE. Its bridge
now derives a single bounded, untrusted `codexBrief` with
native-bound workspace/goal/conversation/epoch and a stable scoped
fingerprint. Neither the one-time report receipt nor private OAuth
identity enters the packet; no model proposal can mint Codex
execution/QA/next-message permission. The packet is handed to the
existing injected host `invoke` callback with the original private
report input, not sent directly to Codex.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
The old `test:chat-goal-bridge` suite gains deterministic and
negative proposal fixtures; Node/Windows/Cargo tests, live plugin
OAuth, native report receipt CAS and actual Codex delivery were NOT
EXECUTED. No new public MCP tool, state owner, extra model poll,
branch promotion or release.


## ChatGPT plugin efficiency and source-contract audit — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent
`Local@53f95bd893e61261c846dc28c5a27f0a131e197f`.
The plugin path avoids any new scheduler or extra model
call. Audit found a wrong-type native workspace admitted
through RegExp array coercion, inconsistent Unicode
single-line schema/parser behavior, and a 4 KiB
packet byte limit that could reject valid multibyte
reports after host checks. Primitive workspace
validation, consistent Unicode separators and a
safe upper bound now address these issues.
Negative regressions are authored.

Repeated plugin source-increment paragraphs in
`mcp/README.md` and `mcp/ARCHITECTURE.md` were
consolidated into current-state guidance; this
chronological record preserves the original
decisions. Never use a content-only fingerprint
to skip one-use report verification, model QA or
native STOP. No performance, token, CPU or RAM
measurement was executed; efficiency is
`SOURCE_REVIEWED / NOT_MEASURED` and Windows
runtime acceptance remains `NOT_EXECUTED`.

 
## Native read-only ChatGPT-to-Codex proposal receiver — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@108e14717438c5666050030493bfc6d36109f833`.
A private, non-Tauri Rust receiver now accepts only the
versioned `codexBrief` and a host-supplied run ID/epoch,
then checks native Codex V1 review-complete approval and
pinned clean Git SHA with the original goal_runs owner,
exact live/saved ordinary-chat URL digest with the
original bookmark owner, strict proposal schema and a
canonical ordered SHA-256 fingerprint. It returns
`REVIEW_REQUIRED` only, with explicit false flags
for report receipt, verified ChatGPT session, worker
execution, QA and next prompt. Content-only fingerprints
do not replace one-use report receipt or STOP.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`;
Rust unit fixtures and the existing source fixture authored.
No Windows/Cargo execution, real Browser 01 plugin/OAuth
host callback, independently verified final ChatGPT turn,
Codex work dispatch, automatic send or ten-workspace
acceptance on this source revision. No HTTP MCP server,
public Tauri command, model polling, scheduler, new outbox,
CI or release.

 
## Browser 01 read-only plugin status contract — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@ca219f302e51747d526e37cbe1868b74de73d39a`.
The hosted (not installed desktop) MCP source now defines a fifth
tool, `goal.status`, with zero input fields, OAuth/native
admission, strict scoped host-origin response parsing and small
sanitized structured output. The data-only tool is marked
read-only/idempotent and deliberately has **no widget template**.
It cannot choose a different workspace, create a Codex task,
reserve PromptOutbox, verify ChatGPT output or promote QA.
Its source-only fake-host tests cover foreign identities,
STOP, mismatched epochs, forged completion and unavailable
callbacks. The existing four-tool Rust and internal Node
public MCP facades are unchanged.

Browser 01 source/host/transport acceptance is specified in
`docs/validation/universal-chatgpt-acceptance.md` without
new test runner, cloud CI or hosted endpoint. Secure MCP Tunnel
is a candidate subject to actual organization/workspace
permission and deployment evidence; this source does not
connect it.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
OAuth/token verification, native status callback, Windows
build, ChatGPT plugin hosting, Secure MCP Tunnel, Codex
integration and real tool routing are `NOT_EXECUTED`.


## Hosted goal.status STOP visibility and schema-safe errors — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parent
`Local@bf0e3e489424d9b0375bfa2ed7c682a3d4a4c03d`.
`goal.status` now allows a native STOP state to be read by the
same OAuth-verified, chat-bound, still operator-approved principal.
The admission still denies all write/effect operations on STOP.
The status projector gives native STOP priority over stale Codex
RUNNING evidence and never grants dispatch, QA or another prompt.
Successful `structuredContent` stays inside the exact declared
output schema. Errors use `isError:true` with text only, rather
than inventing a structured success/status response. The other
four hosted plugin tools retain their previous error format.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`;
negative fixture additions cover STOP-read identity, rejected
effects, native source mismatch, schema errors and no retries.
Actual OAuth issuer, native stopped-status callback, Browser 01,
Windows/Cargo and live ChatGPT-to-Codex transport NOT_EXECUTED.
No new public tools, scheduling, model polling, state ledger or CI.

## Browser workspace hot-path optimization — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; parents `cae425b99f42a00a7d9e6cd61b43ff0a7db6778c`
and `8b51d2f73125b5a2800ec214cb57dc8aa8ae3605`.
The app restores native-only Tauri listener registration, removes a redundant
all-workspace hide from the existing Rust-owned mount path, coalesces
ResizeObserver requests in one animation frame, cancels stale frames, and
defers supporting-tab inventory/closed observation reads. The native host
uses a shared logical rectangle with Tauri `set_bounds` to update WebView2
main/supporting-tab position and size together. Native permission and STOP,
one WebView2 shared profile, original durable outbox, the public MCP four-tool
facade, scoped Lightpanda and the ChatGPT transport hold are unchanged.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Authored viewer-queue,
UI source and Rust logical bounds fixtures have not run. Current Windows
Svelte/Cargo/NSIS/WebView2 acceptance and measured CPU/RAM are `NOT_EXECUTED`.
The exact-SHA Windows UI/tab-switch/resize and 1/2/5/10-workspace benchmark
remain the previously selected local validation gate; do not claim runtime PASS.

## Low-end browser presentation and WebView2 memory hints — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent `Local@9b8b9d368ca0af88d4afdf895c03ded2882f0ef5`.
The desktop shell removes decorative shadow/transition layers and the empty
closed-workspace status ornament while retaining accessible status, logo,
navigation, focus, and visual state. Native supporting-tab lifecycle now
applies existing WebView2 LOW/NORMAL best-effort memory targets consistently
to hidden main/previous support and selected/returned main views. The same
native profile, permissions, STOP and PromptOutbox remain; website rendering,
login, scripts, GPU acceleration, Lightpanda and ChatGPT consumer transport
are unchanged. No forced suspend, image/video blocking or browser rewrite.
Regression fixtures and source documentation updated.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`; exact-revision Windows,
Cargo, Svelte, installed browser, memory/CPU and battery measurements
`NOT_EXECUTED`. LOW is only a native hint; actual savings are unknown.

## Rust-first WebView2 memory research and idempotent target hints — 19 November 2026

**Surface:** `CHATGPT_GITHUB`; source parent
`Local@bf96c4bfc482a477eb669a866f386d84e9cd45f5`.
Research compared WebView2 LOW/NORMAL versus TrySuspend/Resume,
environment-level process sharing and process enumeration, Win32
working-set/memory-priority APIs, and Rust allocator alternatives.
The existing `set_memory_saving` now checks the live WebView2
`ICoreWebView2_19::MemoryUsageTargetLevel` before setting a level.
A matching level skips a redundant setter; unknown getter/error still
attempts the previous best-effort setter. No cached identity or added
state owner. Native Windows unit and UI source contract fixtures are
authored; detailed alternatives, risks, source references and benchmark
criteria are appended to the original browser efficiency review.

**Decision:** Do not silently suspend hidden ChatGPT/AI tabs,
trim working sets, cap Chromium/Node heaps, add a new Rust allocator
dependency or fake savings from a native host-only PID. Next evidence
priority is per-WebView2-environment process/private-commit profiling
on a verified Windows host; only measured dominant costs justify a
separately scoped larger architecture change.

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`.
Exact-SHA Windows/Cargo/Svelte/WebView2 and 1/2/5/10 workspace
memory/CPU/task-success acceptance `NOT_EXECUTED`. No RAM savings
percentage, real speed improvement or commercial release claim.
