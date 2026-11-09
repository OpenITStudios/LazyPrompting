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
