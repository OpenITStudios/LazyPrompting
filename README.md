# LazyPrompting

**Operator-controlled desktop orchestration for evidence-aware Codex continuation.**

> Development branch: `Local`. `main` stays stable; the historical `Harness` branch is retained. Selected Windows behavior has been exercised in earlier recorded tests, but a committed source tree is not a production release or proof of full installed ten-workspace acceptance. See [current state](docs/operations/current-state.md) and [historical evidence](docs/operations/history/2026-11-10-full-checkpoint.md).

## Product goal

An operator defines a scoped engineering goal once. LazyPrompting observes real Codex/Git evidence, chooses a minimal next action, dispatches only what has been authorized, reconciles exact receipts, and checkpoints or stops. No blind `lanjutkan` loop, unapproved cross-repository write, or secondary reasoning model is part of the normal design.

## Architecture at a glance

| Layer | Canonical location | Responsibility |
| --- | --- | --- |
| Desktop | `apps/desktop/` | Svelte shell, Tauri/Rust host and ten WebView2 workspace views |
| Installed MCP client facade | `apps/desktop/src-tauri/src/mcp_stdio_host.rs` | Four-tool stdio interface for Codex; native browser and goal-run capabilities |
| Desktop-owned Node gateway | `src/gateway/` | Separate internal MCP tool catalog, routing and scoped native transport |
| Supervisor and lifecycle | `src/supervisor/`, `src/prompt/`, `src/runtime/` | Checkpoints, decisions, workspaces, durable recovery and STOP |
| Codex and browser integrations | `src/transport/`, `src/browser/`, `src/integrations/` | Official Codex transport, isolated browser adapters and evidence receipts |
| Authority | `src/governance/`, native Rust host | Host-owned permission, single-use grants and replay safeguards |
| Compatibility and experiments | `src/mcp/` | Legacy Node MCP and opt-in synthetic ChatGPT transport probe, **not** production desktop entrypoints |

Both current MCP facades use `status`, `search_capabilities`, `describe_capability`, `invoke_capability`, but their catalogs, processes and trust conditions differ. [MCP architecture](mcp/ARCHITECTURE.md) is the canonical map. WebView2 and Lightpanda are separate browser runtimes.

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
- [Agent policy](AGENTS.md) and [GitHub rules](GITHUB_RULES.md) — exact branch, scope, evidence and stop requirements.
- [Current checkpoint](docs/operations/current-state.md) — sole active continuation owner.
- [MCP architecture](mcp/ARCHITECTURE.md) and [system contract](docs/architecture/system-contract.md) — trust and implementation boundaries.

Source work and runtime readiness must be reported separately.
