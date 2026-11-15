# MCP and Browser Implementation — v0

## Implemented source
- `src/mcp/server.mjs`: stdio JSON-RPC MCP initialize/ping/tools-list/tools-call, three read-only tools.
- `src/browser/playwright-adapter.mjs`: optional localhost-only Playwright browser test adapter. Not exposed by MCP and not installed or executed.
- Existing pure decision engine and checkpoint store remain separate modules.

## Planned system layers
1. MCP interface: explicit tool schema, host-controlled access and logging.
2. Supervisor: bounded goal, deterministic decision, evidence reconciliation, checkpoint and STOP.
3. Official agent transport: supported Codex/OpenAI API path, separately authenticated and scoped.
4. Browser adapter: local test sites initially; future backend compatibility/security evaluation, no ChatGPT Web scraping.
5. Trusted tool broker: exact user authorization and GitHub evidence verification before any write.

## Hard limits
No autonomous ChatGPT-Web interaction, no stored browser cookies, no credential extraction, no external website access by default, no arbitrary script evaluation in pages, no cross-repository mutation, no background daemon.

## Acceptance before activation
MCP initialize/list/call with real client; malformed JSON and oversized messages; browser localhost allow/deny and request interception; external redirects and DNS/SSRF tests; checkpoint store restart tests; real host capability and supported official agent transport tests. Until executed, mark NOT_EXECUTED.

## Native unified browser observation — 15 November 2026

The normal installed stdio MCP facade is `apps/desktop/src-tauri/src/mcp_stdio_host.rs`,
not the legacy `src/mcp/server.mjs` described by the v0 history above.
The currently selected `Local` source adds `workspace_browser.observe`
(`compact` / `delta`) to the existing four-tool MCP facade. Both
Codex and OpenCode use that same installed native executable, native
pipe, verified client identity, workspace lease and host-owned
`browser_observation.rs`. The operator's Svelte UI calls that exact
native observation owner; no second CLI, MCP server, browser renderer,
relay, agent daemon or third-party install is required.

An observation is forbidden unless the user selected an HTTPS supporting
tab, reviewed its reported origin and approved one capture within the last
60 seconds. Approval is explicitly scoped to **desktop-only** or
**workspace MCP/CLI-only**. No other audience can consume it. The native
host binds the authorization to the workspace, native tab label, exact URL
and document epoch, including an SHA-256 consent fingerprint checked at
the moment of approval. A new load, cancellation, tab switch or closure
invalidates stale captures. Authorization is consumed before CDP access,
including on errors. ChatGPT/OpenAI main and child
sites, IP/loopback and URLs with query, fragment or embedded credentials
are excluded. The protected ChatGPT main tab cannot be observed through
this capability. MCP preflight denies missing grants before acquiring a
workspace lease. This remains subordinate to existing native STOP and
no-unattended-consumer-ChatGPT-automation restrictions.

The native WebView2 adapter invokes `Accessibility.getFullAXTree` at
depth 12, with a raw response bound, limited semantic roles, redacted
label patterns, maximum 36 output items and 4096 bytes. Node values,
DOM IDs, cookies, raw page HTML and screenshot data are not returned.
`#N` lines are display indexes **only**, not click targets or stable element
references. The native host binds each capture to the active document
epoch and refuses grants while its page-load lifecycle reports loading.
This does not establish HTTP success or safely redact every possible
private label.
Delta compares only previously approved in-memory snapshots for the
same workspace/native tab/URL. Data is treated as untrusted page content;
a snapshot cannot satisfy ChatGPT completion, verified QA or task
authority. The tree depth cap means important content may be omitted.

Validation belongs to the separately authorized LOCAL_PC_AGENT phase:
Windows COM callback, native MCP/CLI and desktop integration, redaction,
stale reference and tab switching safety, and measured total tokens
per successful task (not merely snapshot byte count). Compare
full/compact/delta at the existing 1, 4 and 10 workspace cases and
record model, tool-call count, failure/retry count, elapsed time,
CPU/RAM and exact local validation receipt. Current source is
SOURCE_COMMITTED; Windows/Svelte/Cargo NOT_EXECUTED.

## One executable, two existing client interfaces

The **same native browser observation** can be requested from the existing
Svelte desktop interface, from the installed four-tool stdio MCP facade,
or from the installed executable's additional Windows CLI subcommand:

```text
lazyprompting-desktop.exe browser observe workspace-01 compact
lazyprompting-desktop.exe browser observe workspace-01 delta
```

The CLI does not bypass native client authentication, workspace ownership,
operator-issued MCP/CLI consent or one-shot consumption: it uses the exact
`browser_mcp_pipe::request` path used by stdio MCP. Direct terminal commands
cannot grant access, send a ChatGPT prompt, click a page element, extract
cookies or write repository files. No second executable, daemon or MCP server
was introduced. Existing Codex/OpenCode provider lifecycle and native STOP
remain authoritative; the browser snapshot is not worker-run evidence.
