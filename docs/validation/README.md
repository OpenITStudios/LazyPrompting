# Validation and Evidence Router

Verification is scoped. Authored tests, static checks, Windows integration observations, and release acceptance are **different evidence classes**.

| Gate | Command / owner | What it proves |
| --- | --- | --- |
| Repository ownership and import paths | `npm run test:repository` | Static filesystem, toolchain/lockfile metadata, MCP surface, import-layer and active-document path invariants only |
| **Proposed Codex-supervised ChatGPT workspace** | [Transport/extension/continuity acceptance gates](codex-chat-workspace-gates.md) | Requirements only; NO tests executed / NO live ChatGPT automation proof |
| Focused source contracts | Relevant `npm run test:*` in root or `apps/desktop` | Only the named Node test on the exact checkout |
| Broad Windows source/native preflight | `npm run preflight:localtest` (manual) | Multiple deterministic Node suites, frontend build and Rust checks/tests on the runner |
| Installed WebView2/pipe/Codex/Lightpanda | [Desktop acceptance](desktop-acceptance-gates.md), [WebView source QA](webview2-source-qa.md) | Actual runtime behavior only when observed in that environment |
| Packaging/source readiness | [Desktop build readiness](desktop-build-readiness.md), [Localtest readiness](localtest-readiness.md) | Criteria, not automatically a PASS receipt |
| Performance/repetition and supervisor quality | [Harness plan](harness-plan.md), [Supervisor evaluation](supervisor-evaluation-2026-11-10.md) | Isolated evaluation evidence with stated limits |
| Historical integration snapshots | `checkpoint-*`, `permission-*`, `chatgpt-probe-evidence/` | Evidence at recorded revisions; not validation of later source |

`localtest-readiness.yml` is manual-only. Never launch it as a side effect of repository cleanup. For current status read [the active checkpoint](../operations/current-state.md).

Recorded read-only source review: [repository structure audit, 2026-11-11](repository-structure-audit-2026-11-11.md). This does not report Node/CI/native PASS.

## Chat-workspace feasibility and fixture evidence

- [Gate 0 decision, 2026-11-11](chat-workspace-gate0-2026-11-11.md) — policy/host feasibility; live ChatGPT automation remains blocked pending verified authorization.
- [Synthetic chat fixture implementation evidence](chat-fixture-2026-11-11.md) — executed Node-only deterministic assertions, no browser/native/chat proof.

Run `npm run test:chat-fixture` for the bounded fixture regression. Do not treat it as a ChatGPT or WebView2 acceptance test.

- [Manifest V3 fixture send/status evidence](chat-extension-fixture-2026-11-11.md) — Node-only content-script/background tests; no real WebView2 or ChatGPT session claim.

`npm run test:browser-extension-fixture` checks the source extension on a synthetic DOM. It does not install an extension on the user's system.

- [Synthetic MCP / host adapter contract](chat-fixture-mcp-bridge-2026-11-11.md) — new gateway fixture-only capabilities, source assertions and unresolved native integration. Run `npm run test:fixture-mcp-bridge` to verify the source contract; current exact-tree test status is NOT_EXECUTED.

- [Debug-only Rust/WebView2 source fixture bridge](chat-fixture-native-webview-2026-11-11.md) — two additional Node source tests executed; native Rust and installed Windows integration NOT_EXECUTED.

Commands: `npm run test:native-window-fixture` and `npm run test:native-fixture-source`.

- [Fixture extension integrity and profile isolation](chat-fixture-native-webview-2026-11-11.md#follow-up-source-hardening--fixture-profile-isolation-and-integrity) — `npm run test:fixture-extension-integrity` (Node assets only; Rust/Windows not executed).

- [Native-owned direct-send fixture](chat-fixture-direct-send-2026-11-11.md) — 167 Node/VM assertions, no Rust/Windows/live ChatGPT claims. Commands: `npm run test:native-window-fixture`, `npm run test:native-fixture-source`, `npm run test:fixture-extension-integrity` (already wired into manual preflight).

- [Scoped, read-only GitHub progress and receipt QA](github-progress-scope-2026-11-11.md) — `npm run test:github-progress-scope`: 52 fake-HTTP/Node assertions; no real GitHub call, native host or ChatGPT integration.
