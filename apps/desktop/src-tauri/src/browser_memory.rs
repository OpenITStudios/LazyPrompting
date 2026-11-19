// Operator-requested, read-only WebView2 normal-profile memory inspection.
// No PIDs, URLs or page data leave this Windows-only native module.
use std::collections::HashSet;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use tauri::Manager;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2, ICoreWebView2_2, ICoreWebView2Environment8,
    COREWEBVIEW2_PROCESS_KIND, COREWEBVIEW2_PROCESS_KIND_BROWSER,
    COREWEBVIEW2_PROCESS_KIND_GPU, COREWEBVIEW2_PROCESS_KIND_RENDERER,
};
use windows_core::Interface;
use windows_sys::Win32::System::{
    ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS, PROCESS_MEMORY_COUNTERS_EX},
    Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
};

const MAX_PROCESSES: u32 = 128;
const COM_ACK_TIMEOUT: Duration = Duration::from_secs(2);
const MIB: u64 = 1_048_576;

#[derive(Default)]
pub(crate) struct BrowserMemorySampler {
    active: AtomicBool,
}
struct SamplingGuard<'a>(&'a AtomicBool);
impl Drop for SamplingGuard<'_> {
    fn drop(&mut self) { self.0.store(false, Ordering::Release); }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Group { Browser, Renderer, Gpu, Other }
#[derive(Clone, Copy)]
struct Ref { pid: u32, group: Group }
#[derive(Clone, Copy)]
struct Measurement { group: Group, memory: Option<(u64, u64)> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BrowserMemorySnapshot {
    source: &'static str,
    scope: &'static str,
    status: &'static str,
    process_count: usize,
    measured_count: usize,
    unreadable_count: usize,
    renderer_processes: usize,
    private_commit_mib: Option<u64>,
    working_set_mib: Option<u64>,
    renderer_private_commit_mib: Option<u64>,
    result_verified: bool,
}

fn classify(kind: COREWEBVIEW2_PROCESS_KIND) -> Group {
    if kind == COREWEBVIEW2_PROCESS_KIND_BROWSER { Group::Browser }
    else if kind == COREWEBVIEW2_PROCESS_KIND_RENDERER { Group::Renderer }
    else if kind == COREWEBVIEW2_PROCESS_KIND_GPU { Group::Gpu }
    else { Group::Other }
}

// Only invoke on the native WebView2 UI/COM thread. No COM object is sent
// to the metrics worker. The environment is the existing browser profile.
fn enumerate(core: &ICoreWebView2) -> Result<Vec<Ref>, &'static str> {
    let core2 = core.cast::<ICoreWebView2_2>()
        .map_err(|_| "MEMORY_ENVIRONMENT_UNAVAILABLE")?;
    let env = unsafe { core2.Environment() }
        .map_err(|_| "MEMORY_ENVIRONMENT_UNAVAILABLE")?;
    let env8 = env.cast::<ICoreWebView2Environment8>()
        .map_err(|_| "MEMORY_PROCESS_API_UNAVAILABLE")?;
    let collection = unsafe { env8.GetProcessInfos() }
        .map_err(|_| "MEMORY_ENUMERATION_UNAVAILABLE")?;
    let mut count = 0u32;
    unsafe { collection.Count(&mut count) }
        .map_err(|_| "MEMORY_ENUMERATION_UNAVAILABLE")?;
    if count == 0 || count > MAX_PROCESSES {
        return Err("MEMORY_PROCESS_COUNT_INVALID");
    }
    let mut seen = HashSet::with_capacity(count as usize);
    let mut out = Vec::with_capacity(count as usize);
    for index in 0..count {
        let item = unsafe { collection.GetValueAtIndex(index) }
            .map_err(|_| "MEMORY_ENUMERATION_UNAVAILABLE")?;
        let mut pid = 0i32;
        unsafe { item.ProcessId(&mut pid) }
            .map_err(|_| "MEMORY_PROCESS_ID_INVALID")?;
        let pid = u32::try_from(pid).map_err(|_| "MEMORY_PROCESS_ID_INVALID")?;
        if pid == 0 { return Err("MEMORY_PROCESS_ID_INVALID"); }
        let mut kind = COREWEBVIEW2_PROCESS_KIND_BROWSER;
        unsafe { item.Kind(&mut kind) }
            .map_err(|_| "MEMORY_PROCESS_KIND_INVALID")?;
        if seen.insert(pid) { out.push(Ref { pid, group: classify(kind) }); }
    }
    if out.is_empty() { return Err("MEMORY_PROCESS_COUNT_INVALID"); }
    Ok(out)
}

