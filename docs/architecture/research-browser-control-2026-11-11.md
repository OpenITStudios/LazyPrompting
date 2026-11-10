# Browser-control and completion-monitor research — 2026-11-11

**Class:** non-authoritative reference/provenance evidence; decisions live in [proposed Chat workspace control](codex-chat-workspace-plan.md) and tests in [acceptance gates](../validation/codex-chat-workspace-gates.md).
**Method:** source README/implementation inspection at specified public repository refs and authoritative platform documentation. Nothing was installed, executed, or benchmarked in the LazyPrompting target environment.
**Target source:** OpenITStudios/LazyPrompting branch `Local` baseline `3635067dd4888f86d750b36550d96cfba2d4d756`.

## The decision, not a list of packages to install

The request is not "build a generic browser agent." It is "Codex receives one task and supervises up to ten ordinary ChatGPT Chat tabs, using GitHub evidence and a minimal status/input adapter." A generic agent that consumes a model call to choose each click is wasteful here. Prefer:
- Existing WebView2 and Rust/Tauri host for view, profile, session identity and native permission.
- One minimal internally owned extension only after Windows fixture compatibility and platform permission gates.
- No model for browser sensing, notifications, retry or GitHub HEAD comparison.
- Existing four-tool Codex-facing MCP facade and outbox/supervisor modules.
- Third-party CDP/Playwright systems for **targeted QA**, not production scraping or a second browser.

## Source-driven candidate matrix

