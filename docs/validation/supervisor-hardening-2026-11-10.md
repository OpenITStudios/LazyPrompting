# Supervisor Input Hardening — 2026-11-10

## Exact tested source
`543af59cfd39fa46d3594cb2a4858ed922d51c56` on `Local`.

## Scope and method
Fetched `src/supervisor/decision-engine.mjs` and `tests/fixtures/continuation-cases.json` from the exact GitHub commit. Executed the pure exported function body in isolated JavaScript and compared all expected state/reason/action outcomes, plus zero model calls.

## Outcome
**30/30 cases passed.** The first evaluation after adding validation failed due to an incorrectly escaped control-character regular expression; the expression was corrected and the full corpus rerun. This is function-level proof, not the native Node runner or any integration.

## Added adversarial cases
- Reject malformed/short GitHub SHA.
- Reject control characters in the next action.
- Reject oversized proof fields.
- Reject oversized goal ID.
- Reject control characters in preserve constraints.
- Reject oversized action allowlist.

## Residual limitations
- SHA format does not establish SHA existence or ancestry.
- Input shape validation is not a complete schema or prompt-injection defense.
- A `verified: true` flag is trusted by this function; the reconciler must produce it using real evidence.
- STOP/PAUSE and permission checks must also be enforced by the actual executor.
- No durable checkpoint, trusted broker, official transport or browser runtime exists.
