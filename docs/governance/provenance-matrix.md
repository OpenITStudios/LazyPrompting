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
- Branch conventions differ across repositories. `Local` is the user's selected working branch; `Harness` retains the earlier foundation snapshot.
- No source code or third-party dependency is imported.
- License/provenance review required before reuse of external code.

Cross-project material is design reference, not instruction authority for LazyPrompting.

## Additional pinned skill/permission source review (2026-11-10)

| Reference | Exact blob SHA | Concrete finding | LazyPrompting adaptation | Remaining proof |
|---|---|---|---|---|
| M-Lazy-Developer `.agents/skill-registry.json` | `1c66b25fa77a15b3baf4af53e9ecf420471ac00b` | Exactly two *product-specific* active skills, SPEC/SOURCES/EVAL, permission/eval references | Do not copy Bedrock skill count; future LazyPrompting skills require independent semantic ownership and evaluation | Skill registry not yet admitted |
| M-Lazy-Developer `.agents/permissions/path-access.json` | `7be58c63cfe2bf521b3763b4ec896302454b2ee1` | Per-lane read/write scopes, specialized working-copy boundaries | Deny-by-default local path-owner and explicit write preflight | Trusted operation broker not implemented |
| M-LazyDesigner `docs/04-system/agent-rules.md` | `c6791ff6591222932f01eb031552446f975d9d53` | Eight conditional engineering lenses, no implicit host/plugin capability | Eight-lens independent root policy | Applicability checks not automated |
| M-LazyBuilder-Plugin `.agents/permissions/path-access.json` | `14efed5488cd674adafe36991d8a0a693614d6d0` | Canonical owner per path and explicit path coverage | `.agents/permissions/path-access.json` with exact or subtree ownership | No tracked-path coverage runner |
| A-MIVUBI-Blockbench `AGENTS.md` | `8abf5659a32b24ca94d035f21a7e6fb304348153` | Small startup context, canonical director skill, native proof after runtime changes | Minimal boot and deferred real integration acceptance | Domain-specific director is not imported |

### Alignment decision

**Parity is about independently owned engineering discipline, not a literal copy of all source files.** The references have mutually incompatible product-specific skill counts, branch roles and runtime gates. A literal mechanical 1:1 copy would violate at least one of them. LazyPrompting retains the common invariants: selected Local authority, canonical routing, source/proof separation, explicit permissions, smallest relevant skill, frozen Harness² evaluation and safe STOP.

### Remaining gaps
- Audit complete active skill contents and eval contracts only if the matching LazyPrompting skill is proposed.
- Add tracked-path ownership coverage verification when a source tree exists.
- No native permission broker, agent host or browser implementation.
- No runtime performance or cost benchmark.
