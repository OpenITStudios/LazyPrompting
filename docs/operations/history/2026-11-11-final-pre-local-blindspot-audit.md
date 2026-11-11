# Final pre-local blindspot audit - 11 November 2026

Archived verbatim from docs/operations/current-state.md. The Windows run that
superseded it is recorded in the current file.

## Final pre-local blindspot audit — 11 November 2026

- **Fixed an observed source race:** `GitHubEvidence.changesSince` now
  re-reads the exact approved HEAD even on the *unchanged* path.
  Previously a branch moving between first and second reads could
  still produce `SOURCE_HEAD_UNCHANGED`. Executed Linux Node:
  **8/8** adversarial assertions PASS, plus **24** scoped QA and
  **17** runtime-constructor assertions with synthetic external providers.
  This is a consistency check, not a transactional GitHub snapshot
  or independent QA. See [focused test](../validation/github-head-stability-2026-11-11.md).
- **Corrected outdated localtest instructions:** default `main`
  already has the **manual-only** workflow; the missing evidence
  is the actual Windows run at a pinned `Local` SHA, not CI
  registration.
- **Still P0 before production:** `createVerifiedGoalRuntimeWithGitHub`
  is not instantiated by the installed native gateway; its source
  composition is not proof that a signed-in Codex turn has a trusted
  QA/final-result receipt. Windows Cargo/NSIS/native MCP and the
  permitted worker transport remain unverified. Preserve STOP and
  all `nextPromptAllowed=false` gates.
