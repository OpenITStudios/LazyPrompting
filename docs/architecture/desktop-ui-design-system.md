# LazyPrompting desktop UI — approved baseline (2026-11-10)

## Scope and source of truth
Approved shell: blue-accent dark theme, LP SVG brand, 10 browser workspaces, selected browser viewer, Focus toggle, top-right compact Connections popover. No Search or Settings. Preserve this layout unless the user explicitly approves a redesign.
- Layout owner: `apps/desktop/src/App.svelte`
- Design tokens and geometry: `apps/desktop/src/app.css`
- Workspace state owner: `apps/desktop/src/app/workspace-controller.mjs`
- Brand master: `apps/desktop/public/lazyprompting-icon.svg`
- Reusable line SVG originals: `apps/desktop/public/icons/{browser,ai-mcp,globe,chevron-down,close}.svg`. These are source assets; existing inline SVGs in App.svelte remain the runtime rendering until a tested component extraction. Do not replace the logo with an emoji or generic icon.

## Layout contract
- 4 px base grid; canonical spacing 4/8/12/16 px. Avoid magic-margin compensation.
- Header 56 px; LP logo 32 px; connection trigger 32 px; controls visually center-aligned.
- Sidebar desktop width `clamp(164px,17vw,210px)`; compact breakpoints 145 px at <=650 px and 110 px at <=430 px.
- Workspace item 50 px, 4 px inter-item gap, name above status, 3 px between name/status. Selected state uses blue left border, not a status color.
- Main panel padding 16 px vertical / 20 px horizontal on desktop; viewer fills remaining space.
- Popover anchored to header button at right, 8 px below; width max 248 px, horizontal padding 16 px, two 32 px status rows, no footer. It must not push app layout or add a full-screen dimming layer.
- Text status always accompanies color. Workspace status: Offline grey #929ba9, Ready green #35c98b, Working yellow #f2b84b, Error red #f06470. No invented live telemetry.
- Connections header summary currently Offline; AI & MCP Offline and Browser Unavailable are static placeholders until a verified adapter provides authoritative data. Do not display Good/Ready from unverified state.
- Focus mode hides sidebar but preserves the header Connections control.
- Long names ellipsize, with full name available via title. Preserve keyboard focus and reduced-motion preferences.

## UI blindspot checks before claiming runtime PASS
1. At desktop widths 1920, 1366, 1280 and native minimum 900, verify no horizontal scroll, clipped status, or misplaced popup.
2. At 650 and 430 px responsive breakpoints, verify the popup remains within viewport and both header elements remain reachable.
3. Open Connections: exact 16 px horizontal inset; title/rows share left edge; no unexpected bottom gap; click outside and Escape close it; close button restores focus.
4. Tab through header, ten workspaces, Focus, and popup close; visible focus indicator and no inaccessible controls.
5. Verify selected workspace, long name, Focus toggle, disabled Open Browser, and four lifecycle colors without treating mock status as runtime evidence.
6. Confirm SVG icons have consistent 24x24 viewBox and 1.8 stroke; LP logo remains the distinct brand asset.
7. Run `npm run check` and `npm run build` in `apps/desktop` on an approved execution host. Native Windows acceptance is separate.

## Evidence
Source reviewed and committed. Frontend build, screenshot-based visual QA, accessibility automation, and native Tauri runtime are NOT_EXECUTED here. No browser transport or AI/MCP connection is asserted. UI layout can be treated as design-frozen, not runtime-certified.
