# LazyPrompting Desktop — Product Architecture v1

## Product boundary
LazyPrompting is a desktop control center for up to ten independent workspaces. It visualizes sessions, browser workspace views, prompt dispatch status, host capability and recovery. ChatGPT owns the user task context and project work. LazyPrompting does not access project GitHub, copy ChatGPT cookies, scrape ChatGPT Web, or claim unattended control of existing chats.

## Reference provenance
Read-only reference: OpenITStudios/M-Minecraft-Emulator Local @ f24a1aad133ad80eb15d779545805769eca492f4. Adopt *patterns* of Tauri desktop shell, UI/engine separation, isolated instance presentation, settings, explicit lifecycle/error evidence, and per-instance identity. Do not copy Minecraft process controllers, Windows sandbox internals, account storage, or login behavior.

## Architecture
- Desktop shell: Tauri 2 with a Svelte 5/TypeScript UI, native Rust backend reserved for authorized OS/browser lifecycle integration. This first increment is a frontend-only skeleton and pure typed state.
- Core engine: existing src/prompt, src/runtime, src/browser modules remain canonical owners; frontend imports only serializable projections, never mutable engine objects.
- Workspace identity: 10 slots; workspaceId stable, sessionId opaque, selected workspace independent from dispatch order. One in-flight prompt per workspace.
- Browser modes: UNBOUND (default), PREVIEW_ONLY (safe mock visual), MANAGED_SUPPORTED_HOST (requires future documented admission). Existing public HTTPS browser adapter remains separate and opt-in.
- Native surface: no ten fully rendered persistent webviews in v1. Prefer one active preview + background session controllers where supported; hard caps for CPU/memory and browser process count. Use one user-controlled browser profile and shared authentication session across workspace tabs/views; isolate workspace metadata and conversation routing, not browser credentials. Never clone cookies or automatically sign in.
- Data ownership: app persists only workspace mapping, UI layout, minimized lifecycle metadata and limited health summary. Original ChatGPT content remains with ChatGPT; no transcripts in app storage.
- Dashboard: left rail workspace slots, central selected workspace status, right operator activity and queue; fixed status vocabulary. Settings: General, Browser/Resources, Data/Privacy, Keyboard, Notifications.
- Real ChatGPT transport: disabled until a documented authorized provider for existing consumer ChatGPT sessions is proven. UI may show NOT_CONNECTED and demo state, not claim live automation.

## Workflow
1. Create workspace and assign independent visual label
2. Bind an admitted browser/session provider explicitly, or leave UNBOUND
3. Confirm scope and permissions; show identity + resource budget
4. Observe authenticated state; queue only eligible dispatch
5. On send receipt move to next workspace without waiting for response
6. Verify terminal response; evaluate progress; report blockers; recover safely

## Validation / stop gates
- UI source and state contracts first. Tests authored but not run by user request.
- No native Windows runtime success, no browser session success, no login or ChatGPT transport assertions.
- Do not run CI, local tests, launch browsers, alter another repository, or add undocumented ChatGPT Web control.
- Next: implement Tauri command allowlist and native instance lifecycle for explicitly approved browsing before integrating any real host.

## Approved correction — shared login, 2026-11-10
- One user account, one browser profile, one browser-managed authentication state; up to ten distinct conversation/workspace identities.
- Prefer a single browser process/context with independently addressable tabs/views; multiple windows may reuse the same profile if supported. Do not require per-workspace login or copy session tokens.
- Workspace isolation is logical (conversation ID, queue, status, prompts, selected tab), **not a browser security boundary**. Cross-tab cookies and same-origin state are intentionally shared.
- Sign-in is manual and browser-owned. LazyPrompting must never collect, persist or extract credentials/cookies. Logout affects all workspace views using that profile.
- Distinct conversation binding and automatic prompt operations still require documented host capability; shared login does not authorize ChatGPT Web automation.

## AI-native browser efficiency — Lightpanda + Jev patterns (16 November 2026)

