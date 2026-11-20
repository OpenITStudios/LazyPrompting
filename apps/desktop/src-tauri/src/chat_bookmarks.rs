// Explicit, main-window-only recovery bookmark. No ChatGPT content, cookies,
// session extraction, automated sends, approvals or verified response receipts.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Manager, Url};
use windows_sys::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
};

static LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Bookmark {
    schema_version: u8,
    workspace_id: String,
    chat_url: String,
    // Retain confirmed-full chat digests across an explicit new-chat bookmark.
    // These are local operator reports, never authenticated ChatGPT status.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    full_chat_digests: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    estimated_tokens: Option<u32>,
    // Only an explicit operator rollover can replace this bound chat.
    #[serde(default)]
    rollover_prepared: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cleanup_candidate: Option<CleanupCandidate>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CleanupCandidate {
    previous_chat_url: String,
    replacement_chat_url: String,
    // OS-reviewed old/new pair, not authenticated GitHub or ChatGPT proof.
    #[serde(default)]
    reviewed_for_manual_delete: bool,
}

fn chat_url(url: &Url) -> Option<String> {
    if url.scheme() != "https"
        || url.host_str() != Some("chatgpt.com")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let parts: Vec<_> = url.path().split('/').collect();
    if parts.len() != 3 || parts[0] != "" || parts[1] != "c" {
        return None;
    }
    let id = parts[2];
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, b)| {
            if matches!(i, 8 | 13 | 18 | 23) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
    {
        return None;
    }
    Some(url.as_str().to_owned())
}

// An exact saved ordinary conversation and a current browser URL must
// agree before a one-shot operator send. URL matching is not evidence
// of account authentication, delivery or a ChatGPT response.
fn bound_chat_url_at(root: &Path, workspace: &str, actual: &Url) -> Result<String, String> {
    let observed = chat_url(actual).ok_or_else(|| "OPERATOR_EXISTING_CHAT_REQUIRED".to_owned())?;
    let saved =
        read_at(root, workspace)?.ok_or_else(|| "OPERATOR_SAVE_CHAT_BOOKMARK_FIRST".to_owned())?;
    if saved != observed {
        return Err("OPERATOR_CHAT_BOOKMARK_MISMATCH".into());
    }
    Ok(saved)
}

pub(crate) fn verify_operator_chat_target(
    app: &tauri::AppHandle,
    workspace: &str,
    actual: &Url,
) -> Result<String, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "BOOKMARK_DATA_DIR_UNAVAILABLE")?
        .join("chat-bookmarks");
    let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
    bound_chat_url_at(&root, workspace, actual)
}

// Source-only URL scope guard. An actual saved ordinary ChatGPT URL
// must match the live WebView AND the digest in the native reservation.
// This does not prove account sign-in or any ChatGPT final answer.
fn plugin_digest_matches(saved_url: &str, expected: &str) -> bool {
    if expected.len() != 64
        || !expected
            .bytes()
            .all(|b| b.is_ascii_digit() || matches!(b, b'a'..=b'f'))
    {
        return false;
    }
    let Ok(parsed) = Url::parse(saved_url) else {
        return false;
    };
    chat_url(&parsed).as_deref() == Some(saved_url)
        && format!("{:x}", Sha256::digest(saved_url.as_bytes())) == expected
}

// Only native-owned, already-saved ordinary ChatGPT chat URLs qualify.
// This returns a digest, never conversation content, cookies or account proof.
pub(crate) fn plugin_chat_digest(
    app: &tauri::AppHandle,
    workspace: &str,
) -> Result<String, String> {
    let label = crate::embedded_webview::label_for(workspace)?;
    let view = app.get_webview(&label).ok_or("CHAT_PLUGIN_BROWSER_CLOSED")?;
    let actual = view.url().map_err(|_| "CHAT_PLUGIN_URL_UNAVAILABLE")?;
    let saved = verify_operator_chat_target(app, workspace, &actual)?;
    Ok(format!("{:x}", Sha256::digest(saved.as_bytes())))
}

pub(crate) fn verify_plugin_chat_target(
    app: &tauri::AppHandle,
    workspace: &str,
    expected_digest: &str,
) -> Result<(), String> {
    let label = crate::embedded_webview::label_for(workspace)?;
    let view = app.get_webview(&label).ok_or("CHAT_PLUGIN_BROWSER_CLOSED")?;
    let actual = view.url().map_err(|_| "CHAT_PLUGIN_URL_UNAVAILABLE")?;
    let saved = verify_operator_chat_target(app, workspace, &actual)?;
    if !plugin_digest_matches(&saved, expected_digest) {
        return Err("CHAT_PLUGIN_CHAT_SCOPE_MISMATCH".into());
    }
    Ok(())
}

fn path_at(root: &Path, id: &str) -> Result<PathBuf, String> {
    crate::embedded_webview::label_for(id)?;
    Ok(root.join(format!("{id}.json")))
}

// This is an operator-configured advisory, NOT a documented ChatGPT thread limit.
const CHAT_LONG_ADVISORY_TOKENS: u32 = 1_000_000;
const CHAT_ESTIMATE_MAX: u32 = 100_000_000;
const MAX_FULL_CHAT_DIGESTS: usize = 24;

// Private local bookmark metadata, not a ChatGPT conversation or API reader.
fn chat_digest(url: &str) -> String {
    format!("{:x}", Sha256::digest(url.as_bytes()))
}

