# LazyPrompting — Active Source State

**Selected repository:** `OpenITStudios/LazyPrompting`, branch `Local`.
**Windows test baseline:** `830ed6b2679abd48bf24d0239ad1ed8f677d00b5` (21 November 2026), plus local fixes.
**Surface:** `LOCAL_PC_AGENT` — Codex desktop on the user's Windows PC.

**Serah terima 21 November 2026, 18.28 WIB.** Pengguna menghentikan pengerjaan untuk melanjutkan perbaikan di luar Codex. Pada tangkapan layar terakhir Browser 01 sudah membuka percakapan, tetapi Companion tetap tidak terlihat. Penerimaan UI gagal dan satu putaran prompting melalui Codex belum terbukti. Lihat [audit, kronologi, bukti dan cara membawa transkrip](history/2026-11-21-serah-terima-windows.md). Status ini mengoreksi kesan siap pakai dari laporan build sebelumnya.

## Open issues for the Codex workflow

This is the **single active continuation owner**.

| Order | Current evidence | Close when |
| --- | --- | --- |
| 1. Restore the connection from this Codex chat | The session's MCP status call returns `Transport closed`. Starting the configured executable directly returns a valid status. | This Codex chat can read a workspace location through its configured connection. |
| 2. Complete one prompt and reply in the same ChatGPT conversation | The installed MCP advertises manual handoff. Manual paste produced `LP-UJI-47`. The connected Browser 01 Probe exposes binding and numeric reporting. Live Send once and general reply delivery to Codex remain unverified. | One prompt reaches the selected conversation once, Codex receives its matching reply through a supported integration and prepares the next prompt. |
| 3. Verify isolation and recovery | Browser 01 and 02 opened in the shared profile. Recovery of the exact conversation after restart remains unverified. | The same conversation reopens after restart, and work in a second slot leaves the first untouched. Then check the remaining slots. |

**Verified setup.** WebView2 registered one Companion 0.1.0 in the Browser 01 profile. All 11 registered files matched source at installation. Group interface changes into the next planned build. The [Windows test matrix](../validation/windows-localtest-scenarios-2026-11-19.md) holds scenario-level evidence and outstanding optional tests.

## Earlier Windows desktop QA — 21 November 2026

Codex desktop verified the same `Local@830ed6b` code directly on the user's Windows desktop. The packaged executable passed stdio discovery. The QA build used the same application code and verified bundle assets with a separate Tauri identifier (`com.openitstudios.lazyprompting.qa830ed6b`) and the supplied Companion opt-in. The existing installation had active MCP clients and was left in place.

| Scenario | Observed result |
| --- | --- |
| Browser 01 and Work | WebView2 loaded the real signed-out ChatGPT page. Work displayed the unbound conversation state and checked native plugin and Codex status. |
| D01, two native MCP clients | Separate clients verified exclusive workspace ownership, release and reclaim. Goal status denied automatic next prompting, and the protected main-tab navigation request was rejected. |
| Manual draft UI | A synthetic MCP draft reached Work in Browser 10. `Send once` was disabled while no persistent conversation was bound. The draft remained unsent. |
| D02, native WebView2 fixture | Updated the ignored fixture for the current goal request and protected-main-tab contracts. On the real Windows runtime, ten child WebViews shared a synthetic fixture cookie while the app shell stayed separate. The background memory target changed to Low and then Normal on reselection. This verifies the target-level API, not memory savings or account isolation. |
| Partial D15, Helium | The packaged Companion appeared in Helium 0.22.1.1's Extensions menu with a separate QA profile. The shared toolbar inside a signed-in conversation remains unverified. |

To rerun the native fixture, set `LAZY_FIXTURE_BRIDGE_ENABLE=1`, point `LAZY_FIXTURE_EXTENSION_DIR` to the repository's `apps/desktop/browser-extension`, and run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml webview2_shares_one_browser_profile_and_saves_background_memory -- --ignored`. The fixture uses a distinct app identifier and loopback content.

The QA window was closed at the user's request to reuse existing data. The original installed LazyPrompting opened ChatGPT in Browser 01 with the saved signed-in session and no new login. The normal build retains its existing Tauri identifier and Browser 01 profile path. This observation applies to the existing installation. The signed-in ChatGPT/Codex workflow, native operator Yes/No, end-to-end pause/resume/STOP, and a manual `Send once` are still `NOT_EXECUTED`. The new WebView2 patch changes only the test fixture.

## Windows local validation — 21 November 2026

Tested the working tree `4b771b6dab20983d56c665f68e015e62a5bb3aa9` before updating this receipt, based on the `Local` baseline above. The Codex desktop terminal ran Windows 11 24H2 x64, Node 22.16.0, and Rust MSVC 1.96.0. Corrections cover repository-validator initialization, Work status types and recovery guidance, test fixture inputs, and rustfmt compatibility. The carried-over source history remains available at the pinned source checkpoint below.

| Gate | Observed result |
| --- | --- |
| A01–A02 / B01–B05 | Both lockfile installs and `npm run preflight:localtest` passed. 77 npm steps plus Svelte/Vite build and Cargo fmt/check/test. Rust reported 162 passed and 9 ignored. |
| C01 | Gateway staged in an isolated copy using the pinned Node 24.14.1 executable and license. `preflight:gateway-stage` verified 48 files. |
| C02 | Debug x64 NSIS build passed. Installer `LazyPrompting_0.1.0_x64-setup.exe`, SHA-256 `1341aa553373511f8e565d565ef57561bfd0955f7b528a3b68834775975970e8`. |
| C03–C04 | The installer and Microsoft-signed standalone WebView2 Runtime 158.0.4370.33 installed in offline Windows Sandbox. The desktop opened. The installed manifest, 49 gateway files including Node and manifest, and 11 Companion files matched staging. Installed MCP returned four public tools and both `workspace_goal` schemas. |
| Targeted native fixtures | `packaged_gateway_initializes_and_stops` passed against the matched staged manifest. Pinned Lightpanda 1.0.3 on Ubuntu WSL2 passed the interactive localhost fixture and the ten-workspace isolation fixture. |
| Partial D02 / D15 | The installed CLI opened all ten WebView2 workspaces and read their native locations offline. Companion package bytes matched source. Live browser session isolation and Companion UI parity across WebView2 and Helium remain unverified. |

Native Yes/No, installed end-to-end pause/resume/STOP, authenticated ChatGPT/Codex workflows, operator-confirmed Lightpanda click/fill and real Helium UI remain `NOT_EXECUTED`. Live acceptance requires a designated disposable profile/chat and operator approval for effects. D18 and the existing transport holds still apply. The fixes are in the local working tree.

## Source history

The [21 November source checkpoint](https://github.com/OpenITStudios/LazyPrompting/blob/830ed6b2679abd48bf24d0239ad1ed8f677d00b5/docs/operations/current-state.md) preserves the earlier Companion, rollover, and goal-contract development evidence. The [20 November checkpoint](history/2026-11-20-source-development-checkpoint.md) preserves earlier Windows and source history.
