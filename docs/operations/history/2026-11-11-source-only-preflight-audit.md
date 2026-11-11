# Source-only preflight audit - 11 November 2026

Archived verbatim from docs/operations/current-state.md. The equivalent Windows
gates were executed on 12 November 2026; the current file holds the live result.

## Latest source-only preflight audit — 11 November 2026

- Manual Windows workflow is registered on default `main`, restricted to
  a supplied exact `Local` HEAD. The connected GitHub tool set cannot
  create a new workflow dispatch; neither this conversation nor earlier
  commits constitute a Windows CI run.
- Static GitHub tree verification scanned all **110 active documentation
  files**, **196 relative links**, **92 `src/` JavaScript modules**
  and **81 relative imports**, with no missing paths or transport-to-gateway
  dependency inversion found. This is not an executed npm/Cargo suite.
- The old repository checker skipped test entrypoints written as
  `node --test ...` and later commands in `&& node ...` chains.
  Its validation now traverses **all declared Node entrypoints** instead
  of only the first simple script path. A separate isolated Node parser
  suite passed 25 assertions. All **99 existing npm scripts with 103
  entrypoints** passed a static tree/source check, before adding the
  new parser test script. See
  [validation evidence](../validation/npm-script-entrypoints-2026-11-11.md).
- **Next:** one user-triggered Windows Actions preflight is still
  required to obtain real Cargo, Vite and Node exit evidence on the
  pinned `Local` commit. No automated ChatGPT Chat website operation is
  enabled by this source validation.

