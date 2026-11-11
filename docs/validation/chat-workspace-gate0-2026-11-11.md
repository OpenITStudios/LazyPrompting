# Gate 0 disposition — Codex-controlled ChatGPT Chat, 2026-11-11

**Source context:** `OpenITStudios/LazyPrompting` branch `Local`, reviewed baseline `43d23afaab18378afcc7ba1d28637d4cb6b551a5`.
**Gate verdict:** `BLOCKED_HOST_PERMISSION` for unattended production ChatGPT Chat automation; `FIXTURE_ONLY_ALLOWED` for local synthetic testing. This is a feasibility statement, **not an assertion that any runtime has been integrated**.

## Verified platform facts

1. OpenAI's consumer [Terms of Use](https://openai.com/policies/terms-of-use/) (effective 2026-01-01) restrict automatically/programmatically extracting service data/output and circumventing rate limits/restrictions. A browser extension's ability to see or interact with DOM does not itself grant permission to automate consumer ChatGPT conversations; live path requires an independently validated permitted integration.
2. [Temporary Chat Help](https://help.openai.com/en/articles/8914046): Personalized Temporary Chat may use plugins, custom instructions and existing memory but does not save an ordinary chat-history entry or new memory; it is not a durable continuation store. The supplied `?temporary-chat=true` URL is a navigation hint and not a guaranteed host API.
3. [OpenAI MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui) documents `ui/message` for a widget to request a follow-up message inside its hosting conversation and `ui/notifications/tool-result` for tool results. Neither is a verified universal API for an external Codex process to control arbitrary ChatGPT Classic chats, obtain final response completion events or create/bind replacement consumer sessions.
4. [Tauri WebviewBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html) has `browser_extensions_enabled` and `extensions_path` on Windows. [Microsoft WebView2 extension API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2profile.addbrowserextensionasync) loads unpacked extension folders; modifying a live folder can remove the extension. This establishes platform plausibility, not the pinned Tauri/Windows installation's compatibility.
5. [MV3 lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): browser extension workers can terminate during inactivity; canonical prompt/state ownership must stay in the trusted native host.

## Permissions and scope observed

- User-approved product intent: Codex receives a bounded goal; LazyPrompting owns up to 10 WebView2 workspaces; ChatGPT **ordinary Chat**, normally Personalized Temporary Chat, is the desired worker; project GitHub source/commits are evidence. UI layout remains fixed.
- No account-level ChatGPT Classic host capability, plugin auto-rebinding, native WebView2 extension operation, website automation permission, or unattended consumer output transport has been verified for this installation.
- A goal prompt does not authorize cross-repository writes, deployment, secrets, account-limit avoidance, or bypassing explicit user approvals.

## Clarification: send-only versus output extraction

A narrowly scoped extension may technically focus a composer, stage a
user-authorized prompt and request Send/Enter, while observing an activity
indicator **without reading assistant response content**. This is a distinct
engineering operation from automated extraction of ChatGPT Output.
It still does **not** establish that unattended repeated ChatGPT Web prompting
is authorized on every host/account. Accordingly, owned-fixture development
may proceed without stopping source engineering; real consumer ChatGPT activation
requires independently confirmed permissions and acceptance evidence.

## Gate decision

**Permitted independent next implementation:** a dependency-free, loopback-only **owned synthetic chat fixture** with an origin-limited mock composer sender and pure status reducer. Its status observations contain no ChatGPT reply or transcript; no `chatgpt.com` match, private endpoints, cookies, screenshots, or external model calls.

**Not enabled:** automatic ChatGPT Web prompt loop; Chrome/Playwright injection into logged-in accounts; output scraping; `workspace_chat.submit` exposed to production MCP; auto Temporary Chat creation; live installer/profile changes.

**Gate 0 remains OPEN** pending approved, supported chat transport and account/host verification. Fixture success must not be substituted for that gate. If a permitted live route is unavailable, a manual handoff remains necessary.