fn read_record_at(root: &Path, id: &str) -> Result<Option<Bookmark>, String> {
    let path = path_at(root, id)?;
    match fs::symlink_metadata(&path) {
        Ok(meta) if !meta.file_type().is_file() || meta.file_type().is_symlink() => {
            return Err("BOOKMARK_UNSAFE_FILE".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("BOOKMARK_READ_FAILED".into()),
        _ => {}
    }
    let bytes = fs::read(path).map_err(|_| "BOOKMARK_READ_FAILED")?;
    if bytes.len() > 4_096 {
        return Err("BOOKMARK_INVALID".into());
    }
    let record: Bookmark = serde_json::from_slice(&bytes).map_err(|_| "BOOKMARK_INVALID")?;
    if record.schema_version != 1
        || record.workspace_id != id
        || Url::parse(&record.chat_url).ok().and_then(|u| chat_url(&u))
            .as_deref() != Some(record.chat_url.as_str())
        || record.full_chat_digests.len() > MAX_FULL_CHAT_DIGESTS
        || record.full_chat_digests.iter().any(|value| {
            value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        })
        || record.full_chat_digests.iter().collect::<std::collections::HashSet<_>>().len()
            != record.full_chat_digests.len()
        || record.estimated_tokens.is_some_and(|n| n > CHAT_ESTIMATE_MAX)
        || (record.rollover_prepared && record.cleanup_candidate.is_some())
        || record.cleanup_candidate.as_ref().is_some_and(|candidate| {
            candidate.replacement_chat_url != record.chat_url
                || candidate.previous_chat_url == record.chat_url
                || Url::parse(&candidate.previous_chat_url).ok()
                    .and_then(|u| chat_url(&u))
                    .as_deref() != Some(candidate.previous_chat_url.as_str())
        })
    {
        return Err("BOOKMARK_INVALID".into());
    }
    Ok(Some(record))
}

fn read_at(root: &Path, id: &str) -> Result<Option<String>, String> {
    Ok(read_record_at(root, id)?.map(|record| record.chat_url))
}

fn rollover_status_at(root: &Path, id: &str, actual: &Url) -> Result<Value, String> {
    let Some(record) = read_record_at(root, id)? else {
        return Ok(rollover_status_json(id, "UNBOUND", None, false, false));
    };
    if chat_url(actual).as_deref() != Some(record.chat_url.as_str()) {
        return Ok(rollover_status_json(id, "UNBOUND", None, false, false));
    }
    let status = if record.full_chat_digests.contains(&chat_digest(&record.chat_url)) {
        "FULL_CONFIRMED"
    } else if record.estimated_tokens.is_some_and(|n| n >= CHAT_LONG_ADVISORY_TOKENS) {
        "LONG_CHAT_ADVISORY"
    } else { "ACTIVE" };
    Ok(rollover_status_json(id, status, record.estimated_tokens,
        record.rollover_prepared, record.cleanup_candidate.is_some()))
}
fn rollover_status_json(
    id: &str, status: &str, estimated_tokens: Option<u32>,
    rollover_prepared: bool, cleanup_pending: bool,
) -> Value {
    json!({"source":"NATIVE_OPERATOR_CHAT_ROLLOVER",
        "workspaceId":id,"state":status,"estimatedTokens":estimated_tokens,
        "estimateSource": if estimated_tokens.is_some() { "OPERATOR_REPORTED" } else { "NONE" },
        "rolloverPrepared":rollover_prepared,
        "cleanupState": if cleanup_pending { "PENDING_REVIEW" } else { "NONE" },
        "chatTurnVerified":false,"nextPromptAllowed":false,
        "sendBlocked":status=="FULL_CONFIRMED"||rollover_prepared})
}

fn ensure_send_allowed_at(root: &Path, id: &str, actual: &Url) -> Result<String, String> {
    let bound = bound_chat_url_at(root, id, actual)?;
    let record = read_record_at(root, id)?.ok_or("OPERATOR_SAVE_CHAT_BOOKMARK_FIRST")?;
    if record.full_chat_digests.contains(&chat_digest(&bound)) {
        return Err("OPERATOR_CHAT_FULL_CONFIRMED".into());
    }
    if record.rollover_prepared {
        return Err("OPERATOR_ROLLOVER_PREPARED".into());
    }
    Ok(bound)
}

// Read-only, caller-lease-scoped MCP projection. No raw URL, notes, transcript,
// cookie, model output or authority fields leave the native bookmark owner.
// The live displayed URL must still match the saved ordinary chat URL.
pub(crate) fn rollover_status_for_mcp(
    app: &tauri::AppHandle,
    workspace: &str,
) -> Result<Value, String> {
    let label = crate::embedded_webview::label_for(workspace)?;
    let view = app.get_webview(&label).ok_or("CHAT_ROLLOVER_BROWSER_CLOSED")?;
    let url = view.url().map_err(|_| "CHAT_ROLLOVER_URL_UNKNOWN")?;
    let root = app.path().app_local_data_dir()
        .map_err(|_| "BOOKMARK_DATA_DIR_UNAVAILABLE")?
        .join("chat-bookmarks");
    let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
    let mut report = rollover_status_at(&root, workspace, &url)?;
    report["source"] = json!("NATIVE_BOOKMARK_OPERATOR_REPORT");
    report["chatIdentity"] = json!("URL_BOUND_ONLY");
    report["sourceVerified"] = json!(false);
    report["resultVerified"] = json!(false);
    report["qa"] = json!("NOT_EXECUTED");
    Ok(report)
}

// Validate before reserving. Read-only status/recovery operations continue
// to use verify_operator_chat_target so that a full chat can be reconciled.
pub(crate) fn verify_operator_send_target(
    app: &tauri::AppHandle,
    workspace: &str,
    actual: &Url,
) -> Result<String, String> {
    let root = app.path().app_local_data_dir()
        .map_err(|_| "BOOKMARK_DATA_DIR_UNAVAILABLE")?.join("chat-bookmarks");
    let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
    ensure_send_allowed_at(&root, workspace, actual)
}

// Serialize the final native UI action with Mark Full. Another click cannot
// confirm a chat full between this last check and the queued eval.
pub(crate) fn queue_operator_send_if_active(
    app: &tauri::AppHandle,
    workspace: &str,
    actual: &Url,
    enqueue: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let root = app.path().app_local_data_dir()
        .map_err(|_| "BOOKMARK_DATA_DIR_UNAVAILABLE")?.join("chat-bookmarks");
    let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
    ensure_send_allowed_at(&root, workspace, actual)?;
    enqueue()
}

fn to_wide(path: &Path) -> Vec<u16> {
    path.as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn write_record_at(root: &Path, id: &str, value: &Bookmark) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|_| "BOOKMARK_WRITE_FAILED")?;
    let path = path_at(root, id)?;
    if let Ok(meta) = fs::symlink_metadata(&path) {
        if !meta.file_type().is_file() || meta.file_type().is_symlink() {
            return Err("BOOKMARK_UNSAFE_FILE".into());
        }
    }
    let mut nonce = [0u8; 16];
    getrandom::getrandom(&mut nonce).map_err(|_| "BOOKMARK_ENTROPY_UNAVAILABLE")?;
    let tag: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
    let temp = root.join(format!(".{id}.{tag}.tmp"));
    let data = serde_json::to_vec(value).map_err(|_| "BOOKMARK_INVALID")?;
    if data.len() > 4_096 {
        return Err("BOOKMARK_INVALID".into());
    }
    let result = (|| {
        let mut writer = OpenOptions::new().write(true).create_new(true)
            .open(&temp).map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        writer.write_all(&data).map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        writer.sync_all().map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        drop(writer);
        let from = to_wide(&temp);
        let to = to_wide(&path);
        if unsafe {
            MoveFileExW(from.as_ptr(), to.as_ptr(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)
        } == 0 {
            return Err("BOOKMARK_PUBLISH_FAILED".into());
        }
        Ok(())
    })();
    let _ = fs::remove_file(temp);
    result
}

fn save_at(root: &Path, id: &str, url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|_| "BOOKMARK_INVALID_URL")?;
    if chat_url(&parsed).as_deref() != Some(url) {
        return Err("BOOKMARK_INVALID_URL".into());
    }
    for n in 1..=10 {
        let other = format!("workspace-{n:02}");
        if other != id && read_at(root, &other)?.as_deref() == Some(url) {
            return Err("BOOKMARK_ALREADY_BOUND".into());
        }
    }
    let old = read_record_at(root, id)?;
    let same = old.as_ref().is_some_and(|record| record.chat_url == url);
    let cleanup_candidate = if same {
        old.as_ref().and_then(|record| record.cleanup_candidate.clone())
    } else {
        // Another URL is not allowed to overwrite unresolved cleanup context.
        if old.as_ref().is_some_and(|record| record.cleanup_candidate.is_some()) {
            return Err("BOOKMARK_PREVIOUS_CLEANUP_PENDING".into());
        }
        if old.as_ref().is_some_and(|record| !record.rollover_prepared) {
            return Err("BOOKMARK_ROLLOVER_NOT_PREPARED".into());
        }
        old.as_ref().map(|record| CleanupCandidate {
            previous_chat_url: record.chat_url.clone(),
            replacement_chat_url: url.to_owned(),
            reviewed_for_manual_delete: false,
        })
    };
    let value = Bookmark {
        schema_version: 1,
        workspace_id: id.to_owned(),
        chat_url: url.to_owned(),
        full_chat_digests: old.as_ref().map(|record| record.full_chat_digests.clone())
            .unwrap_or_default(),
        estimated_tokens: if same {
            old.as_ref().and_then(|record| record.estimated_tokens)
        } else { None },
        rollover_prepared: same && old.as_ref().is_some_and(|record| record.rollover_prepared),
        cleanup_candidate,
    };
    write_record_at(root, id, &value)
}

fn update_rollover_at(
    root: &Path, id: &str, actual: &Url, action: &str, estimate: Option<u32>,
) -> Result<Value, String> {
    let saved = bound_chat_url_at(root, id, actual)?;
    let mut record = read_record_at(root, id)?
        .ok_or("OPERATOR_SAVE_CHAT_BOOKMARK_FIRST")?;
    match action {
        "RECORD_ESTIMATE" => {
            let count = estimate.ok_or("CHAT_ESTIMATE_REQUIRED")?;
            if count > CHAT_ESTIMATE_MAX { return Err("CHAT_ESTIMATE_INVALID".into()); }
            record.estimated_tokens = if count == 0 { None } else { Some(count) };
        }
        "PREPARE_ROLLOVER" => {
            if estimate.is_some() || record.cleanup_candidate.is_some() {
                return Err("CHAT_ROLLOVER_PREPARE_INVALID".into());
            }
            record.rollover_prepared = true;
        }
        "CANCEL_ROLLOVER" => {
            if estimate.is_some() || record.cleanup_candidate.is_some() ||
                record.full_chat_digests.contains(&chat_digest(&saved)) {
                return Err("CHAT_ROLLOVER_CANCEL_INVALID".into());
            }
            record.rollover_prepared = false;
        }
        "CONFIRM_FULL" => {
            if estimate.is_some() { return Err("CHAT_FULL_UNEXPECTED_ESTIMATE".into()); }
            let digest = chat_digest(&saved);
            if !record.full_chat_digests.contains(&digest) {
                if record.full_chat_digests.len() >= MAX_FULL_CHAT_DIGESTS {
                    return Err("CHAT_FULL_HISTORY_CAPACITY".into());
                }
                record.full_chat_digests.push(digest);
            }
            // Mark Full already expresses the need for a new chat.
            record.rollover_prepared = true;
        }
        _ => return Err("CHAT_ROLLOVER_ACTION_INVALID".into()),
    }
    write_record_at(root, id, &record)?;
    rollover_status_at(root, id, actual)
}

// The saved active Chat B must match the visible native main WebView URL.
// This local reference is a review target, not a ChatGPT deletion command.
fn cleanup_candidate_at(root: &Path, id: &str, actual: &Url) -> Result<CleanupCandidate, String> {
    bound_chat_url_at(root, id, actual)?;
    let record = read_record_at(root, id)?.ok_or("CHAT_CLEANUP_BOOKMARK_MISSING")?;
    let candidate = record.cleanup_candidate.ok_or("CHAT_CLEANUP_NOT_PENDING")?;
    if candidate.replacement_chat_url != record.chat_url
        || candidate.previous_chat_url == record.chat_url {
        return Err("CHAT_CLEANUP_TARGET_MISMATCH".into());
    }
    Ok(candidate)
}

// Persist the reviewed exact old/new pair only after native OS Yes.
// On restart, old candidates without this field remain unreviewed.
fn mark_cleanup_reviewed_at(
    root: &Path, id: &str, actual: &Url, previous_url: &str,
) -> Result<(), String> {
    let candidate = cleanup_candidate_at(root, id, actual)?;
    if candidate.previous_chat_url != previous_url {
        return Err("CHAT_CLEANUP_STALE_TARGET".into());
    }
    let mut record = read_record_at(root, id)?.ok_or("CHAT_CLEANUP_BOOKMARK_MISSING")?;
    let current = record.cleanup_candidate.as_mut().ok_or("CHAT_CLEANUP_NOT_PENDING")?;
    current.reviewed_for_manual_delete = true;
    write_record_at(root, id, &record)
}

// Local bookkeeping ONLY. Never asserts remote ChatGPT deletion.
fn settle_cleanup_at(
    root: &Path, id: &str, actual: &Url, previous_url: &str, action: &str,
) -> Result<Value, String> {
    if !matches!(action, "REPORTED_DELETED" | "KEEP") {
        return Err("CHAT_CLEANUP_ACTION_INVALID".into());
    }
    let candidate = cleanup_candidate_at(root, id, actual)?;
    if candidate.previous_chat_url != previous_url {
        return Err("CHAT_CLEANUP_STALE_TARGET".into());
    }
    if action=="REPORTED_DELETED" && !candidate.reviewed_for_manual_delete {
        return Err("CHAT_CLEANUP_REVIEW_REQUIRED".into());
    }
    let mut record = read_record_at(root, id)?.ok_or("CHAT_CLEANUP_BOOKMARK_MISSING")?;
    record.cleanup_candidate = None;
    write_record_at(root, id, &record)?;
    Ok(json!({"source":"NATIVE_OPERATOR_CLEANUP","workspaceId":id,
        "status":if action=="REPORTED_DELETED" {"OPERATOR_REPORTED_DELETED"} else {"OPERATOR_KEPT_CHAT"},
        "serverDeletionVerified":false,"nextPromptAllowed":false,"chatTurnVerified":false}))
}

fn delete_at(root: &Path, id: &str) -> Result<(), String> {
    // Forgetting a URL must not silently discard a pending old-chat target.
    if read_record_at(root,id)?.is_some_and(|record| record.cleanup_candidate.is_some()) {
        return Err("BOOKMARK_PREVIOUS_CLEANUP_PENDING".into());
    }
    let path = path_at(root, id)?;
    match fs::symlink_metadata(&path) {
        Ok(meta) if meta.file_type().is_file() && !meta.file_type().is_symlink() => {
            fs::remove_file(path).map_err(|_| "BOOKMARK_DELETE_FAILED".into())
        }
        Ok(_) => Err("BOOKMARK_UNSAFE_FILE".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("BOOKMARK_DELETE_FAILED".into()),
    }
}

fn main_only(webview: &tauri::Webview) -> Result<PathBuf, String> {
    if webview.label() != "main" {
        return Err("BOOKMARK_MAIN_WINDOW_REQUIRED".into());
    }
    Ok(webview
        .app_handle()
        .path()
        .app_local_data_dir()
        .map_err(|_| "BOOKMARK_DATA_DIR_UNAVAILABLE")?
        .join("chat-bookmarks"))
}

#[tauri::command]
pub async fn chat_bookmark_status(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    crate::embedded_webview::label_for(&workspace_id)?;
    let id = workspace_id.clone();
    let available = tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        Ok::<bool, String>(read_at(&root, &id)?.is_some())
    })
    .await
    .map_err(|_| "BOOKMARK_READ_FAILED")??;
    Ok(json!({"workspaceId":workspace_id,"available":available,
        "sessionVerified":false,"source":"LOCAL_URL_BOOKMARK_ONLY"}))
}

