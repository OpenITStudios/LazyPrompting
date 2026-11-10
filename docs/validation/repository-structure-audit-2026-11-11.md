# LazyPrompting repository and MCP structure review — 2026-11-11

## Scope

Repository: `OpenITStudios/LazyPrompting`, branch `Local`.
Reviewed structural commits: `4bb60ab133c5a5df57e7b98f1a3719aff7b5d848` and `1d2fdc0fdd50d4b0ab569fcd40330c72de88f0f2`. The final manual preflight/source-checker tightening is an adjacent source change, not independently native-tested.

## Observed source facts

- The root contains the essential governance files, two npm lockfiles, Rust Cargo manifest/lockfile, a documented development Node pin and an independently pinned Windows gateway Node executable target.
- The installed Rust desktop MCP facade, internal Node gateway, legacy Node server and synthetic ChatGPT probe have distinct owners and entrypoints. Both contemporary facades expose four tool names but different capability catalogs and security boundaries.
- The shared `BackendLifecycle` implementation was moved byte-identically to `src/runtime/` with the older gateway path retained as a single re-export. Its normal transport caller now imports runtime directly.
- The active state was shortened and the complete historic checkpoint was preserved using its original Git blob. This preserves historical evidence without a competing current continuation owner.
- A read-only GitHub source review found **85 active Markdown documents** (excluding the preserved historical checkpoint). Of **84 relative Markdown link destinations** inspected, none pointed to a missing repository path. URL fragment/anchor validity, remote links and embedded HTML are outside this check.
- Source inspections previously covered 80 Node `src/*.mjs` files in the base tree, without missing relative import targets. The move adds a new `src/runtime/backend-lifecycle.mjs` entry. This is source graph review, not module execution.
- The manual Windows workflow originally used `npm install` for desktop alone; the follow-up tightens its source definition to `npm ci` for both root and desktop with Node 22.16.0.

## Explicit proof limit

`SOURCE_REVIEWED` and `SOURCE_COMMITTED` only. There is no claim that `npm run test:repository`, `npm run preflight:localtest`, Cargo, the installer, Windows WebView2, Lightpanda or live MCP were executed on these exact commits. Prior Windows evidence is recorded separately in the archived checkpoint. CI is manual-only and was not dispatched.

## Remaining engineering risk

- The source-level checker does not validate URL fragments, external links, runtime dependency behavior, module load semantics or installed Windows/security acceptance.
- A public repository `LICENSE` should only be selected under an explicit licensing decision; repository cleanup must not invent it.
- No automatic production merge, deployment, plugin installation, cross-repo write or ChatGPT Web scraping was authorized.

## Navigation

[MCP owner map](../../mcp/ARCHITECTURE.md) · [Documentation router](../README.md) · [Active checkpoint](../operations/current-state.md) · [Historical full checkpoint](../operations/history/2026-11-10-full-checkpoint.md)