// Process may exit after COM enumeration: failed read => unknown, never zero.
// The handle is query-only and released by OwnedHandle.
fn process_memory(pid: u32) -> Option<(u64, u64)> {
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() { return None; }
    let handle = unsafe { OwnedHandle::from_raw_handle(handle) };
    let mut counters = PROCESS_MEMORY_COUNTERS_EX::default();
    counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32;
    let ok = unsafe {
        GetProcessMemoryInfo(handle.as_raw_handle(),
            (&raw mut counters).cast::<PROCESS_MEMORY_COUNTERS>(), counters.cb)
    };
    (ok != 0).then_some((counters.PrivateUsage as u64, counters.WorkingSetSize as u64))
}

fn mib(n: u64) -> u64 { n.div_ceil(MIB) }

fn aggregate(samples: &[Measurement]) -> Result<BrowserMemorySnapshot, &'static str> {
    if samples.is_empty() || samples.len() > MAX_PROCESSES as usize {
        return Err("MEMORY_SAMPLE_INVALID");
    }
    let (mut measured, mut unreadable, mut renderers, mut missing_renderers) = (0, 0, 0, 0);
    let (mut private, mut working, mut renderer_private) = (0u64, 0u64, 0u64);
    for row in samples {
        if row.group == Group::Renderer { renderers += 1; }
        if let Some((p, w)) = row.memory {
            measured += 1;
            private = private.checked_add(p).ok_or("MEMORY_SAMPLE_OVERFLOW")?;
            working = working.checked_add(w).ok_or("MEMORY_SAMPLE_OVERFLOW")?;
            if row.group == Group::Renderer {
                renderer_private = renderer_private.checked_add(p).ok_or("MEMORY_SAMPLE_OVERFLOW")?;
            }
        } else {
            unreadable += 1;
            if row.group == Group::Renderer { missing_renderers += 1; }
        }
    }
    let complete = unreadable == 0;
    Ok(BrowserMemorySnapshot {
        source: "NATIVE_WEBVIEW2_PROFILE_MEMORY",
        scope: "NORMAL_SHARED_PROFILE",
        status: if complete { "COMPLETE" } else { "PARTIAL" },
        process_count: samples.len(),
        measured_count: measured,
        unreadable_count: unreadable,
        renderer_processes: renderers,
        // Partial sums must never be reported as a whole-profile total.
        private_commit_mib: complete.then(|| mib(private)),
        working_set_mib: complete.then(|| mib(working)),
        renderer_private_commit_mib: (missing_renderers == 0).then(|| mib(renderer_private)),
        result_verified: false, // Not ChatGPT delivery, task QA or proof of savings
    })
}

fn measure(refs: Vec<Ref>) -> Result<BrowserMemorySnapshot, &'static str> {
    let samples: Vec<_> = refs.into_iter()
        .map(|r| Measurement { group: r.group, memory: process_memory(r.pid) })
        .collect();
    aggregate(&samples)
}

