# Browser-first interface and resource research — 19 November 2026

**Branch:** OpenITStudios/LazyPrompting `Local`; parent `ecaf5f1151d5136d526ca77c63f45a168a2d67a5`.
**Surface:** CHATGPT_GITHUB. **Proof:** SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN. Current Windows, Svelte build, Cargo, installed browser, and CPU/RAM measurements NOT_EXECUTED.

## Verified source observations and implemented design

1. The previous Activity panel exposed nonactionable `UNKNOWN`, `NO_PENDING`, `NOT_CHECKED` and unverified goal-state cards by default. Now Work displays one deterministic task/review priority. Pending operator send review, unknown or ambiguous send state stay visible. Debugging, Codex, GitHub, Lightpanda local-fixture and accessibility controls remain accessible on request under `Diagnostics and testing`, not permanently mounted.
2. Initial UI hydration had roughly six calls per ten slots plus global Codex read. Now only the selected workspace's native saved-chat bookmark, pending tab offer and manual draft are read on startup; panel-specific and global reads are demand-driven. No outbox, authorization, consent, STOP or worker state is changed.
3. ResizeObserver formerly called the serialized viewer queue's ten-slot hide/show path even for same-workspace bounds changes. The Rust `resize_embedded_view` updates the existing main and active supporting WebViews' geometry only; a failed or invalid native receipt falls back to original full visibility reconciliation.
4. Narrower rail and optional panel give the browser more space. Screenreader workspace labels still expose Open/Closed.

## Primary source research and counterevidence

- [Microsoft WebView2 performance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance): reuse WebViews, reduce native/UI IPC, defer work, profile real renderer CPU and JS heap. Rewriting Svelte into Rust does not remove Chromium page processes.
- [WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model), [shared user data folder](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder): common UDF can reduce duplicated browser-process cost, not guarantee one renderer or separate security identities. Keep the existing signed-in shared profile.
- [WebView2 MemoryUsageTargetLevel](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.memoryusagetargetlevel): LOW allows scripts/network but may increase reactivation latency; restore NORMAL on active. TrySuspendAsync pauses scripts and cannot be added to background AI/ChatGPT generation without verified idle status. Avoid mixing both approaches.
- [Tauri WebView versions](https://tauri.app/reference/webview-versions/): Windows WebView2 remains Chromium; Rust should own lifecycle, IPC, bounded state and permissions, not replace site JavaScript.
- [Lightpanda upstream benchmark](https://lightpanda.io/docs/core-concepts/benchmarks): vendor-measured crawling gains are task/OS-dependent and not LazyPrompting proof. Lightpanda is Zig-based, headless, separately isolated, and requires a license/production compatibility review. Do not share ChatGPT cookies, sessions or tabs across engines.

## Rejected without local proof

No forced webview suspend or automatic reload while generating; no page-cache clearing, GPU disable, process-kill, duplicated profile, ten eager headless workers or unbounded CDP. These may worsen latency, lose user work, violate scope or falsely indicate success.

## Exact-SHA local acceptance matrix — NOT_EXECUTED

- UI at widths 900/1280/1512, keyboard/focus, current send-review warning visible, diagnostics reachable, resize without page navigation, closed workspace recovery.
- Rust relayout with main/supporting tab, active tab changes, stale bounds, rapid switch+resize, missing native receipt; no second workspace modified or new permission granted.
- Benchmark 1/2/5/10 WebViews, idle and active, baseline and candidate on the same disposable Windows PC: process private commit, peak RAM, CPU mean/p95, startup time, tab/panel P50/P95, IPC calls/bytes, page responsiveness, real task success, Node/Lightpanda overhead. Do not infer improvement from source or other vendors' numbers.
- NSIS package and current Rust/Cargo tests need verified PC-local source SHA; older sandbox results are historical.

## Future AI ↔ human synchronization

For exact same-session takeover use one managed WebView2 and native exclusive ownership lease; for Lightpanda handoff transfer only approved URL/checkpoint/evidence, not live DOM or cookies. The source does **not** add general public AI browser action controls or supported automated ChatGPT consumer-response extraction; those require a separate transport/permission and runtime gate.

## Independent implementation comparison (not adopted)

- [Vercel agent-browser native Rust benchmark](https://github.com/vercel-labs/agent-browser/blob/main/benchmarks/README.md) reports much smaller **controller/daemon** RSS and smaller distribution footprint than its Node daemon. Its own methodology says operation latency is dominated by Chrome/CDP, not the controller. This is useful evidence for a future optional Rust browser-controller migration, **not** evidence that rewriting LazyPrompting's existing Node gateway will shrink Chromium's page heap or WebView2 renderer.
- [Browser Use shared-local-Chrome guidance](https://github.com/browser-use/browser-use/blob/main/skills/browser-use/SKILL.md) warns that two independent clients changing the current tab concurrently can target the wrong page. Thus a future AI-human handoff requires one native per-tab operation owner and verified document epoch, not UI flags or two simultaneous CDP controllers.
- Microsoft officially recommends using WebView2 with a shared UDF, appropriate inactive memory targets and fewer unnecessary WebView instances. However even when all views use one UDF, Chromium may still spawn multiple renderers per origin/isolated frame; measure **total** process private commit and CPU rather than only the Tauri process.

**Future optimization priority:** first measure Node gateway idle private commit, WebView2 renderer private commit and interaction latency separately. Replace a hot Node worker with native Rust only if measurements prove that its heap/IPC dominates **and** its sandbox, MCP and fallback contracts can be preserved. Do not rewrite the front-end or browser content in Rust.
