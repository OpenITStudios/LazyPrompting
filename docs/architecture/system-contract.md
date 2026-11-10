# System Contract — Architecture First

> **Scope:** normative design and acceptance gates, not a snapshot of current runtime readiness. Parts are implemented and selected Windows integrations were exercised on earlier recorded source; consult [current state](../operations/current-state.md) and [MCP architecture](../../mcp/ARCHITECTURE.md) before making a capability claim.

## Outcome
An autonomous **continuation supervisor**, not a replacement coding agent or a blind auto-send bot. It consumes trusted structured status and verified development evidence, decides whether further authorized work is needed, and supplies a minimal context-specific instruction.

## Components (logical boundaries; partial implementation varies by layer)
1. **Goal Contract** — user scope, permissions, success criteria, budget, stop policy.
2. **Observation Adapter** — obtains the last completed agent task result via approved interface; records provenance and freshness.
3. **Evidence Reconciler** — validates claims against GitHub SHA, status and actual test receipts; does not trust model self-report alone.
4. **Context Compiler** — composes bounded objective + locked decisions + unresolved evidence + incremental change, not full transcript.
5. **Rule Engine** — deterministic first pass: CONTINUE, FIX_FAILURE, VERIFY, BLOCKED, DONE, NO_PROGRESS, WAIT.
6. **Codex Handoff** — only reasoning agent is Codex, via a verified official interface; no second model, candidate selection or speculative dispatch.
7. **Prompt Composer** — targeted instruction naming exact owner, observed result and required proof.
8. **Transport** — official Codex/OpenAI interface first; optional browser backend gated separately.
9. **Evaluator** — checks scope preservation, measurable progress, failure and repetition; manages stop conditions.
10. **Audit/Checkpoint** — records concise decisions and exact evidentiary references; no duplicate live state authority.

## Data flow
Goal → approved task → official agent result → reconcile evidence → choose next policy → compose prompt → authorization gate → dispatch → repeat.

The proposed operator interface and five-session acceptance are specified in [Goal Run MCP](goal-run-mcp.md).

## Important boundaries
- ChatGPT remains the operator conversation surface. A detached external agent can use official supported interfaces but does **not** magically type into or retain the exact same browser conversation.
- GitHub remains canonical for code; the supervisor stores only a minimal cursor and observations, not a competing replica of repository truth.
- WebView2 remains the embedded web renderer in the Tauri desktop UI. Lightpanda is the user-selected **automation browser backend**, not a replacement for the WebView. They do not implicitly share sessions, cookies, tabs, or identity. Lightpanda is not the reasoning engine or source of truth. Its installation, platform compatibility, permitted destinations and actual control remain gated by evidence.
- Do not use browser UI scraping to collect ChatGPT Web responses or bypass the platform's supported access mechanisms.
- Support one bounded task at a time initially. No autonomous branch selection, multi-agent mutation or auto-merging.

## Runtime stack decision
Current source uses the Tauri/Rust Windows host, Svelte UI, Node ESM gateway/supervisor/transport modules and file-backed durable state. The earlier TypeScript/SQLite proposal is historical, not a second implementation stack. Native integration and release proof require exact-build observations, not this design document.

## Failure modes
Stale output, duplicate send, partial streaming, contradictory status, invalid schema, unauthorized next action, stalled quality, wrong branch, rate limit, context overflow, unstable browser DOM, model hallucination, unverified commit or test claims.

## Recovery principles
Idempotent task IDs; exact-result checks; exponential backoff for retriable transport faults; no retry on permissions; evidence-before-success; STOP on repeated stagnation. Never fabricate a missing result.

## Native host ↔ MCP gateway transport contract (design and acceptance lock)

### Ownership and trust boundary
- **Tauri native host** owns operator consent, active process identity, grant store, stop/revoke and the local browser policy. Renderer state and MCP tool arguments are untrusted. Never expose a renderer command that issues grants or toggles `transport_verified` / `operator_approved`.
- **MCP gateway** remains a separate Node stdio process. An arbitrary client can invoke its public MCP tools; MCP `initialize` is not authentication. The current injected `nativeAdmission` callback is a unit-test seam, not a trusted production proof.
- **WebView2** is only the embedded renderer. **Lightpanda** is a separate CDP process. Neither shares a session or grants by implication.

