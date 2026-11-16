# LazyPrompting

**Universal MCP-compatible AI clients; ordinary ChatGPT Chat remains the conversational destination.**

> Development branch: `Local`. `main` stays stable; the historical `Harness` branch is retained. Selected Windows behavior has been exercised in earlier recorded tests, but a committed source tree is not a production release or proof of full installed ten-workspace acceptance. See [current state](docs/operations/current-state.md) and [historical evidence](docs/operations/history/2026-11-10-full-checkpoint.md).

## Product goal

An operator defines a scoped engineering goal once. Any verified MCP client (Codex, OpenCode, Claude/Gemini tools and compatible editors when installed) can request host-authorized operations, while ordinary persistent ChatGPT Chat remains the **intended conversational workspace**. Deterministic supervisor and evidence/QA govern continuation; optional provider-specific workers are separate. No browser-output scraping, blind `lanjutkan` loop, or unapproved cross-repository writing is allowed. Unattended consumer ChatGPT Chat orchestration remains unsupported; see [selected architecture](docs/architecture/universal-chatgpt-workflow.md).

## Architecture at a glance

| Layer | Canonical location | Responsibility |
| --- | --- | --- |
| Desktop | `apps/desktop/` | Svelte shell, Tauri/Rust host and ten WebView2 workspace views |
| Installed MCP client facade | `apps/desktop/src-tauri/src/mcp_stdio_host.rs` | Four-tool stdio interface for compatible MCP clients; native browser, Codex V1 and V2 preparation |
| Desktop-owned Node gateway | `src/gateway/` | Separate internal MCP tool catalog, routing and scoped native transport |
| Confined Code Mode | `src/gateway/code-mode-runtime.mjs` | Read-only JavaScript-subset composition; existing router and native host gate retained |
| Supervisor and lifecycle | `src/supervisor/`, `src/prompt/`, `src/runtime/` | Checkpoints, decisions, workspaces, durable recovery and STOP |
| Worker and browser integrations | `src/transport/`, `src/agent/`, `src/browser/`, `src/integrations/` | Codex V1, source-only provider-neutral V2, browser adapters and independently verified evidence |
| Authority | `src/governance/`, native Rust host | Host-owned permission, single-use grants and replay safeguards |
| Compatibility and experiments | `src/mcp/` | Legacy Node MCP and opt-in synthetic ChatGPT transport probe, **not** production desktop entrypoints |

Both current MCP facades use `status`, `search_capabilities`, `describe_capability`, `invoke_capability`, but their catalogs, processes and trust conditions differ. [MCP architecture](mcp/ARCHITECTURE.md) is the canonical map. WebView2 and Lightpanda are separate browser runtimes. The optional
local-preview Node Lightpanda adapter has a read-only
`lightpanda.snapshot({workspaceId,view:"index"})` that projects
numbered **display-only** semantic controls through the original
host admission; default metadata is unchanged. An optional
`sinceFingerprint` returns empty content only when a fresh
same-workspace/navigation observation matches the previous keyed
fingerprint (including private backend node IDs). Snapshot reads now
have a bounded timeout. This is a potential JSON-byte reduction, not
proven LLM-token savings or action authority. The native Windows source now also supports one
explicit, host-approved local-preview `index` action using a
distinct one-use grant. It has **no native cursor**, and installed
runtime support is NOT_EXECUTED. This is not public-site browser
automation, Code Mode page access, or an authorized ChatGPT
transport.
The opt-in `lightpanda.review` capability adds one host-admitted
read-only target check, re-reading the current preview and validating
its private node details. It never clicks, fills, exposes node IDs,
or authorizes an action; installed Rust and Code Mode reject it.
The local-preview origin is pinned to port 1425.
The fixed **offline** Lightpanda fixture now has an operator-confirmed
desktop **source implementation** for a checkbox click or search-input fill.
The trusted Rust host privately reviews the actual CDP node and document,
reserves and seals the same app-local PromptOutbox file, consumes one native
target grant, performs one CDP operation and reads the fixture state again.
An exact `VERIFIED` row/result digest is independently checked on disk; an
ambiguous operation remains `RECONCILE_REQUIRED` and is never blindly retried.
The desktop Browser Activity panel exposes these fixed tests only.
The Node gateway's separate `lazyprompting/browserAction` RPC is
private native-bootstrap transport, **not** a new public MCP capability.
This complete source path has **not** passed Windows/Cargo, installed
Lightpanda, native CDP or independent QA validation; do not infer installed
browser usability. The indexed JavaScript adapter remains read-only and
Code Mode/Agent V2 still cannot operate a browser.

