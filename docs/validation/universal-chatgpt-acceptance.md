# Universal AI → Ordinary ChatGPT — Acceptance Gates

**Status:** product acceptance specification, **NOT_EXECUTED** on the new design. **Authority:** [universal chat-first contract](../architecture/universal-chatgpt-workflow.md). The older [Codex chat-workspace gates](codex-chat-workspace-gates.md) remain a *historical provider-specific fixture design*; [Universal Agent migration gates](universal-agent-migration-gates.md) test execution workers, not consumer ChatGPT sessions.

## Evidence classes

`SOURCE_REVIEWED`, `SOURCE_COMMITTED`, `EXECUTED_TEST_PASS/FAIL`, `LIVE_INTEGRATION_VERIFIED`, `PRODUCT_ACCEPTED` are distinct. An old Windows smoke, a passed synthetic DOM test, a connected MCP client, a ChatGPT webpage, and a verified provider worker are different kinds of evidence.

| Gate | Exact condition | Failure disposition |
| --- | --- | --- |
| U0 — source baseline | HEAD pinned; `npm run test:repository`, browser-address guard test, Node/desktop checks and Windows Cargo/NSIS preflight executed on **same** revision | `NOT_EXECUTED` or `BLOCKED` |
| U1 — universal client | Codex and OpenCode receive the same four public tools and `workspace_chat.prepare_handoff` schema; both use an authenticated native client lease; reject second-client workspace takeover. Other clients remain future gates | Client-specific `UNSUPPORTED`; do not weaken trust |
| U2 — role isolation | MCP client identity != worker profile != browser tab != ChatGPT conversation; no model flag changes native scope, STOP, provider or permissions | `BLOCKED`; no dispatch |
| U3 — ordinary persistent chat | User explicitly bookmarks a canonical `/c/<uuid>` conversation URL, restarts, and requests reopening it; deny foreign/temporary URLs, corrupt bookmarks, cross-workspace duplicates and active-tab overwrite. URL navigation alone is **not** account/session verification | `PAUSED_NEEDS_USER` until account/chat is confirmed |
| U4 — supported in-thread app | In a manually hosted ChatGPT chat, supported plugin/tool invocation and `ui/message` follow-up are measured per turn and permission; app selection/rebinding not assumed persistent | `HOST_UNSUPPORTED` or manual continuation |
| U5 — unattended external transport | Documented service authorization, official host capabilities, exact session/turn IDs, authenticated send/observe/lookup and no scrape/private cookie API; **must pass before any live automatic send** | `BLOCKED_COMPLIANCE / HOST_UNSUPPORTED` |
| U6 — evidence & recovery | No double sends, no false DONE, exact SHA/QA receipts, durable outbox, stale/unknown outcome held, original ordinary chat preferred after crash | `RECONCILE_REQUIRED` |
| U7 — scale | 1, 2, 5, 10 workspace tests: RAM/CPU, sign-in shared profile, focus, profile isolation assumptions, mixed clients, STOP, restart and no cross-workspace data leakage | `NOT_ACCEPTED` |

### Adversarial regression matrix

1. A different MCP client claims an existing live workspace or goal; ownership/lease must deny the second caller.
2. An OpenCode MCP client is incorrectly advertised as an executable OpenCode worker; reject without side effects. Do not enable other providers during the Codex/OpenCode pilot.
3. A provider changes mid-goal or an adapter claims unsupported pause/cancel/turn ID; reject, never silently substitute.
4. A WebView ChatGPT URL has `temporary-chat` or similar query; navigation denied. Account-side mode must still be checked independently.
5. App restarts with a pending turn and missing host receipt; explicitly reopening a saved URL does not create a chat or replay a prompt. Do not treat navigation as output/identity attestation.
6. A ChatGPT-hosted plugin `ui/message` returns but a separate tab is targeted; treat as unsupported, not as a cross-chat guarantee.
7. Model text claims "tests passed" with no host QA; acceptance stays unverified.
8. GitHub HEAD advances, branch changes or source diff is outside scope; pause until pinned comparison and authorization.
9. Ten browser views share account cookies; ensure UI does not claim security isolation between them.
10. Worker V2 read-only AppContainer fails OS denial probe; keep execution disabled.
11. A quota/rate limit occurs; wait for quota rather than silently creating replacement chat.
12. No compatible ChatGPT consumer final-turn channel is found; manual in-chat workflow remains usable, automation remains disabled.

