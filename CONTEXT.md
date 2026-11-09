# LazyPrompting — Project Context

## Product identity
A lightweight, context-aware continuation supervisor for long-running ChatGPT-centered GitHub engineering. It reads verified result state, preserves approved goals and constraints, then issues the most useful next work instruction without asking the user to type "ya lanjutkan" repeatedly.

## In scope
- Evidence-aware progress evaluation; guardrails and task budgets.
- Structured continuation protocol; deterministic policy with selective low-cost model fallback.
- GitHub source-of-truth, checkpoints and no-progress detection.
- Replaceable transport adapters, beginning with official API/Codex-supported surfaces.
- Isolated Harness² experiments and exact-source proof reporting.

## Deferred / not yet proven
- Lightpanda controlling any particular authenticated site.
- Continuous autonomous operation of ChatGPT Web through page scraping.
- Browser engine installation or functioning Windows/WSL environment.
- Any real Codex task or GitHub output produced through the supervisor.
- Quality gains, token savings, or runtime pass.

## Primary design objective
Preserve **direction**, not just conversation cadence. If Codex says a check failed, the next prompt diagnoses that check; if it passes, choose the highest-impact unfinished authorized task; if nothing improves, stop.

## Ownership
- `AGENTS.md`: agent policy / routing.
- `GITHUB_RULES.md`: branch and mutation/proof policy.
- `docs/architecture/system-contract.md`: modules and flow.
- `docs/architecture/continuation-protocol.md`: canonical message/state contract.
- `docs/governance/security-and-compliance.md`: permissions, host, third-party risks.
- `docs/operations/current-state.md`: one active next-action owner.
