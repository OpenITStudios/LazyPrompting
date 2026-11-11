# Full npm script entrypoint preflight audit — 11 November 2026

**Development branch:** `OpenITStudios/LazyPrompting:Local`.  
**Source baseline before this fix:** `341aa82f864d0b7c92eab0a779526b6146a2e1bc`.  
**Evidence:** isolated Node executable parser tests, plus read-only GitHub tree/source audit. **Not** full npm preflight, a Windows CI run, Rust compilation, native MCP integration or a product acceptance test.

## Confirmed gap

`scripts/verify-repository.mjs` previously recognized only the **first**
simple `node path.mjs` entrypoint in each `package.json` script.
It did **not** validate:

- `node --test tests/goal-run-pause.test.mjs`;
- `node --test tests/goal-run-scope-fingerprint.test.mjs tests/goal-run-recovery.test.mjs`;
- subsequent scripts in `node tests/a.mjs && node tests/b.mjs`.

A missing filename in one of those cases could therefore pass the
repository structure check and fail only later during manual Windows
preflight.

## Minimal change

`scripts/script-entrypoints.mjs` now parses the whole source-controlled
command, including direct Node scripts, `--test` with multiple files,
and explicit `&& node` chains. Paths must be bounded `.mjs` entries
under `src/`, `scripts/`, `tests/` or `.agents/`, with no traversal,
unsupported arguments, alternate shell commands or duplicate targets.

`scripts/verify-repository.mjs` now requires each npm script to use
this reviewed command grammar and checks that **every** parsed target
exists. The parser has a dedicated `test:script-entrypoints` script,
included in the existing manual `preflight:localtest` sequence.

Future command syntax such as Node flags or non-Node pipelines is
intentionally denied until its verification semantics receive a
source review. Existing project scripts do not require those forms.

## Verification

| Check | Result and limitation |
| --- | --- |
| `node tests/run-script-entrypoints.mjs` on isolated Linux Node 22.16.0 | **25/25 assertions PASS**; direct scripts, `--test`, chained commands, invalid paths/shell/flags |
| GitHub `Local` root `package.json` audit at pinned baseline | **99 scripts / 103 entrypoint references**, all parsed and found in the repository tree; source-level check, not test execution |
| GitHub active Markdown link audit | **110 files / 196 relative links**, no missing target detected |
| GitHub `src/` JavaScript import audit | **92 modules / 81 relative import references**, no missing target or forbidden transport-to-gateway dependency detected |
| Combined `npm run test:repository`, `npm run preflight:localtest` | **NOT_EXECUTED** on a full checkout in this chat |
| Windows Rust, desktop installer, native MCP, live Codex/ChatGPT | **NOT_EXECUTED / NOT_VERIFIED** |

The isolated parser and its test were checked with `node --check` and
SHA-pinned through `git hash-object`; source Git blobs match the
executed local bytes. All repository-path checks use the exact
GitHub `Local` tree. The parser's role is early source detection,
not evidence that an OS or toolchain can execute the selected script.

## Remaining gate

The manual Windows workflow is registered on default `main`, but no
new workflow dispatch API is available through the connected GitHub
tools in this chat. It requires a **user-initiated** GitHub Actions
run with the current exact `Local` SHA, or another approved Windows
runner. Until that produces successful npm/Cargo logs on a pinned
revision, Windows preflight and installed-product readiness remain
unverified. No implicit CI, merge, deployment or consumer ChatGPT Web
automation was performed.