## Codex/OpenCode manual-handoff source increment (12 November)

Both priority clients use the **same installed native MCP capability**, `workspace_chat.prepare_handoff`. It must validate exact workspace, bounded goal/acceptance, consistent project references and reject caller-provided `approved`/`send` flags. Host PID+workspace lease admission occurs **before** draft generation, with no browser navigation or ChatGPT network calls. A returned manual draft is *not* an authenticated ChatGPT turn or evidence of output completion.

Cargo unit tests cover formatter and client-independent schema discovery, but source inclusion alone does not prove installed Windows admission; exercise two real clients on disjoint workspaces, then test an attempted cross-client takeover. Acceptance remains **NOT_EXECUTED** for the new SHA until those native tests run.

## Manual Code Mode continuation source acceptance — 16 November 2026

This source increment shares one native `PendingManualHandoffs`
inbox between the UI and Code Mode. The bounded Code Mode
`handoff.prepare` and `handoff.continue` effects remain terminal,
host-lease scoped and reviewable; neither invokes ChatGPT Web.

Required independent cases on the **same checked-out SHA**:

1. Client A prepares a draft via Code Mode; its leased Browser 01 UI receives the original native fingerprint.
2. Operator manually copies or invokes Send once, then pastes a response. The native CAS advances only the matching fingerprint; the previous pending draft cannot be replayed.
3. Code Mode continuation against an absent, stale, foreign-workspace or already replaced fingerprint must be rejected **before** a second effect.
4. Unknown native callback or lost response must leave the canonical inbox inspectable; no implicit retry, double prompt, QA PASS, authenticated ChatGPT result or automatic follow-up.
5. Closing a manual draft, restarting desktop, switching workspaces and an invalid/oversized UTF-8 reply must not promote a pending draft into DONE or falsely preserve an authenticated ChatGPT turn.

Rust and Node negative fixtures have been **authored, not executed**
at this SHA. User-PC Tauri build, installed Code Mode/MCP lease,
operator send/copy, a real persistent ChatGPT chat and UI recovery
acceptance remain `NOT_EXECUTED`. The separate external ChatGPT
transport gate U5 remains blocked and is not satisfied by a manual cycle.

## Required proof sequence

First keep the **existing** four public tools and Codex V1 behavior unchanged; fix any deterministic repository preflight blocker and register the browser-address regression. Then execute Node, desktop build, Rust and installed Windows tests on one pinned SHA. Independently exercise multi-client MCP and one ordinary ChatGPT chat in user-visible manual mode. Evaluate user-initiated in-thread app capabilities only when supported. Never run automatic ChatGPT Web prompts, session extraction or hidden DOM scraping as an acceptance shortcut.

Worker execution acceptance belongs to [Universal Agent migration gates](universal-agent-migration-gates.md) and must not be counted as ChatGPT consumer acceptance. The [11 November Gate 0 decision](chatgpt-consumer-transport-gate0-2026-11-11.md) remains in force until a different documented authorized path is established.

**Exit:** publish the pinned SHA, exact commands/OS, observed test results, independent host receipts and explicit unresolved gates. A proposal or commit alone does not mean `PRODUCT_ACCEPTED`.

## Exact-chat binding for online operator prompting (16 Nov 2026)

The native `operator_send_once` must fail before its attempt ledger
or WebView script when the selected workspace has no saved canonical
ordinary ChatGPT `/c/<uuid>` URL, is displaying the homepage or
Temporary Chat, or points at a different existing conversation.
The queued send script compares the full current `location.href`
with the saved exact URL again at execution time; it cannot silently
send into a second chat after a navigation race. The Svelte button
is unavailable until a saved bookmark exists.

Rust negative tests are **authored, NOT_EXECUTED**. Future Windows
acceptance must check the exact sent/unsent behavior after bookmark
change, URL redirects, tab switches, restart and user-written drafts.
A WebView URL is not a verified signed-in identity or ChatGPT response.
