# LazyPrompting Desktop (source-first)

Tauri 2 / Svelte 5 desktop product target, using M-Minecraft-Emulator as a **read-only architectural reference**. The current committed shell is Svelte UI code; there is **no Rust native host**, no built or installed desktop application, and no browser session connection.

## Layout
- Overview: 10 logically separate workspace IDs, visible status and selection.
- Browser Manager: explicit not-connected state; no ChatGPT Web scraping.
- Prompt Queue: reserved for verified host dispatch telemetry.
- Settings: General, Browser/Resources, Data/Privacy, Keyboard.

## Current entry
`src/main.ts` mounts `src/App.svelte`, with `src/app.css`. Pure workflow definitions in `src/workspace-model.mjs`. UI uses ephemeral local example data and never triggers a browser/session or sends prompts.

## Architecture constraints
Never import the existing browser pool directly into the Svelte UI or claim that Tauri is installed. Native commands must be separately implemented with an allowlist, capability admission, one shared browser profile with separate conversation identities, explicit process ownership, evidence-based status and no credential cloning. Shared login is intentional: browser cookies and same-origin storage are shared; only conversation routing, prompt queues and workspace metadata are separated. No unattended ChatGPT Web control without a documented supported provider.

## QA
`node tests/run-desktop-workspace-model.mjs` is authored but **not run**. Frontend build, Tauri Rust host, native window management, and Windows acceptance are NOT_EXECUTED/NOT_IMPLEMENTED. Project keeps the user's source-first convention.