// Only an explicit click by the main-window operator; no MCP/Code Mode,
// background timer, automated browser action or credential inspection.
#[tauri::command]
pub(crate) async fn browser_memory_snapshot(
    caller: tauri::Webview,
    sampler: tauri::State<'_, BrowserMemorySampler>,
) -> Result<BrowserMemorySnapshot, String> {
    if caller.label() != "main" { return Err("MEMORY_MAIN_WINDOW_REQUIRED".into()); }
    if cfg!(debug_assertions)
        && std::env::var("LAZY_FIXTURE_BRIDGE_ENABLE").ok().as_deref() == Some("1")
    {
        return Err("MEMORY_FIXTURE_PROFILE_EXCLUDED".into());
    }
    if sampler.active.swap(true, Ordering::AcqRel) {
        return Err("MEMORY_SAMPLE_IN_PROGRESS".into());
    }
    let _guard = SamplingGuard(&sampler.active);
    let app = caller.app_handle();
    let selected = (1..=10).find_map(|n| app.get_webview(&format!("browser-{n:02}")))
        .ok_or("MEMORY_NO_WORKSPACE_BROWSER")?;
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    selected.with_webview(move |platform| {
        let result = unsafe { platform.controller().CoreWebView2() }
            .map_err(|_| "MEMORY_WEBVIEW_UNAVAILABLE")
            .and_then(|core| enumerate(&core));
        let _ = tx.send(result);
    }).map_err(|_| "MEMORY_WEBVIEW_UNAVAILABLE")?;
    let refs = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(COM_ACK_TIMEOUT))
        .await.map_err(|_| "MEMORY_COM_WORKER_FAILED")?
        .map_err(|_| "MEMORY_COM_TIMEOUT")?
        .map_err(str::to_owned)?;
    tauri::async_runtime::spawn_blocking(move || measure(refs))
        .await.map_err(|_| "MEMORY_SAMPLE_WORKER_FAILED".to_owned())?
        .map_err(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn aggregate_complete_without_exposing_process_ids() {
        let x = aggregate(&[
            Measurement { group: Group::Browser, memory: Some((MIB, MIB * 2)) },
            Measurement { group: Group::Renderer, memory: Some((MIB * 2, MIB * 3)) },
            Measurement { group: Group::Gpu, memory: Some((MIB, MIB)) },
        ]).unwrap();
        assert_eq!(x.status, "COMPLETE");
        assert_eq!(x.process_count, 3);
        assert_eq!(x.private_commit_mib, Some(4));
        assert_eq!(x.working_set_mib, Some(6));
        assert_eq!(x.renderer_private_commit_mib, Some(2));
        assert!(!x.result_verified);
    }
    #[test]
    fn partial_snapshots_never_invent_total_memory() {
        let x = aggregate(&[
            Measurement { group: Group::Browser, memory: Some((MIB, MIB)) },
            Measurement { group: Group::Renderer, memory: None },
        ]).unwrap();
        assert_eq!(x.status, "PARTIAL");
        assert_eq!(x.unreadable_count, 1);
        assert_eq!(x.private_commit_mib, None);
        assert_eq!(x.working_set_mib, None);
        assert_eq!(x.renderer_private_commit_mib, None);
    }
    #[test]
    fn missing_nonrenderer_preserves_independent_renderer_subtotal() {
        let x = aggregate(&[
            Measurement { group: Group::Renderer, memory: Some((MIB, MIB)) },
            Measurement { group: Group::Other, memory: None },
        ]).unwrap();
        assert_eq!(x.status, "PARTIAL");
        assert_eq!(x.renderer_private_commit_mib, Some(1));
        assert_eq!(x.private_commit_mib, None);
    }
    #[test]
    fn invalid_or_overflowed_samples_fail_closed() {
        assert!(aggregate(&[]).is_err());
        assert!(aggregate(&[
            Measurement { group: Group::Browser, memory: Some((u64::MAX, MIB)) },
            Measurement { group: Group::Renderer, memory: Some((1, MIB)) },
        ]).is_err());
        assert!(aggregate(&vec![
            Measurement { group: Group::Other, memory: None };
            MAX_PROCESSES as usize + 1
        ]).is_err());
    }
}