| Candidate / pinned public ref | License (source metadata, check notices before copying) | Relevant technique | Adoption |
| --- | --- | --- | --- |
| [ChatGPT Done Notifier](https://github.com/kkonstantin08/chatgpt-done-notifier/tree/54381bf1c3362570d0dd8186dc258fa0c35e95ad) | No SPDX license confirmed in this review | Separate DOM selectors and generation state machine; Stop-observed, assistant activity, debounce and error/manual-stop safeguards | **Study behavior only**; do not copy code |
| [ChatGPT Response Complete Notifier](https://github.com/ramhaidar/ChatGPT-Response-Complete-Notifier/tree/40fcc1654441ce8b26c786692be3743015a7d7e4) | AGPL-3.0 | Prompt-bound response fingerprint, network completion + DOM, background-tab fallback | **Concept reference only**; private ChatGPT endpoint monitoring and response extraction excluded |
| [Chat Alert](https://github.com/dawidstruzik/chat-alert/tree/665be3d48362c3d1a2b08f009f78a47b66d94ef9) | MIT | Simple generation states and per-tab notification; implementation also intercepts fetch | **Concept reference**; do not use private fetch interceptor |
| [JEV Ultrafast](https://github.com/browser-use/jev-ultrafast/tree/8251e272398011cdef648965204d1c20cd838333) | MIT | Indexed DOM actions, atomic operation+target, freshness validation, bounded loops | Adopt techniques, **not** its TypeSafe/Mercury model requirement |
| [Browser Harness](https://github.com/browser-use/browser-harness/tree/65c174a097cbcca483e967f5c4aa3a7b730b797d) | MIT | Persistent Chrome/CDP session and compact tool layer; repository publishes self-run comparative browser agent tests | QA/research reference; no Chrome daemon dependency |
| [Playwright CLI](https://github.com/microsoft/playwright-cli/tree/8297c9b12432ea12c1707cd64995fc96768bdb70) | Apache-2.0 | Focused, token-efficient browser commands; `fill` and `--submit`; session scoping | Optional **fixture QA**; not production engine |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp/tree/e436f64eb7e1904b6c302da0997a2243496d191e) | Apache-2.0 | Actionability and accessibility snapshot, CDP endpoints, browser extension mode | Optional **test adapter**, never a second production controller |
| [agent-browser](https://github.com/vercel-labs/agent-browser/tree/d129226078e0fc8ee5dec48fbc96a46df5d0aafd) | Apache-2.0 | Compact interactive element refs, explicit action/result checks, CDP support | Use testing ideas only; no added Rust browser CLI in production |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/1d692d31ae370105afcf4d826dc36f1c4c22e21a) | Apache-2.0 | DevTools protocol, WebView2 debug and performance diagnostics; see official Microsoft WebView2 setup | **Preferred targeted native debugging** (isolated profile/port only) |
| [Stagehand](https://github.com/browserbase/stagehand/tree/b29016565dc83dc4f0e56948fb11210dce7e4df0) | MIT | AI-assisted observe/act and cached execution | Not selected; adds provider/model complexity |
| [browser-use](https://github.com/browser-use/browser-use) | MIT | Generic browser agent with reasoning/action loop | Not selected; target is narrower |
| [Lightpanda](https://github.com/lightpanda-io/browser) | AGPL-3.0 | Headless CDP browser; already present as separate private preview adapter | Keep original limited role; not ChatGPT WebView2 driver |
| [Skyvern](https://github.com/skyvern-ai/skyvern) | AGPL-3.0 | High-level AI browser workflows | Not selected; unnecessary agent/infra/cost |
| [BrowserOS](https://github.com/browseros-ai/BrowserOS) | AGPL-3.0 | Entire agentic browser product | Not selected; do not replace Tauri/WebView2 |

**Third-party Chrome Web Store examples supplied by operator:**
- [AI Reply Notifier](https://chromewebstore.google.com/detail/nhcjbfmcadhopcnkioldaedonmnpcbog): notification on response complete/error with background monitoring. Store statements are **product claims, not reviewed source or independent performance evidence**.
- [Automatically Continue Generating](https://chromewebstore.google.com/detail/lggplclnocekhieeegbifpiofggloaph): handles the **same answer's continuation** button and completion notification, not semantic follow-up prompts or goal-aware scheduling. Store text cannot prove current compatibility or permission to automate ChatGPT.

### Useful source insights and blindspots

- Notifier state machines require **observed start + stop transition + assistant activity + no error/manual stop + debounce**. Polling only for absence of a Stop button is not enough. Background views throttle timers and a model may pause mid-stream.
- JEV's model selection for each browser action would introduce extra inference and potentially billed API requests. Its speed demonstration on Google Flights does not establish performance on ChatGPT or actual total price for LazyPrompting.
- Browser Harness comparison is **self-reported**, task/browser/model-specific, and should not be promoted to unbiased proof of a universal winner.
- Playwright's `locator.fill` supports contenteditable fields and checks actionability, which highlights that arbitrary `element.click()` or synthetic keyboard events are not necessarily accepted inputs by controlled React editors. See official Playwright input documentation.
- Chromium Manifest V3 background service workers may terminate after idle periods; durable lifecycle state must remain in native host, not worker globals. Avoid infinite heartbeats and persistent model polling.
- WebView2's shared data directory means shared cookies/profile and extension settings; it does **not** make ten independent account identities. A WebView2 profile extension cannot assume Chrome tab/window UI, browser action popups, or Native Messaging works identically. Verify these in the pinned installed build.

## Platform documentation checked

| Official source | Finding / effect |
| --- | --- |
| [Tauri WebviewBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html) | `browser_extensions_enabled` and `extensions_path` exist for Windows; test against pinned Tauri 2.12.5 before use |
| [Wry Windows WebView builder](https://docs.rs/wry/latest/x86_64-pc-windows-msvc/wry/trait.WebViewBuilderExtWindows.html) | Extension-enable settings must match when WebViews share one directory; requires compatible WebView2 runtime |
| [Microsoft WebView2 extension install](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2profile7) | Unpacked folder is not copied; changing installed files can remove extension; popup/UI entry points may be unavailable |
| [Microsoft WebView2 host messaging](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/webview2) | `WebMessageReceived` / `PostWebMessageAsJson` exist; origin and payload validation required |
| [Microsoft DevTools MCP for WebView2](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server) | Can inspect running WebView2 by CDP for **QA**, not a reason to add a second production browser |
| [Chrome extension lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | MV3 service-worker inactivity/restart is expected; never rely on in-memory pending prompt status |
| [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging) | Official Chrome/Edge feature, but requires separate host and origin verification; WebView2 support not presumed |
| [Playwright actionability/input](https://playwright.dev/docs/input) | Focus, fill, click and editor behavior can be tested in our synthetic fixture |
| [MCP Apps UI message](https://developers.openai.com/plugins/build/chatgpt-ui) | `ui/message` and `tools/call` exist, but do not grant an external Codex process arbitrary ownership of ChatGPT Classic chats |
| [ChatGPT personalized Temporary Chat](https://help.openai.com/en/articles/8914046) | Not in history by default; can use plugins when Personalized; session recovery must not depend on chat history |
| [ChatGPT developer mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt) | App selection and full write access are subject to product/plan/host policy; never assume an old plugin remains selected per message |
| [OpenAI consumer terms](https://openai.com/id-ID/policies/terms-of-use/) | Automated/programmatic Output extraction and circumvention of limits are restricted; build no ChatGPT scraping/private API tool |
| [OpenAI MCP Extensions host support matrix](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md) | `ui/message` supports a new-thread target on supported hosts, but its Web support table **explicitly excludes classic ChatGPT**; do not assume new Temporary Chat creation or auto-rebinding is available |

## Reuse and cost decision

**Selected:** existing WebView2 + minimal status/sender adapter; immutable staged extension where feasible; one native host authority; GitHub HEAD/compare pinned source; event-based deterministic supervisor; Codex only at real reasoning forks; GitHub evidence in compact increments.

**Rejected for baseline:** JEV/Browser Use/Stagehand/Skyvern as production agent; screenshots/OCR; full transcript scraping; vector database; embedding inference; additional LLMs; a second Chromium window/profile for every workspace; arbitrary Chrome extension installation; background polling when no task exists.

**Not proven:** browser extension host API support on the installed Windows build, completion accuracy on ChatGPT Classic, programmatic send permission, unattended Temporary Chat rollover, authenticated association of GitHub commit to an individual prompt, and final end-to-end operating cost. Any percentage/price/speed claim requires an independent recorded benchmark. Source licenses must be honored if actual code is ever reused; by default **do not copy external implementation code**.

## Consequence for the project

This research is sufficient to choose a **minimal architecture and concrete acceptance gates**, but it does not prove P0 host policy or real ChatGPT transport. Therefore source implementation of a live ChatGPT auto-loop should **not** be reported ready. Begin with documented ownership and isolated fixtures only after the operator confirms the plan and relevant permissions.