### Selected Windows transport
1. Tauri host starts and owns the gateway child process; do not attach to an arbitrary existing gateway by localhost port. Keep MCP stdio available only through the intended host/official-client integration. Decide and document exact Codex process ownership before implementation.
2. Establish a **dedicated host-owned Windows named pipe** for authorization (not MCP stdio or renderer IPC). Use a per-run unpredictable pipe name, Windows security descriptor restricted to the intended user/logon session, and validate the connected client PID against the child process handle. The pipe name alone is never a credential. Reject mismatched PID, reused session and orphaned processes.
3. Bind the channel to a host-generated per-run 256-bit secret delivered only to the intended child through a protected launch channel; never command-line arguments, logs, GitHub, renderer, URLs or user-visible status. Require an authenticated challenge-response (HMAC-SHA-256) covering protocol version, nonces, child PID, host session ID and direction. Reject replay; erase the secret at teardown. Windows ACL and PID check alone are not sufficient.
4. A host-owned approval event issues a short-lived **single-use** grant bound to `capability`, `workspaceId`, exact preview URL (for open), host session, authenticated child identity, monotonic expiry and a request nonce. Never accept boolean authorization flags from gateway/renderer. The gateway sends the intended operation to the host for verification, not a self-declared `source:"NATIVE_HOST"`.
5. Host consumes grant **atomically** before the operation is admitted. Enforce a 10-workspace budget and deny on mismatched scope, duplicate nonce, expired grant, shutdown, child exit or host restart. A grant is not reusable across reconnects. Revoke on workspace close, user stop, process exit and host shutdown. In-flight operations must observe revocation before side effects.
6. Request framing: versioned length-prefixed binary frame (max 16 KiB) carrying strictly validated JSON payload; no newline parsing, unbounded reads or arbitrary commands. Allow only `authorize_open`, `authorize_snapshot`, `authorize_close`, `revoke_workspace`, `health` initially. Bound connect/read/write deadlines and pending requests. Do not put secrets or full page content in audit logs.
7. Fail closed: any authentication, transport, policy, timeout or browser-identity failure keeps `lightpanda.*` **DISABLED**. A successful TCP/CDP handshake is diagnostic only, never authorization. Browser navigation stays limited to the fixed local preview; never use this path for ChatGPT Web prompt/response scraping.

### Implementation order and acceptance tests
- **Gate A — native process ownership:** Tauri launches exactly one gateway child, tracks PID/handle, stops and reaps it; spoofed or orphaned client rejected. Windows integration test required.
- **Gate B — authenticated pipe:** verify ACL, PID binding, HMAC handshake, nonce replay rejection, malformed/oversized frame rejection, deadlines, child restart, and concurrent clients. Tests must exercise real Windows named pipes, not only injected JS callbacks.
- **Gate C — grant lifecycle:** connect `LightpandaGrantStore::issue_secure` and atomic consume to host channel, scoped per workspace and request, with revocation and shutdown tests. No approval path from renderer.
- **Gate D — gateway adapter:** only after A–C pass, replace `nativeAdmission` test seam with an authenticated host transport; ensure MCP default remains disabled if no host. Test denial from a standalone MCP client.
- **Gate E — real backend and Codex:** verify actual Lightpanda CDP compatibility, context isolation, bounded memory, 10-workspace lifecycle, and official Codex tool registration. No unapproved CI dispatch, browser scraping or claims from mocks.
- **Gate F — readiness:** Windows `cargo fmt --check`, `cargo check`, `cargo test`, desktop JS tests/build, and live integration evidence pinned to exact SHA. Only then consider localtest-ready.

**Decision:** This is an implementation contract, not a transport implementation or evidence of readiness. Until Gate D is proven, leave all Lightpanda MCP capabilities disabled by default.