#[tauri::command]
pub async fn save_chat_bookmark(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    let view = webview
        .app_handle()
        .get_webview(&label)
        .ok_or("BOOKMARK_BROWSER_CLOSED")?;
    let observed = view.url().map_err(|_| "BOOKMARK_URL_UNKNOWN")?;
    let url = chat_url(&observed).ok_or("BOOKMARK_REQUIRES_ORDINARY_CHAT_URL")?;
    let id = workspace_id.clone();
    let app = webview.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Do not strand an unreviewed Chat A send when switching the saved
        // workspace to Chat B. Reuse the original complete PromptOutbox owner.
        // Serialize canonical pending-effect check and local URL replacement
        // with native Mark Full / queued Send once bookmark admission.
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        let switching=match read_record_at(&root,&id)? {
            Some(current) if current.chat_url!=url => {
                // Reject an ordinary bookmark switch immediately. No slow
                // gateway/outbox probe for an unprepared rollover.
                if current.cleanup_candidate.is_some() {
                    return Err("BOOKMARK_PREVIOUS_CLEANUP_PENDING".into());
                }
                if !current.rollover_prepared {
                    return Err("BOOKMARK_ROLLOVER_NOT_PREPARED".into());
                }
                true
            }
            _ => false,
        };
        if switching { cleanup_effects_clear(&app,&id)?; }
        // The page may navigate while outbox/draft preflight is running.
        // Refuse to bind a URL that no longer matches the protected view.
        let live=app.get_webview(&label)
            .ok_or("BOOKMARK_BROWSER_CLOSED")?
            .url().map_err(|_|"BOOKMARK_URL_UNKNOWN")?;
        if chat_url(&live).as_deref()!=Some(url.as_str()) {
            return Err("BOOKMARK_PAGE_CHANGED".into());
        }
        save_at(&root, &id, &url)
    })
    .await
    .map_err(|_| "BOOKMARK_WRITE_FAILED")??;
    Ok(json!({"status":"BOOKMARK_SAVED","workspaceId":workspace_id,
        "sessionVerified":false,"source":"NATIVE_WEBVIEW_URL_ONLY"}))
}

