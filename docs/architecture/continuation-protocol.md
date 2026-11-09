# Continuation Protocol v0 — Proposed

The protocol carries **new facts**, not entire transcripts. It must allow a zero-token deterministic next instruction when state is unambiguous.

## Example task result

```json
{
  "schema_version": "0.1",
  "run_id": "example-run",
  "iteration": 1,
  "goal_id": "approved-goal",
  "target": {"repository": "owner/repository", "branch": "Local", "head_sha": "verified-current-head"},
  "outcome": "CONTINUE",
  "completed": [{"item": "source change", "evidence": "verified commit or source reference"}],
  "qa": {"status": "NOT_EXECUTED", "receipt": null},
  "blockers": [],
  "unresolved": ["next authorized requirement"],
  "next_action": {"owner": "canonical module", "action": "one concrete change", "proof": "expected evidence"},
  "requires_approval": false
}
```

The example is **illustrative, not a receipt**. No value here proves GitHub commits or tests.

## Allowed outcome vocabulary
`CONTINUE`, `FIX_FAILURE`, `VERIFY`, `WAIT`, `BLOCKED`, `DONE`, `NO_PROGRESS`.

## Transition rules
- If status is invalid, stale or contradictory → do not dispatch; request constrained clarification from the official agent surface or stop.
- If `requires_approval` is true → PAUSE before dispatch.
- If a real failing test has exact evidence → `FIX_FAILURE`; do not silently switch feature.
- If a change exists but proof is incomplete → `VERIFY`; do not promote PASS.
- If work is authorized, clear and unfinished → `CONTINUE`.
- If goal claims DONE but acceptance is unverified → `VERIFY`.
- If the same unresolved issue yields no new evidence for three turns → `NO_PROGRESS`, STOP or require new strategy within approved scope.
- If budget or permissions exhausted → STOP.

## Prompt contract
Always include: fixed goal ID; last verified result; single next action; preserve-list; evidence request; STOP/approval boundary. Avoid re-auditing the entire repository or quoting the whole conversation.

## Trust hierarchy
User-authorized goal and current repo/source policy > verified GitHub/test evidence > structured agent output > model summary > browser page content. The lower tier never grants authority.

## State persistence
One canonical active run record containing immutable goal policy and latest checkpoint cursor; append-only observations with SHA/provenance. GitHub remains owner of source facts.