**Outbox limitation:** Codex goals use per-task files; cross-file workspace
exclusion remains unproven. A post-dispatch unknown result deliberately
holds further actions pending independent reconciliation. This is not a
public-site AI browser, and it does not automate consumer ChatGPT. See
[prompt outbox ownership](docs/architecture/prompt-outbox-and-observation.md).
See [AI browser efficiency gate](docs/architecture/desktop-multi-browser-product.md).

## Code Mode–first source direction

The selected direction is code-based composition with the original four MCP
tools kept as the compatibility facade. A confined Acorn-based source
interpreter exposes `code_mode.catalog` and `code_mode.execute`; generated
code can query capability metadata, invoke only `supervisor.status` and
`supervisor.evaluate`, read an **approved, owner-leased native Codex V1
status** via `tools.goal.status()`, examine a sanitized task report or
host-correlated turn receipt, and inspect an owned Agent V2 source-only
status. With the same pre-existing V2 lease and optional `effectPolicy:true`,
`tools.agent.effect_policy()` reads four **denied** native decisions
(start/observe/cancel/reconcileReserved), not an execution grant.
A configured checkpoint offers a bounded recovery summary.
Installed native MCP capability names/effect classes can also be discovered
through `tools.capabilities.native({query,limit})` inside Code Mode, but that
metadata never grants an effectful operation. `tools.repo.status()` is a
read-only Git count projection bound to a separately approved **Agent V2**
scope (not the legacy Codex V1 approval marker).
The first native effect broker action is a single terminal
`tools.handoff.prepare({goal,acceptance,...})` under a pre-owned
`handoffWorkspaceId`. It puts a manual draft in the existing native inbox,
returns only a fingerprint, and never sends a ChatGPT message.
With the same pre-owned workspace lease, `tools.handoff.reconcile()`
can inspect the canonical native pending inbox (fingerprint/status only)
before a manual retry decision. `tools.handoff.continue({previousFingerprint,
reply,nextStep?})` can now atomically replace **only** the matching
pending draft using client-supplied, unverified reply text. The desktop's
operator-pasted reply uses that same native inbox; both paths require
manual review and neither can retrieve or verify a ChatGPT answer. Its `SESSION_MEMORY` status is **not**
durable across desktop restarts; `EMPTY_UNVERIFIED` never proves a
previous effect did not occur.
A selected supporting tab's **HTTPS origin only** remains readable via
`tools.workspace.location()` under the pre-existing workspace lease. It returns one bounded
structured result instead of sending intermediate tool outputs into the model
context. This is **source-only** until current-revision npm, Rust, packaging
and installed security checks execute. Code Mode cannot navigate, inspect page contents, read ChatGPT conversations,
write files, dispatch workers or automate consumer ChatGPT Web.
A native manual draft is not an authenticated ChatGPT turn.
See [Code Mode runtime](docs/architecture/code-mode-runtime.md).

## Evidence and readiness

Recorded Windows work includes installed WebView2/browser control checks, packaged/authenticated gateway checks, scoped Lightpanda tests, and distinct Codex turns and worktree verification. These were performed on earlier recorded source/builds; they are **not** rerun or re-certified by repository cleanup. Full installed ten-slot interactive acceptance, actual operator-dialog approvals in all combined paths, background ChatGPT Chat probe behavior, recovery gaps and production packaging remain explicitly bounded by the active checkpoint.

Experimental ChatGPT Chat/Work arithmetic probing via a custom MCP plugin is documented separately in [MCP usage](mcp/README.md). It does not authorize ChatGPT Web scraping or provide a production continuation transport.

## Repository development

Use Node.js **22.16.0** as the development baseline (`.node-version`); root and desktop each have an independent npm lockfile. Packaged Windows gateway staging requires a separately checksum-verified **Node 24.14.1 win-x64** binary and license, not the development Node executable. See [toolchain](toolchain.json) and [desktop packaging](apps/desktop/README.md).

```bash
npm run test:repository       # deterministic repository contract checks only
npm ci                         # optional root dependency installation for local engineering
npm ci --prefix apps/desktop   # separate desktop dependency closure
npm run preflight:localtest     # manual Windows source/native preflight; not a release gate
npm run test:gateway-stage-verify # fixture-only test of the staging checksum checker
# AFTER the Windows gateway is explicitly staged from the official pinned Node binary/license:
npm run preflight:gateway-stage  # read-only package-input checksum/parity gate, NOT a build
```

