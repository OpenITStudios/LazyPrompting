# LazyPrompting Desktop — Product Architecture v1

## Product boundary
LazyPrompting is a desktop control center for up to ten independent workspaces. It visualizes sessions, browser containers, prompt dispatch status, host capability and recovery. ChatGPT owns the user task context and project work. LazyPrompting does not access project GitHub, copy ChatGPT cookies, scrape ChatGPT Web, or claim unattended control of existing chats.

## Reference provenance
Read-only reference: OpenITStudios/M-Minecraft-Emulator Local @ f24a1aad133ad80eb15d779545805769eca492f4. Adopt *patterns* of Tauri desktop shell, UI/engine separation, isolated instance presentation, settings, explicit lifecycle/error evidence, and per-instance identity. Do not copy Minecraft process controllers, Windows sandbox internals, account storage, or login behavior.

## Architecture
- Desktop shell: Tauri 2 with a Svelte 5/TypeScript UI, native Rust backend reserved for authorized OS/browser lifecycle integration. This first increment is a frontend-only skeleton and pure typed state.
- Core engine: existing src/prompt, src/runtime, src/browser modules remain canonical owners; frontend imports only serializable projections, never mutable engine objects.
- Workspace identity: 10 slots; workspaceId stable, sessionId opaque, selected workspace independent from dispatch order. One in-flight prompt per workspace.
- Browser modes: UNBOUND (default), PREVIEW_ONLY (safe mock visual), MANAGED_SUPPORTED_HOST (requires future documented admission). Existing public HTTPS browser adapter remains separate and opt-in.
- Native surface: no ten fully rendered persistent webviews in v1. Prefer one active preview + background session controllers where supported; hard caps for CPU/memory and browser process count. Independent instances must isolate storage and authentication; never clone cookies or automatically sign in.
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
