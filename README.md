# LazyPrompting

**A context-aware desktop supervisor for efficient, authorized Codex workflows.**

LazyPrompting is an OpenITStudios project intended to help an operator set a development goal once, retain decisions and verified progress, and continue the **next useful task** without repeatedly supplying generic prompts. It is **not** another AI model or a bot that blindly clicks through ChatGPT.

> **Development status — November 2026:** UI/UX design approved; backend foundations committed on `Local`. The native gateway, authenticated IPC, Codex transport, Lightpanda integration and end-to-end operation are **not complete or runtime-verified**. This repository is a development handoff, not a working automation release.

## Primary goal

**Turn an approved engineering goal into a controlled, evidence-based sequence of Codex tasks, with minimal wasted AI usage.**

The intended loop:

1. **Goal:** operator defines objective, repository/branch, constraints, budget and completion criteria.
2. **Observe:** read the latest supported Codex result and exact GitHub evidence.
3. **Decide:** use deterministic rules first to continue, fix a failure, wait, request approval, or stop.
4. **Dispatch:** send only the necessary bounded context through an official, authorized Codex interface.
5. **Verify and checkpoint:** distinguish source changes, authored tests, executed tests and real runtime proof; record the smallest useful state.
6. **Stop:** end on completion, missing permission, repeated non-progress, unsafe state or exhausted budget.

**Codex is the only intended AI execution agent.** There is no AI candidate selection, secondary model requirement or unattended ChatGPT Web scraping.

## Intended product

| Area | Design / role | Current evidence |
| --- | --- | --- |
| Desktop | Tauri + Svelte UI with 10 workspaces | UI source and local WebView2 preview foundation; not 10 proven browser sessions |
| Embedded viewer | WebView2 | Native child-view code; Windows runtime unverified |
| Supervisor | Deterministic, evidence-aware continuation | Source modules and authored tests; end-to-end operation unverified |
| MCP gateway | Bounded tools and capability routing | Node gateway source and Rust session/stdio foundations |
| AI execution | Official Codex interface only | Real Codex host transport not connected |
| Browser automation | Lightpanda via CDP, isolated from WebView2 | Adapter and diagnostic source; live integration not verified |
| Security | Native host authority, authenticated IPC and scoped grants | Framing, named-pipe and HMAC primitives; authenticated channel not connected |
| Resource control | Up to 10 workspaces, cancellation and cost budgets | Policies/source foundations; load behavior unverified |

WebView2 and Lightpanda are **separate browser runtimes**. They do not share tabs, cookies or sessions by default.

## Non-negotiable rules

- **One goal, one canonical progress owner:** GitHub is authoritative for code; [current state](docs/operations/current-state.md) is the active continuation checkpoint.
- **No wasted AI work:** deterministic transitions before inference; compact context, bounded retries, deduplication and STOP conditions.
- **Evidence over claims:** a commit does not mean a build passed; a CDP handshake does not mean browser authorization.
- **Fail closed:** no browser actions without authenticated host approval, scoped grants, verified backend identity and explicit operator authority.
- **No unattended ChatGPT Web scraping or prompt/response extraction.** Use documented Codex/OpenAI interfaces.
- **No silent repository changes:** preserve user-selected branch, approval gates and protected branches.

## Development and handoff

**Working branch:** `Local`. `main` remains stable; `Harness` is retained. UI/UX design work is frozen unless the operator reopens it.

The ChatGPT-side source-development phase was stopped for a local handoff. **No Windows local test or GitHub Actions run was performed for the latest native changes.**

The first local engineering pass should establish build evidence and identify missing runtime integration, **not assume the application is end-to-end ready**:

1. Compile the Windows Tauri application and build the Svelte frontend; address actual errors.
2. Finish gateway resource packaging, dependency closure and trusted executable provenance.
3. Complete Windows named-pipe ACL, child PID binding, protected secret delivery, HMAC handshake, replay prevention and scoped grants.
4. Connect the official Codex MCP path to authorized Lightpanda operations; keep browser tools disabled until security gates are met.
5. Validate workspace isolation, cancellation, recovery and bounded resource usage.

See [Local-test readiness](docs/validation/localtest-readiness.md) for the existing acceptance checklist. This is a **handoff checklist, not a PASS report**.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/desktop/` | Svelte/Tauri desktop UI and native host |
| `src/gateway/` | MCP gateway, capability routing and protocol contracts |
| `src/browser/` | Browser adapters and workspace isolation foundations |
| `src/supervisor/` | Checkpointing and continuation logic |
| `scripts/` | Deterministic preparation and preflight utilities |
| `docs/architecture/` | Technical boundaries and transport contracts |
| `docs/governance/` | Permissions, security and proof rules |
| `docs/operations/current-state.md` | Single active engineering checkpoint |

## Canonical documents

- [Project context](CONTEXT.md) — stable goal and product boundaries
- [Agent instructions](AGENTS.md) and [GitHub rules](GITHUB_RULES.md) — branch, permission and evidence policy
- [System contract](docs/architecture/system-contract.md) — intended architecture and IPC security gates
- [Documentation index](docs/README.md) — routing to canonical owners
- [Current state](docs/operations/current-state.md) — most recent implementation checkpoint and unresolved work

**Project principle:** advance the approved goal with the smallest defensible next action; never confuse authored code with verified operation.
