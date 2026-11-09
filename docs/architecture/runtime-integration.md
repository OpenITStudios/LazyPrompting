# Runtime implementation scope — source-first, no local testing yet

## Components now authored
- MCP stdio server with status, pure supervisor evaluation, checkpoint reading.
- Optional MCP browser_open/browser_snapshot/browser_close, only when `LAZY_BROWSER_ORIGINS` is explicitly configured.
- RemoteBrowser: Playwright, public HTTPS origin allowlist, bounded text snapshot, disabled downloads/service workers, no arbitrary JS execution or login/cookie export.
- GitHubEvidence: authenticated branch-HEAD read and exact SHA comparison, not a QA receipt verifier.
- OfficialAgentAdapter: callback interface for a trusted, supported agent host; **not** an official Codex API implementation.
- SupervisorOrchestrator: one-step inspect and reserve-before-dispatch workflow, with uncertain dispatch reconciliation.
- Durable checkpoint file store, decision engine, permission preflight.

## Deployment prerequisites
Node >=20, host-managed credentials, Playwright/browser binaries, network egress firewall, an actual MCP-capable host, and a supported official agent transport. None is configured or connected in this repository.

## Security limits
- Remote browser **does not** automate ChatGPT Web. Do not use it for unattended ChatGPT response extraction or authenticated session manipulation.
- DNS lookup before navigation does not prevent DNS rebinding or browser-resolver TOCTOU. Enforce network egress restrictions at the host/container boundary before permitting arbitrary external origins.
- The host must authenticate actual user authorization; model-supplied `trustedEvidence` or `trustedAuthorization` is not sufficient.
- GitHubEvidence currently checks identity only, not changed-file ancestry, test provenance, or authorization.
- The orchestrator is not an autonomous daemon; it requires a trusted caller to invoke each step.
- Browser and MCP source are not evidence of an actual running connection to this ChatGPT conversation.

## Remaining before release
Native Node tests, MCP protocol conformance, Playwright integration, egress/redirect/SSRF assessment, trusted broker enforcement, official Codex/API host integration, credential management, end-to-end replay/crash tests, rate and usage limits, and deployment packaging.

## Current decision
The user requested building source in ChatGPT/GitHub first without local tests. Therefore new integration tests are not executed and no operational claim is made.