**Product choice:** preserve Chrome-style WebView2 for the human.
Use Lightpanda as the separate, optional headless automation candidate;
use Jev Ultrafast's **concepts**, not its proprietary hosted model,
as an indexed decision-space reference. Code Mode composes bounded,
host-admitted read-only steps without a second authorization owner.

**What is source-authored now (NOT_EXECUTED):** the opt-in Node
`LightpandaCdpAdapter.snapshot(workspaceId,"index")` reads one
`LP.getSemanticTree({format:"text",interactiveOnly:true})` result
through an already-open, localhost-preview-only CDP connection.
Its projection removes backend node IDs, attributes, input contents,
selectors and obvious sensitive labels, then returns at most 36
numbered, textual control descriptions and 4,096 UTF-8 bytes.
Indexes are **display only** and are never accepted as click targets.
No model call, screenshot, automation effect, new browser process,
network egress or state store is introduced. Default metadata
`snapshot` is backward compatible. The optional `view:"index"`
parameter on the existing gateway `lightpanda.snapshot` remains
behind its original host admission; the installed Rust native
Lightpanda path explicitly rejects indexed mode until it has
separate verified implementation and admission.

**Runtime and capability limits:** the current WSL Lightpanda native
relay is pinned, runs in a private network namespace and only serves
the local `/browser-preview.html` fixture. This is NOT a public-site
AI browser and is unrelated to the browser-managed login in WebView2.
The installed version may not implement `LP.getSemanticTree`;
missing support returns `LIGHTPANDA_CONTROL_INDEX_UNAVAILABLE`,
not a guessed fallback, UI scrape, or broadened network access.
Code Mode's public allowlist still has no browser navigation/page
content or effect permission. The existing WebView2 one-shot
AX observation for approved supporting tabs is a separate
permission-gated native owner; do not bridge it to consumer ChatGPT
or silently reuse display indexes as executable handles.

**Why not embed the original Jev experiment:** it uses the TypeSafe
Jev API and a separate text-model API, plus a Chrome harness. Its
sample 7.1 s Flights result and three-pair comparison measure one
workflow, not our installed agent/task success. Browser Use now
provides ultrafast mode, including a hosted option, but it is a
distinct provider/service with data, region, cost, and consent
considerations. No provider keys, installation, registration,
credentials, model or billing are changed in this increment.

**License checkpoint:** Lightpanda's upstream browser declares
AGPL-3.0-only; review source/distribution/network-service obligations
before bundling or modifying for a commercial release. Jev's original
example repository is MIT licensed, but that does not license the
TypeSafe API or Browser Use Cloud. Reference design is not adoption.

**Gate for a real AI browser, still HELD:** pin browser binary and
supported CDP methods; validate public HTTPS origin allowlist,
DNS/egress isolation, compliance, per-workspace lease and approval;
bind one fresh observation to an exact document epoch and native
element handle; prohibit password/secret/privileged target exposure;
authorize one typed operation only through native STOP/reservation;
verify its outcome independently before another action. Do not
treat model DONE as QA. No automation for ordinary ChatGPT consumer
sessions without a separately verified authorized transport.

**Measure efficiency later on the user's PC:** compare the same
consented benchmark tasks across metadata, indexed, AX-delta
and optional visual modes, recording task success, request/response
bytes, actual model tokens, LLM/tool calls, wall time, process
RAM/CPU, stale-action holds and site compatibility. Never infer a
universal token saving or performance ranking from upstream demos.

**Original evidence:**
- https://github.com/browser-use/jev-ultrafast (experiment/limits)
- https://browser-use.com/posts/bu-ultrafast-is-live (hosted successor)
- https://lightpanda.io/docs/guides/markdown-axtree (semantic-tree API)
- https://lightpanda.io/docs/core-concepts/benchmarks (benchmark bounds)
- https://lightpanda.io/docs/run-locally/installation/system-requirements (Windows WSL)
- https://github.com/lightpanda-io/browser/blob/main/LICENSING.md (license)
