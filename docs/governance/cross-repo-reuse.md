# Cross-Repository Engineering Reuse — Admission Rules

## Goal
Use useful source patterns from other OpenITStudios repositories without importing incompatible product semantics. Source references are read-only; LazyPrompting owns its own code, policy, tests and release evidence.

## Adoption procedure
1. Pin source repository, branch, commit SHA and exact file blob.
2. Name the observed problem in LazyPrompting and a measurable acceptance criterion.
3. Identify the original canonical owner and map it to one LazyPrompting owner.
4. Prefer adapting the contract/pattern over copying implementation; if copying code, check license and dependencies.
5. Preserve capability, permission and recovery behavior; never improve usage by deleting essential functionality.
6. Add negative-control fixtures, document the execution proof ceiling, and commit only on selected Local.
7. Do not declare parity or native PASS from source review.

## Reference patterns
| Reference | Useful contract | LazyPrompting owner | Status |
|---|---|---|---|
| M-LazyDesigner | Four-tool stable MCP Gateway, deferred capability schemas, compact discovery, demand-driven recovery | `src/gateway/` | Source-adapted; live connection not verified |
| M-Lazy-Developer | Harness² frozen cases, source/QA proof tiers, permission lane separation | `.agents/evals/`, `docs/validation/` | Partially adapted |
| M-LazyBuilder-Plugin | Path-owner projection, scoped branch authority and exact evidence | `.agents/permissions/` | Partially adapted |
| M-PRD-Creator | Single canonical state and source ownership | `docs/operations/current-state.md` | Adapted |
| A-MIVUBI-Blockbench | Minimal startup context and domain-specific native acceptance boundary | `AGENTS.md`, `docs/validation/` | Adapted conceptually |

## Current concrete improvement
Added `src/gateway/input-validation.mjs` to enforce the advertised capability schema subset, replacing the earlier key-only check that could accept wrong types. Fixed the capability count projection to reflect actually enabled backends. Added source test cases; not executed.

## Protocol compatibility note
The current Gateway source advertises MCP `2025-03-26`. The MCP specification has evolved, including a 2026-07-28 revision with different discovery/session semantics. Do not claim compatibility with the latest protocol until a deliberate version-specific implementation and conformance review are completed. Preserve existing host compatibility instead of silently switching versions.
