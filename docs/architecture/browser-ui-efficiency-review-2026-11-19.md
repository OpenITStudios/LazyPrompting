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

## Native layout + front-end coalescing — 19 November 2026 source follow-up

Source parents: `cae425b99f42a00a7d9e6cd61b43ff0a7db6778c` and `8b51d2f73125b5a2800ec214cb57dc8aa8ae3605`. The first corrected an early-closing brace that had left Tauri event subscriptions outside the `nativeDesktop` guard. The second introduced frame-coalesced ResizeObserver callbacks, selected-only WebView state reads and the explicit native-owned show contract.

**Rationale and native change.** The original `mount_embedded_view` already hides all other WebView2 main/supporting tabs, revokes nonselected observation/download grants and restores the selected native tab. The desktop viewer queue now avoids an additional preceding all-workspace hide for that one native show; a closed selection still hides, and a failed/stale show or close still calls the original global cleanup. No new permission broker, JS browser sender, or state store was created. Existing tests cover a generic hide-before-show caller and the native show failure and race paths.

Tauri [Webview::set_bounds](https://docs.rs/tauri/latest/tauri/webview/struct.Webview.html#method.set_bounds) consumes a [Rect](https://docs.rs/tauri/latest/tauri/struct.Rect.html) with position and size in one operation. The existing Rust main/mount/resize and supporting-tab restore/open/rollback/select/close paths now share a validated logical rectangle conversion, instead of invoking both `set_position` and `set_size`. Scope and native error/rollback identities are retained; the new Rust unit fixture checks logical coordinates. This reduces redundant host layout operations but is not evidence of lower Chromium renderer RSS.

**Resource safeguards.** Frame scheduling is inactive when hidden and one layout check occurs on foreground resume; no polling or model calls were introduced. `LOW` remains a best-effort inactive memory target; it is not a safe suspension policy for ongoing ChatGPT generation. Microsoft recommends reducing unnecessary WebViews and host/page IPC, sharing an environment and benchmarking actual process memory: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance.

**Proof ceiling:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Tauri/Svelte build, Rust Cargo, native Windows browser, NSIS installer, real tab layout latency and RAM/CPU usage are `NOT_EXECUTED` at this source revision. The existing 1/2/5/10-workspace local-PC acceptance plan remains the separate gate. Do not claim measured savings or headless/ChatGPT automation from these changes.

## Low-end visual and background-tab pass — 19 November 2026

Source parent: `Local@9b8b9d368ca0af88d4afdf895c03ded2882f0ef5`; `CHATGPT_GITHUB`, source review only.

**Observed before changes:** the Svelte desktop had no CSS animation loops, gradients, backdrop blur, background-image layers or third-party image/icon/font packages. It had three `box-shadow` declarations, two hover transitions plus a reduced-motion override, one 1.4 KiB SVG brand mark and five small local icon assets (~0.2–0.4 KiB each). Those assets are not a major browser memory driver. Removing the brand or functional navigation icons is therefore not a meaningful RAM fix.

**In-scope improvements:**
- Remove all three decorative box shadows and two hover transitions from `apps/desktop/src/app.css`; selected tab uses a solid top border, and the address field retains a visible keyboard-focus outline. Existing hover contrast, brand and accessible focus stay in place. Closed workspace rows no longer render a useless empty status marker; accessible button labels continue reporting Open/Closed.
- `browser_support_tabs.rs` now requests LOW for hidden main and previously selected support WebViews during support-tab open/restore, and restores NORMAL for the selected tab and for main when an active support tab is closed. The native helper is already best-effort; this closes missing lifecycle transitions without new state, readbacks or COM work in an idle polling loop.
- Keep the existing shared WebView2 profile, on-demand browser creation, one visible workspace, background LOW on hidden workspaces, operator STOP and exact-session recovery. Site functionality remains unchanged.

**Avoid false low-end optimizations:** removing the logo yields negligible savings; forcing `--disable-gpu` generally moves the workload onto the CPU (Microsoft advises retaining hardware acceleration); globally blocking images/video, JavaScript or CSS can break authentication, QR codes, maps, image-rich AI tasks and site interactions. `TrySuspendAsync` stops scripts, so without a verified per-page idle/ownership gate it is unsafe for long-running work. Do not inject a universal "text-only" stylesheet into third-party pages; an independently designed, opt-in supporting-tab data saver would first need resource policy, consent, compatibility fixtures and actual metrics.

Primary references:
- [Microsoft WebView2 performance best practices](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance) — process memory, shared environments, LOW/NORMAL, GPU use and avoiding unnecessary browser controls
- [MDN CSS performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS) — avoid unnecessary animations, preserve accessibility
- [Microsoft WebView2 settings](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2settings) — disabling scripts or default browser behaviors affects functionality, not a safe generic performance switch

**Source acceptance:** existing UI layout test now denies decorative shadow/blur and requires a visible active-tab/focus state and accessible closed-workspace status; native source regression checks LOW/NORMAL transitions with a negative fixture. Actual `cargo test`, Svelte/Vite build, installed WebView2 active/idle operation, per-process private-commit, battery, CPU, page compatibility and input latency remain **NOT_EXECUTED**. No numerical RAM reduction is claimed.

## Rust memory-management deep research — 19 November 2026

**Source parent:** `Local@bf96c4bfc482a477eb669a866f386d84e9cd45f5`. **Surface:** `CHATGPT_GITHUB`; research based on original Microsoft WebView2/Win32 APIs, Tauri/wry documentation, Microsoft's Rust allocator guidelines and current code. No PC/native benchmark has been executed for this revision.

### Actual ownership and the memory baseline

- `apps/desktop/src-tauri/src/embedded_webview.rs` creates WebView2 child views only on a selected/newly opened workspace, using the same normal data directory `browser-profiles/browser-01`. UI selection does not automatically instantiate all ten WebViews; the installed MCP `workspace_browser.open` *can* open background WebViews, which can remain live. Three supporting tabs per workspace are separate native WebViews sharing that profile, **not** separate browser logins.
- The Tauri/Svelte desktop shell runs in its own OS-provided WebView2. Replacing the Rust allocator does **not** replace Chromium's JavaScript heap or its renderer/GPU/browser processes.
- Historical offline Windows Sandbox idle private-commit samples for a previous revision were approximately **279.6 MiB (1 workspace)** and **352.6 MiB (10 workspaces)**; these are not current `Local` measurements, signed-in ChatGPT workload data or CPU/active-browsing proof. Never present this difference as a universal marginal tab cost.

### Primary-source technical options and decisions

| Option | Mechanism / expected scope | Key risk | Decision |
| --- | --- | --- | --- |
| Existing WebView2 `MemoryUsageTargetLevel=LOW/NORMAL` | Best-effort browser memory-pressure hint on inactive WebViews, with JavaScript/network **still running** | Increased swap/page fault latency and unknown actual reduction | **Keep.** Rust now checks live `ICoreWebView2_19::MemoryUsageTargetLevel` and calls `SetMemoryUsageTargetLevel` only when different or getter unavailable. No cache/grant/state owner; repeat hide/show is safe. |
| `ICoreWebView2_3::TrySuspend` / `Resume` | Similar to sleeping tabs; pause script timers and permit stronger resource reclamation | Interrupted ChatGPT generation, ongoing AI job, unverified form state, auto-resume/false readiness; `IsVisible=false` required | **HELD.** Future *operator-selected* idle-only support tab must have verified native action lease/idle receipt and independent lifecycle tests; never automatic on hidden ChatGPT main. Do not mix LOW/NORMAL and suspend policies without a redesigned owner. |
| Fewer native WebViews | Save browser renderer overhead by avoiding creation or explicitly closing unused WebViews | Losing live chat context, unsaved form work, pending action, background task | **Existing lazy lifecycle.** Keep opening on demand; no silent tab eviction or auto-reload. Profile/URL metadata is not a live browser process or authenticated ChatGPT state. |
| Shared WebView2 environment / user data folder | Common browser process/HTTP cache/login where runtime options are compatible | One UDF doesn't guarantee one renderer, one isolated security identity or zero duplicated memory | **Keep the current shared UDF**; verify real process topology. Explicitly managing environment objects in Rust is a separate, test-gated refactor—not necessary until sharing is disproven. |
| Read-only native process measurement | `ICoreWebView2Environment8::GetProcessInfos` enumerates UDF-associated WebView2 processes; Win32 `GetProcessMemoryInfo` provides working set and private committed usage | Process-list race, cross-process visibility, double counting shared pages, non-Windows API, UI-thread blocking | **Highest next diagnostic priority**, on demand and off UI thread; bound process count and return aggregates only. Do not claim savings from Task Manager's single Tauri PID. |
| Alternative Rust allocator (`mimalloc`) | Can accelerate or change fragmentation of **Rust host allocations**; Microsoft Rust Guidelines recommend it for some application workloads | May increase cached/committed memory; new dependency/lockfile, ABI/packaging, no effect on separate Chromium/Node heaps | **Experiment only after profiling**. Compare default vs allocator over the same workload on exact Windows SHA, with both private bytes and latency; do not add as a default without proof. Mimalloc purge parameters can trade memory for CPU. |
| Win32 `SetProcessInformation(ProcessMemoryPriority)` | Prioritizes what physical pages Windows retains under pressure | Reclaims *working-set residency* preferentially, not virtual allocation; can cause foreground paging stalls | **No default policy**; never indiscriminately lower priority for shared Chromium renderers. |
| `EmptyWorkingSet` / `SetProcessWorkingSetSize(-1)` | Explicitly trims resident pages without freeing underlying objects | Misleading Task Manager number, subsequent page faults/stutter, no reduction in private committed allocation | **Reject.** Not true browser memory optimization. |
| Strict Rust/Node heap caps, renderer process-count/disable-GPU flags | Artificial limits or browser-configuration changes | Crashes, reduced tab isolation, security regression, software rendering and slower UX | **Reject pending workload evidence and compatibility proof.** |
| Lightpanda for approved headless tasks | A different browser engine/runtime may avoid visual renderer costs for compatible automation | Separate sessions, CDP/site support, constrained current localhost-only implementation, licensing | **Future benchmark candidate**, never a universal substitute for WebView2 or consumer ChatGPT Web transport. |

### Observed Rust code optimization

The previous `set_memory_saving(view, enabled)` always issued `SetMemoryUsageTargetLevel` for every hidden/shown WebView, including unchanged state. It now calls the documented `MemoryUsageTargetLevel` getter and conditionally applies the setter if the browser-reported target differs. If the getter fails, the old best-effort setter is still attempted. This reduces redundant **setter** invocations during all-workspace hide/restore; it does not cache target values, add timers or alter ChatGPT content. Reading one COM property itself still costs work. Whether this improves wall-time/RAM depends on actual WebView2 runtime and must be measured. The unit fixture covers both equal/different levels and unknown read outcomes.

### Measurement and acceptance decision tree

1. Pin the exact local-PC `Local` SHA, Windows version, WebView2 runtime and workload; use a disposable shared profile.
2. Count WebView2 browser/renderer/GPU processes by *the actual owned environment* and inspect gateway Node/desktop Rust separately. Measure total private committed bytes and working set, not only one PID; record total RAM, peak, CPU, page faults, tab-switch P50/P95 and task completion.
3. Compare 1/2/5/10 open workspaces with no active generation, then with active tasks, and with 1/3 supporting tabs. Include two transitions: background to foreground, and foreground to background.
4. If browser/renderer dominates, prioritize controlled **idle-only** sleeping/smaller live-WebView count after consent/STOP design and site validation; allocator changes cannot resolve browser heap. If Rust native heap dominates, compare allocator and bounded caches. If Node gateway dominates, profile gateway ESM/heap independently; do not migrate blindly.
5. Runtime tests must exercise LOW/NORMAL getter failure, tab close/reopen, unsupported runtimes, multitab visibility, active AI tasks and no retry/STOP bypass. Observe **real** memory and responsiveness before claiming improvement.

**Publisher references:**
- [Microsoft WebView2 performance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)
- [WebView2 `ICoreWebView2_19` memory level contract](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_19)
- [webview2-com 0.39 Rust binding](https://docs.rs/webview2-com/latest/i686-pc-windows-msvc/webview2_com/Microsoft/Web/WebView2/Win32/struct.ICoreWebView2_19.html)
- [WebView2 `TrySuspend` / `Resume`](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2_3)
- [WebView2 process management](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis)
- [ICoreWebView2Environment8 process infos](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment8)
- [Win32 GetProcessMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-getprocessmemoryinfo)
- [Windows Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set)
- [Windows SetProcessInformation](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-setprocessinformation)
- [Microsoft Pragmatic Rust Guidelines — allocator](https://microsoft.github.io/rust-guidelines/guidelines/apps/)
- [mimalloc environment: purge delays/commit tradeoffs](https://microsoft.github.io/mimalloc/environment.html)

**Proof:** SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN. No actual Windows, Cargo/Svelte, installed browser, renderer, CPU/RAM or ChatGPT runtime acceptance for this new source revision.

## First native WebView2 RAM diagnostic — 20 November 2026

**Surface:** `CHATGPT_GITHUB`. Parent `Local@dfce4dfa7d95f60b4fea5ce175aacb9dc2b31cd2`.
The earlier Rust LOW/NORMAL setter optimization does not itself prove
lower RAM use. This increment supplies an operator-clicked, read-only
snapshot from the actual normal shared WebView2 environment.

- **Owner:** `apps/desktop/src-tauri/src/browser_memory.rs`, one native main-window
  command, not the Node gateway or a public MCP tool.
- **Scope:** one existing workspace WebView supplies its COM environment;
  `ICoreWebView2Environment8::GetProcessInfos` returns all processes
  using that user-data folder, excluding Crashpad, rather than assigning
  each process to a single workspace. Max 128 process records; duplicate
  PIDs removed inside native Rust. Fixture-debug profile excluded.
- **Threading:** enumerate COM processes on the native WebView callback;
  pass only PID/type pairs internally to an off-UI Win32 worker.
  `GetProcessMemoryInfo` with limited-query process handles gathers
  private committed and working-set bytes. Handles close on return.
- **Privacy:** serialize only count and aggregate MiB, no PIDs, paths,
  account/session data, URLs, process command lines, page content or
  cookies. No logging, storage or external export.
- **Completeness:** if any process becomes unreadable, return `PARTIAL`
  with null profile totals; never assume missing processes use zero RAM.
  Renderer subtotal is valid independently only when no renderer is
  unreadable. No claim of Task Manager "unique RAM": working sets include
  shared pages; total private commit excludes Node/Tauri.
- **No automation:** one explicit UI click, no polling, process kill,
  forced suspend, cache drop, working-set trim, new model calls or
  native ownership/STOP changes. A bounded COM receipt wait and one
  outstanding call avoid recurring memory scans.

**Official APIs:**
[WebView2 environment process info](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment8),
[ProcessInfoCollection](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2processinfocollection),
[Win32 GetProcessMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-getprocessmemoryinfo).

**Proof:** `SOURCE_REVIEWED / TEST_AUTHORED_NOT_RUN`. Rust synthetic
aggregation unit tests and Svelte static regression fixture authored.
Win32 COM compatibility, Tauri/Svelte/Cargo build, installed source,
real process/private commit measurements, 1/2/5/10 workspace performance,
and any actual savings remain `NOT_EXECUTED`. Do not infer that adding
a read-only instrument reduces RAM itself.