#[tauri::command]
pub async fn restore_chat_bookmark(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    let id = workspace_id.clone();
    let url = tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        read_at(&root, &id)?.ok_or_else(|| "BOOKMARK_NOT_FOUND".to_owned())
    })
    .await
    .map_err(|_| "BOOKMARK_READ_FAILED")??;
    let app = webview.app_handle();
    if let Some(view) = app.get_webview(&label) {
        let current = view.url().map_err(|_| "BOOKMARK_URL_UNKNOWN")?;
        if current.as_str() == url {
            return Ok(
                json!({"status":"ALREADY_DISPLAYED","workspaceId":workspace_id,"sessionVerified":false}),
            );
        }
        // A button click never silently replaces another active conversation.
        if !matches!(current.as_str(), "about:blank" | "https://chatgpt.com/") {
            return Err("BOOKMARK_ACTIVE_PAGE_PROTECTED".into());
        }
    }
    crate::embedded_webview::control_browser(app, &workspace_id, "open", Some(&url))?;
    Ok(
        json!({"status":"NAVIGATION_REQUESTED","workspaceId":workspace_id,
        "sessionVerified":false,"source":"LOCAL_URL_BOOKMARK_ONLY"}),
    )
}

#[tauri::command]
pub async fn forget_chat_bookmark(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    crate::embedded_webview::label_for(&workspace_id)?;
    let id = workspace_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        delete_at(&root, &id)
    })
    .await
    .map_err(|_| "BOOKMARK_DELETE_FAILED")??;
    Ok(json!({"status":"BOOKMARK_FORGOTTEN","workspaceId":workspace_id}))
}