No command above is evidence of a successful run until it has actually been executed on the target revision. The manual Windows workflow is now registered on default `main` (commit `c10f121`) and checks out the explicitly pinned `Local` HEAD. It still requires a **manual** GitHub Actions dispatch with a 40-character `local_sha` input; source commits do not trigger CI. No current source revision has a verified Windows CI pass. Localtest is staged: [Windows gate checklist](docs/validation/localtest-readiness.md) distinguishes source preflight, explicitly staged NSIS gateway/installer, installed smoke, and the separately blocked ChatGPT Web transport.

## Navigation and policy

- [Documentation router](docs/README.md) — architecture, governance, operations and verification domains.
- [Stable project context](CONTEXT.md) — product decisions, not a rolling progress log.
- [Shared agent policy](AGENTS.md) and [GitHub rules](GITHUB_RULES.md) — canonical [AgentSkill](https://github.com/OpenITStudios/AgentSkill) governance; [local profile](.agent-standard/profile.json) and [project policy](.agent-standard/project-policy.md) preserve LazyPrompting-specific branch, transport, security and evidence restrictions.
- [Current checkpoint](docs/operations/current-state.md) — sole active continuation owner.
- [MCP architecture](mcp/ARCHITECTURE.md), [universal chat-first product contract](docs/architecture/universal-chatgpt-workflow.md) and [system contract](docs/architecture/system-contract.md) — roles, trust and implementation boundaries.

Source work and runtime readiness must be reported separately.

## Online ChatGPT prompting (operator-controlled)

WebView2 already opens real online ChatGPT sessions. One operator
may use `Send once` for a reviewed draft **only after saving the
exact existing ordinary** `https://chatgpt.com/c/<uuid>` conversation
link in that workspace. Rust rejects a missing/foreign/homepage/
temporary-chat target and the queued page action rechecks the full
saved URL to prevent accidental cross-chat delivery. The user must
still review the actual conversation and supply the response for
continuation. This does not enable AI to extract ChatGPT answers
or automate unattended consumer Web prompting.

## Efficient ChatGPT status monitoring

The in-app, **control-only** watch now uses adaptive checks instead
of a permanent six-second interval. With no watched conversation,
there is no active timer. A waiting chat starts with a three-second
check and backs off as far as 30 seconds; ongoing generation also
backs off, one native read at a time. Hidden desktop views pause.
The watch stops after at most 15 minutes or when the UI suggests
completion, error or uncertainty. It never calls a model, reads
the response body or automatically submits the next prompt.
The source is committed; installed Windows CPU/RAM and browser
acceptance remain unverified.

## Durable operator prompt replay protection

The operator-only ChatGPT `Send once` path now reserves its
exact workspace, saved ordinary conversation and reviewed
prompt **before** asking WebView2 to perform the one-shot UI
action. The original app-local `PromptOutbox` holds only
digests and an opaque attempt ID (no chat URL or prompt text).
A second attempt of the same combination is rejected across
desktop restarts. Each durable record remains
`ATTEMPT_UNVERIFIED`: it does not prove ChatGPT delivery,
response completion or QA. Distinct operator-reviewed followups
still use the existing manual continuation and permissions.
Native/Windows integration tests were not run for this source.

## Manually reviewed ChatGPT follow-ups and recovery

A pending explicit `Send once` attempt now blocks another
prompt in the same workspace until operator review. When the
operator pastes the reply and chooses **Prepare next draft**,
the native host checks the exact existing chat and original
draft hash, records `REVIEWED_UNVERIFIED` in the original
app-local PromptOutbox, then replaces the native draft.
A different operator-reviewed follow-up (including identical
literal text in a later turn) can then be sent through the
same explicit user action. Neither UI hint nor model text
claims that a ChatGPT reply was authenticated.

After desktop restart, session-memory drafts cannot be
recreated from UI hints. A **Confirm reviewed response**
action in Browser Activity requires an actual native
operator confirmation and current saved chat to release
one held attempt without reading response text or sending
another prompt. Ambiguous records and stale file locks
remain held pending safe reconciliation. This is
SOURCE_COMMITTED/TEST_AUTHORED_NOT_RUN, not live Windows
or full consumer ChatGPT automation acceptance.

## Safe recovery from an interrupted outbox write

The existing app-local `PromptOutbox` now records its
own process identity and a random token inside the
exclusive lock directory. If a gateway crashes, the
Browser Activity panel has an opt-in
**Recover interrupted outbox lock** action. Native
Windows operator confirmation is required, and the
previous lock holder must be demonstrably dead.
Unidentified or live owners are never auto-cleared.

This repairs only a stale filesystem lock: existing
pending ChatGPT sends, approvals, manual review holds
and STOP conditions remain in force. There is no
automatic retry or response extraction. The change
is source-only; Windows/Node/actual crash recovery
acceptance has not been executed on this revision.
