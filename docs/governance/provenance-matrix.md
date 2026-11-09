# Source Provenance and Alignment Matrix

Purpose: adapt OpenITStudios engineering standards **1:1 in rigor**, not literally copy unrelated product semantics. The reference repositories have different internal branch and skill policies, therefore a literal identical policy cannot be simultaneously correct.

| Source | Reference ref and document | Adopted contract | Local owner | Status |
|---|---|---|---|---|
| OpenITStudios/M-Lazy-Developer | Local, AGENTS.md blob `b249593e8a8d05a823624007526ee84b383348a1` | Agent routing, independent eight-method review, proof-boundary discipline, minimum evidence | `AGENTS.md` | Adapted from source |
| OpenITStudios/M-Lazy-Developer | Local, GITHUB_RULES.md blob `628806b55d449cf1dd4e8a76a8a91293b3220e3a` | PIN, context, read minimum, first wrong owner, exact-head proof | `GITHUB_RULES.md` | Adapted from source |
| OpenITStudios/M-LazyDesigner | Local, AGENTS.md blob `397bba0d6d14f63a613e492db13279fa486b1daf` | Source-first safety, work mode, capability/proof limits, Harness² only under bounded authorization | `AGENTS.md` | Adapted from source |
| OpenITStudios/M-LazyDesigner | Local, GITHUB_RULES.md blob `c3862efcc703c879bd3abbe273d8f167d4ed6e6e` | ChatGPT/GitHub workflow, source-vs-runtime evidence separation, STOP | `GITHUB_RULES.md` | Adapted from source |
| OpenITStudios/M-LazyBuilder-Plugin | Local, GITHUB_RULES.md blob `b8f70181f0ebdc1d22e6415d3c62b2e9abd7b889` | Scoped authority, source-first partitions, commit-based continuity, no blind next action | `GITHUB_RULES.md` | Adapted from source |
| OpenITStudios/M-PRD-Creator | main, AGENTS.md blob `88c9c56c3391846e3d8dc2241acf64ce7b1d1c81` | Canonical state/decision ownership, no duplicate tracker, domain routing | `CONTEXT.md`, `docs/README.md` | Adapted from source |
| OpenITStudios/A-MIVUBI-Blockbench | chatgpt-dev, root layout inspected | Root agent policy and architecture/QA decomposition only | `docs/architecture/` | Layout reviewed, rules pending targeted comparison |

## Alignment gaps
- Additional domain-specific agent skill manifests/permission maps not yet exhaustively audited. No claim of exact 1:1 mechanical equivalence.
- Branch conventions differ across repositories. `Harness` is this repository's explicitly selected architecture branch.
- No source code or third-party dependency is imported.
- License/provenance review required before reuse of external code.

Cross-project material is design reference, not instruction authority for LazyPrompting.