// One operator-controlled status and one bounded update for an existing,
// bookmarked ordinary chat. They never access messages, cookies or API data.
#[tauri::command]
pub async fn chat_rollover_status(
    webview: tauri::Webview,
    workspace_id: String,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    let view = webview.app_handle().get_webview(&label).ok_or("BOOKMARK_BROWSER_CLOSED")?;
    let actual = view.url().map_err(|_| "BOOKMARK_URL_UNKNOWN")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        rollover_status_at(&root, &workspace_id, &actual)
    }).await.map_err(|_| "CHAT_ROLLOVER_STATUS_WORKER_FAILED")?
}

#[tauri::command]
pub async fn update_chat_rollover(
    webview: tauri::Webview,
    workspace_id: String,
    action: String,
    estimated_tokens: Option<u32>,
) -> Result<Value, String> {
    let root = main_only(&webview)?;
    let label = crate::embedded_webview::label_for(&workspace_id)?;
    let view = webview.app_handle().get_webview(&label).ok_or("BOOKMARK_BROWSER_CLOSED")?;
    let actual = view.url().map_err(|_| "BOOKMARK_URL_UNKNOWN")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
        update_rollover_at(&root, &workspace_id, &actual, &action, estimated_tokens)
    }).await.map_err(|_| "CHAT_ROLLOVER_UPDATE_WORKER_FAILED")?
}

// Query the one canonical PromptOutbox before offering a destructive review.
// No ChatGPT transcript, cookie, private API or model-supplied approval is used.
fn cleanup_effects_clear(app: &tauri::AppHandle, workspace: &str) -> Result<(), String> {
    // A staged manual handoff can outlive an outbox row. Do not drop it on
    // rollover. The try_lock fails closed instead of deadlocking against
    // another review holding the draft mutex before the bookmark mutex.
    let drafts=app.state::<crate::chat_manual_handoff::PendingManualHandoffs>();
    if drafts.cleanup_has_pending(workspace)? {
        return Err("CHAT_CLEANUP_MANUAL_DRAFT_PENDING".into());
    }
    let resource=app.path().resource_dir()
        .map_err(|_|"GATEWAY_RESOURCE_DIR_UNAVAILABLE")?.join("gateway");
    let data=app.path().app_local_data_dir()
        .map_err(|_|"CHAT_CLEANUP_DATA_DIR_UNAVAILABLE")?;
    let gateway=app.state::<crate::gateway_session::GatewaySession>();
    gateway.probe_packaged(&resource)?;
    let status=gateway.cleanup_pending_effects(&data,workspace)?;
    if status["unresolved"]!=false {return Err("CHAT_CLEANUP_OUTBOX_PENDING".into());}
    Ok(())
}

#[tauri::command]
pub async fn review_previous_chat_cleanup(
    window: tauri::WebviewWindow, workspace_id: String,
) -> Result<Value,String> {
    if window.label()!="main" {return Err("CHAT_CLEANUP_MAIN_WINDOW_REQUIRED".into());}
    let owner=window.hwnd().map_err(|_|"CHAT_CLEANUP_WINDOW_UNAVAILABLE")?.0 as usize;
    let app=window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let label=crate::embedded_webview::label_for(&workspace_id)?;
        let view=app.get_webview(&label).ok_or("CHAT_CLEANUP_BROWSER_CLOSED")?;
        let actual=view.url().map_err(|_|"CHAT_CLEANUP_URL_UNAVAILABLE")?;
        let root=app.path().app_local_data_dir()
            .map_err(|_|"CHAT_CLEANUP_DATA_DIR_UNAVAILABLE")?.join("chat-bookmarks");
        let previous={
            let _lock=LOCK.lock().map_err(|_|"BOOKMARK_BUSY")?;
            cleanup_candidate_at(&root,&workspace_id,&actual)?.previous_chat_url
        };
        cleanup_effects_clear(&app,&workspace_id)?;
        let message=format!(
            "Old ChatGPT chat:\n{previous}\n\n\
             Confirm ALL before continuing:\n\
             1. Chat B is the correct new chat and is usable.\n\
             2. You reviewed the GitHub checkpoint, decisions, holds and remaining work.\n\
             3. No work outside the native outbox is still unresolved.\n\n\
             YES returns only the old URL for manual deletion through ChatGPT's own interface.\n\
             LazyPrompting will not delete a remote chat or claim completion."
        );
        if !crate::operator_confirmation::confirm(owner,
            "LazyPrompting | Review old chat for deletion",&message)? {
            return Ok(json!({"source":"NATIVE_OPERATOR_CLEANUP","workspaceId":workspace_id,
                "status":"CANCELLED","serverDeletionVerified":false,"nextPromptAllowed":false}));
        }
        // Recheck after the OS dialog; URL or native outbox may have changed.
        let now=view.url().map_err(|_|"CHAT_CLEANUP_URL_UNAVAILABLE")?;
        {
            let _lock=LOCK.lock().map_err(|_|"BOOKMARK_BUSY")?;
            if cleanup_candidate_at(&root,&workspace_id,&now)?.previous_chat_url!=previous {
                return Err("CHAT_CLEANUP_STALE_TARGET".into());
            }
        }
        cleanup_effects_clear(&app,&workspace_id)?;
        {
            let _lock=LOCK.lock().map_err(|_|"BOOKMARK_BUSY")?;
            let latest=view.url().map_err(|_|"CHAT_CLEANUP_URL_UNAVAILABLE")?;
            mark_cleanup_reviewed_at(&root,&workspace_id,&latest,&previous)?;
        }
        Ok(json!({"source":"NATIVE_OPERATOR_CLEANUP","workspaceId":workspace_id,
            "status":"REVIEWED_FOR_MANUAL_DELETE","previousChatUrl":previous,
            "serverDeletionVerified":false,"nextPromptAllowed":false}))
    }).await.map_err(|_|"CHAT_CLEANUP_REVIEW_WORKER_FAILED")?
}

