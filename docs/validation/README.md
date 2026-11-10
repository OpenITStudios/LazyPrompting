# Validation and Evidence Router

Verification is scoped. Authored tests, static checks, Windows integration observations, and release acceptance are **different evidence classes**.

| Gate | Command / owner | What it proves |
| --- | --- | --- |
| Repository ownership and import paths | `npm run test:repository` | Static filesystem, version, MCP surface and document-link invariants only |
| Focused source contracts | Relevant `npm run test:*` in root or `apps/desktop` | Only the named Node test on the exact checkout |
| Broad Windows source/native preflight | `npm run preflight:localtest` (manual) | Multiple deterministic Node suites, frontend build and Rust checks/tests on the runner |
| Installed WebView2/pipe/Codex/Lightpanda | [Desktop acceptance](desktop-acceptance-gates.md), [WebView source QA](webview2-source-qa.md) | Actual runtime behavior only when observed in that environment |
| Packaging/source readiness | [Desktop build readiness](desktop-build-readiness.md), [Localtest readiness](localtest-readiness.md) | Criteria, not automatically a PASS receipt |
| Performance/repetition and supervisor quality | [Harness plan](harness-plan.md), [Supervisor evaluation](supervisor-evaluation-2026-11-10.md) | Isolated evaluation evidence with stated limits |
| Historical integration snapshots | `checkpoint-*`, `permission-*`, `chatgpt-probe-evidence/` | Evidence at recorded revisions; not validation of later source |

`localtest-readiness.yml` is manual-only. Never launch it as a side effect of repository cleanup. For current status read [the active checkpoint](../operations/current-state.md).