#[tauri::command]
pub async fn settle_previous_chat_cleanup(
    window: tauri::WebviewWindow, workspace_id: String,
    previous_chat_url: String, action: String,
) -> Result<Value,String> {
    if window.label()!="main" {return Err("CHAT_CLEANUP_MAIN_WINDOW_REQUIRED".into());}
    if !matches!(action.as_str(),"REPORTED_DELETED"|"KEEP") {
        return Err("CHAT_CLEANUP_ACTION_INVALID".into());
    }
    let owner=window.hwnd().map_err(|_|"CHAT_CLEANUP_WINDOW_UNAVAILABLE")?.0 as usize;
    let app=window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let label=crate::embedded_webview::label_for(&workspace_id)?;
        let view=app.get_webview(&label).ok_or("CHAT_CLEANUP_BROWSER_CLOSED")?;
        let actual=view.url().map_err(|_|"CHAT_CLEANUP_URL_UNAVAILABLE")?;
        let root=app.path().app_local_data_dir()
            .map_err(|_|"CHAT_CLEANUP_DATA_DIR_UNAVAILABLE")?.join("chat-bookmarks");
        // KEEP may be chosen directly from the reminder; the native owner
        // resolves the old URL. A deletion report always requires the exact
        // URL returned by the separate reviewed-for-manual-delete command.
        let previous_chat_url={
            let _lock=LOCK.lock().map_err(|_|"BOOKMARK_BUSY")?;
            let candidate=cleanup_candidate_at(&root,&workspace_id,&actual)?;
            if action=="KEEP" && previous_chat_url.is_empty() {
                candidate.previous_chat_url
            } else if candidate.previous_chat_url==previous_chat_url {
                if action=="REPORTED_DELETED" && !candidate.reviewed_for_manual_delete {
                    return Err("CHAT_CLEANUP_REVIEW_REQUIRED".into());
                }
                previous_chat_url
            } else {
                return Err("CHAT_CLEANUP_STALE_TARGET".into());
            }
        };
        if action=="REPORTED_DELETED" {
            cleanup_effects_clear(&app,&workspace_id)?;
        }
        let prompt=if action=="REPORTED_DELETED" {
            format!("Did you manually delete this exact OLD chat in ChatGPT and check its removal from your history?\n\n{previous_chat_url}\n\nYES clears only the local reminder. Server deletion cannot be verified by LazyPrompting.")
        } else {
            format!("Keep this OLD chat and dismiss the local cleanup reminder?\n\n{previous_chat_url}\n\nNo account chat will be deleted.")
        };
        if !crate::operator_confirmation::confirm(owner,
            "LazyPrompting | Confirm old chat cleanup",&prompt)? {
            return Ok(json!({"source":"NATIVE_OPERATOR_CLEANUP","workspaceId":workspace_id,
                "status":"CANCELLED","serverDeletionVerified":false,"nextPromptAllowed":false}));
        }
        let now=view.url().map_err(|_|"CHAT_CLEANUP_URL_UNAVAILABLE")?;
        if action=="REPORTED_DELETED" {
            cleanup_effects_clear(&app,&workspace_id)?;
        }
        let _lock=LOCK.lock().map_err(|_|"BOOKMARK_BUSY")?;
        settle_cleanup_at(&root,&workspace_id,&now,&previous_chat_url,&action)
    }).await.map_err(|_|"CHAT_CLEANUP_SETTLE_WORKER_FAILED")?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strict_ordinary_chat_urls_only() {
        let good = "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        assert_eq!(chat_url(&Url::parse(good).unwrap()).as_deref(), Some(good));
        for bad in [
            "https://chatgpt.com/",
            "https://chatgpt.com/?temporary-chat=true",
            "https://chatgpt.com/c/invalid",
            "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc?temporary-chat=true",
            "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc#h",
            "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc/extra",
            "http://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc",
            "https://chatgpt.com.evil/c/12345678-abcd-4def-9012-123456789abc",
            "https://www.chatgpt.com/c/12345678-abcd-4def-9012-123456789abc",
        ] {
            assert!(chat_url(&Url::parse(bad).unwrap()).is_none(), "{bad}");
        }
    }
    #[test]
    fn plugin_binding_digest_requires_canonical_ordinary_chat_url() {
        let saved = "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        let digest = format!("{:x}", Sha256::digest(saved.as_bytes()));
        assert!(plugin_digest_matches(saved, &digest));
        for wrong in [&"a".repeat(64), &digest.to_uppercase(), &"X".repeat(64)] {
            assert!(!plugin_digest_matches(saved, wrong));
        }
        for wrong in [
            "https://chatgpt.com/",
            "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc?temporary-chat=true",
            "https://chatgpt.com.evil/c/12345678-abcd-4def-9012-123456789abc",
        ] {
            assert!(!plugin_digest_matches(wrong, &digest));
        }
    }

    #[test]
    fn full_chat_guard_survives_new_bookmark_and_keeps_previous_history() {
        let mut nonce = [0u8; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let tag: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
        let root = std::env::temp_dir()
            .join(format!("lp-chat-rollover-{}-{tag}", std::process::id()));
        let chat_a = "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        let chat_b = "https://chatgpt.com/c/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
        save_at(&root, "workspace-01", chat_a).unwrap();
        let a = Url::parse(chat_a).unwrap();
        assert_eq!(rollover_status_at(&root, "workspace-01", &a).unwrap()["state"], "ACTIVE");
        assert_eq!(update_rollover_at(&root, "workspace-01", &a, "RECORD_ESTIMATE", Some(999_999))
            .unwrap()["state"], "ACTIVE");
        assert_eq!(update_rollover_at(&root, "workspace-01", &a, "RECORD_ESTIMATE", Some(1_130_000))
            .unwrap()["state"], "LONG_CHAT_ADVISORY");
        assert!(ensure_send_allowed_at(&root, "workspace-01", &a).is_ok());
        assert_eq!(update_rollover_at(&root, "workspace-01", &a, "CONFIRM_FULL", None)
            .unwrap()["state"], "FULL_CONFIRMED");
        assert_eq!(rollover_status_at(&root,"workspace-01",&a)
            .unwrap()["rolloverPrepared"],true);
        assert_eq!(ensure_send_allowed_at(&root, "workspace-01", &a).unwrap_err(),
            "OPERATOR_CHAT_FULL_CONFIRMED");
        // A resave of the same URL must not release the full-chat hold.
        save_at(&root, "workspace-01", chat_a).unwrap();
        assert_eq!(rollover_status_at(&root, "workspace-01", &a).unwrap()["state"], "FULL_CONFIRMED");
        assert!(update_rollover_at(&root, "workspace-01", &a, "CONFIRM_FULL", None).is_ok());
        assert_eq!(read_record_at(&root, "workspace-01").unwrap()
            .unwrap().full_chat_digests.len(), 1);
        assert!(update_rollover_at(&root, "workspace-01", &a, "RECORD_ESTIMATE",
            Some(CHAT_ESTIMATE_MAX + 1)).is_err());
        assert!(update_rollover_at(&root, "workspace-01", &a, "CONFIRM_FULL",
            Some(1)).is_err());
        save_at(&root, "workspace-01", chat_b).unwrap();
        let b = Url::parse(chat_b).unwrap();
        assert_eq!(rollover_status_at(&root, "workspace-01", &b).unwrap()["state"], "ACTIVE");
        assert_eq!(rollover_status_at(&root, "workspace-01", &a).unwrap()["state"], "UNBOUND");
        assert!(ensure_send_allowed_at(&root, "workspace-01", &b).is_ok());
        // One unresolved cleanup cannot be silently overwritten or forgotten.
        assert_eq!(rollover_status_at(&root,"workspace-01",&b).unwrap()["cleanupState"],
            "PENDING_REVIEW");
        assert_eq!(save_at(&root, "workspace-01", chat_a).unwrap_err(),
            "BOOKMARK_PREVIOUS_CLEANUP_PENDING");
        assert_eq!(delete_at(&root,"workspace-01").unwrap_err(),
            "BOOKMARK_PREVIOUS_CLEANUP_PENDING");
        assert_eq!(settle_cleanup_at(&root,"workspace-01",&b,chat_a,"KEEP")
            .unwrap()["status"],"OPERATOR_KEPT_CHAT");
        // A later deliberate rebind of the old chat still sees its durable full digest.
        update_rollover_at(&root, "workspace-01", &b, "PREPARE_ROLLOVER", None).unwrap();
        save_at(&root, "workspace-01", chat_a).unwrap();
        assert_eq!(ensure_send_allowed_at(&root, "workspace-01", &a).unwrap_err(),
            "OPERATOR_CHAT_FULL_CONFIRMED");
        assert_eq!(read_record_at(&root, "workspace-01").unwrap()
            .unwrap().full_chat_digests.len(), 1);
        let serialized = serde_json::to_string(&rollover_status_at(&root, "workspace-01",
            &a).unwrap()).unwrap();
        assert!(!serialized.contains(chat_a));
        assert!(!serialized.contains(&chat_digest(chat_a)));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn previous_chat_cleanup_is_scoped_local_and_persistent() {
        let mut nonce=[0u8;16];
        getrandom::getrandom(&mut nonce).unwrap();
        let tag:String=nonce.iter().map(|x|format!("{x:02x}")).collect();
        let root=std::env::temp_dir()
            .join(format!("lp-cleanup-{}-{tag}",std::process::id()));
        let a="https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        let b="https://chatgpt.com/c/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
        let c="https://chatgpt.com/c/cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        save_at(&root,"workspace-01",a).unwrap();
        let original=Url::parse(a).unwrap();
        assert_eq!(rollover_status_at(&root,"workspace-01",&original)
            .unwrap()["cleanupState"],"NONE");
        // A normal bookmark change does NOT create a deletion candidate.
        assert_eq!(save_at(&root,"workspace-01",b).unwrap_err(),
            "BOOKMARK_ROLLOVER_NOT_PREPARED");
        assert_eq!(ensure_send_allowed_at(&root,"workspace-01",&original).unwrap(),a);
        let prepared=update_rollover_at(&root,"workspace-01",&original,"PREPARE_ROLLOVER",None).unwrap();
        assert_eq!(prepared["rolloverPrepared"],true);
        assert_eq!(prepared["sendBlocked"],true);
        assert_eq!(ensure_send_allowed_at(&root,"workspace-01",&original).unwrap_err(),
            "OPERATOR_ROLLOVER_PREPARED");
        let canceled=update_rollover_at(&root,"workspace-01",&original,"CANCEL_ROLLOVER",None).unwrap();
        assert_eq!(canceled["rolloverPrepared"],false);
        assert!(ensure_send_allowed_at(&root,"workspace-01",&original).is_ok());
        update_rollover_at(&root,"workspace-01",&original,"PREPARE_ROLLOVER",None).unwrap();
        save_at(&root,"workspace-01",b).unwrap();
        let active=Url::parse(b).unwrap();
        assert_eq!(cleanup_candidate_at(&root,"workspace-01",&active)
            .unwrap().previous_chat_url,a);
        assert_eq!(rollover_status_at(&root,"workspace-01",&active)
            .unwrap()["cleanupState"],"PENDING_REVIEW");
        // Saving same URL preserves the target; switching again is held.
        save_at(&root,"workspace-01",b).unwrap();
        assert_eq!(save_at(&root,"workspace-01",c).unwrap_err(),
            "BOOKMARK_PREVIOUS_CLEANUP_PENDING");
        assert_eq!(delete_at(&root,"workspace-01").unwrap_err(),
            "BOOKMARK_PREVIOUS_CLEANUP_PENDING");
        assert!(cleanup_candidate_at(&root,"workspace-02",&active).is_err());
        assert!(cleanup_candidate_at(&root,"workspace-01",&Url::parse(a).unwrap()).is_err());
        assert_eq!(settle_cleanup_at(&root,"workspace-01",&active,c,"KEEP")
            .unwrap_err(),"CHAT_CLEANUP_STALE_TARGET");
        assert_eq!(settle_cleanup_at(&root,"workspace-01",&active,a,"UNSAFE")
            .unwrap_err(),"CHAT_CLEANUP_ACTION_INVALID");
        // A guessed URL or UI-reported deletion cannot skip native review.
        assert_eq!(settle_cleanup_at(&root,"workspace-01",&active,a,"REPORTED_DELETED")
            .unwrap_err(),"CHAT_CLEANUP_REVIEW_REQUIRED");
        assert_eq!(mark_cleanup_reviewed_at(&root,"workspace-01",&active,c)
            .unwrap_err(),"CHAT_CLEANUP_STALE_TARGET");
        mark_cleanup_reviewed_at(&root,"workspace-01",&active,a).unwrap();
        assert!(read_record_at(&root,"workspace-01").unwrap()
            .unwrap().cleanup_candidate.unwrap().reviewed_for_manual_delete);
        let result=settle_cleanup_at(&root,"workspace-01",&active,a,"REPORTED_DELETED").unwrap();
        assert_eq!(result["status"],"OPERATOR_REPORTED_DELETED");
        assert_eq!(result["serverDeletionVerified"],false);
        assert_eq!(result["nextPromptAllowed"],false);
        assert_eq!(rollover_status_at(&root,"workspace-01",&active)
            .unwrap()["cleanupState"],"NONE");
        assert!(cleanup_candidate_at(&root,"workspace-01",&active).is_err());
        // New old/new pair requires a fresh, explicit preparation.
        assert_eq!(save_at(&root,"workspace-01",c).unwrap_err(),
            "BOOKMARK_ROLLOVER_NOT_PREPARED");
        update_rollover_at(&root,"workspace-01",&active,"PREPARE_ROLLOVER",None).unwrap();
        save_at(&root,"workspace-01",c).unwrap();
        let active_c=Url::parse(c).unwrap();
        assert_eq!(cleanup_candidate_at(&root,"workspace-01",&active_c)
            .unwrap().previous_chat_url,b);
        let report=rollover_status_at(&root,"workspace-01",&active_c).unwrap();
        assert!(!report.to_string().contains(b));
        assert!(!report.to_string().contains(c));
        assert_eq!(settle_cleanup_at(&root,"workspace-01",&active_c,b,"KEEP")
            .unwrap()["status"],"OPERATOR_KEPT_CHAT");
        assert!(read_record_at(&root,"workspace-01").unwrap()
            .unwrap().cleanup_candidate.is_none());
        delete_at(&root,"workspace-01").unwrap();
        assert!(read_at(&root,"workspace-01").unwrap().is_none());
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn store_and_corrupt_record_guard() {
        let good = "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        let mut nonce = [0u8; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let tag: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
        let root =
            std::env::temp_dir().join(format!("lp-chat-bookmark-{}-{tag}", std::process::id()));
        save_at(&root, "workspace-01", good).unwrap();
        // Prior one-chat bookmark records remain readable without migration.
        fs::write(root.join("workspace-01.json"),
            format!(r#"{{"schemaVersion":1,"workspaceId":"workspace-01","chatUrl":"{good}"}}"#)
        ).unwrap();
        let legacy = read_record_at(&root, "workspace-01").unwrap().unwrap();
        assert_eq!(legacy.estimated_tokens, None);
        assert!(legacy.full_chat_digests.is_empty());
        assert!(legacy.cleanup_candidate.is_none());
        assert!(!legacy.rollover_prepared);
        assert_eq!(
            read_at(&root, "workspace-01").unwrap().as_deref(),
            Some(good)
        );
        let current = Url::parse(good).unwrap();
        assert_eq!(
            bound_chat_url_at(&root, "workspace-01", &current).unwrap(),
            good
        );
        let another =
            Url::parse("https://chatgpt.com/c/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa").unwrap();
        assert_eq!(
            bound_chat_url_at(&root, "workspace-01", &another).unwrap_err(),
            "OPERATOR_CHAT_BOOKMARK_MISMATCH"
        );
        assert_eq!(
            bound_chat_url_at(&root, "workspace-02", &current).unwrap_err(),
            "OPERATOR_SAVE_CHAT_BOOKMARK_FIRST"
        );
        for disallowed in [
            "https://chatgpt.com/",
            "https://chatgpt.com/?temporary-chat=true",
            "https://chatgpt.com/c/invalid",
        ] {
            assert_eq!(
                bound_chat_url_at(&root, "workspace-01", &Url::parse(disallowed).unwrap())
                    .unwrap_err(),
                "OPERATOR_EXISTING_CHAT_REQUIRED"
            );
        }
        assert!(save_at(&root, "workspace-02", good).is_err());
        fs::write(root.join("workspace-01.json"), b"{}").unwrap();
        assert!(read_at(&root, "workspace-01").is_err());
        // Corrupt local metadata must not be silently forgotten.
        assert!(delete_at(&root, "workspace-01").is_err());
        fs::remove_file(root.join("workspace-01.json")).unwrap();
        assert!(read_at(&root, "workspace-01").unwrap().is_none());
        let _ = fs::remove_dir_all(root);
    }
}
