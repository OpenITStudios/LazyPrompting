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

fn read_at(root: &Path, id: &str) -> Result<Option<String>, String> {
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
    if bytes.len() > 1024 {
        return Err("BOOKMARK_INVALID".into());
    }
    let value: Bookmark = serde_json::from_slice(&bytes).map_err(|_| "BOOKMARK_INVALID")?;
    if value.schema_version != 1 || value.workspace_id != id {
        return Err("BOOKMARK_INVALID".into());
    }
    let url = Url::parse(&value.chat_url).map_err(|_| "BOOKMARK_INVALID")?;
    if chat_url(&url).as_deref() != Some(value.chat_url.as_str()) {
        return Err("BOOKMARK_INVALID".into());
    }
    Ok(Some(value.chat_url))
}

fn to_wide(path: &Path) -> Vec<u16> {
    path.as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn save_at(root: &Path, id: &str, url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|_| "BOOKMARK_INVALID_URL")?;
    if chat_url(&parsed).as_deref() != Some(url) {
        return Err("BOOKMARK_INVALID_URL".into());
    }
    // One stored conversation per workspace, without cross-workspace aliasing.
    for n in 1..=10 {
        let other = format!("workspace-{n:02}");
        if other != id && read_at(root, &other)?.as_deref() == Some(url) {
            return Err("BOOKMARK_ALREADY_BOUND".into());
        }
    }
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
    let value = Bookmark {
        schema_version: 1,
        workspace_id: id.to_owned(),
        chat_url: url.to_owned(),
    };
    let data = serde_json::to_vec(&value).map_err(|_| "BOOKMARK_INVALID")?;
    let result = (|| {
        let mut writer = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        writer
            .write_all(&data)
            .map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        writer.sync_all().map_err(|_| "BOOKMARK_WRITE_FAILED")?;
        drop(writer);
        let from = to_wide(&temp);
        let to = to_wide(&path);
        if unsafe {
            MoveFileExW(
                from.as_ptr(),
                to.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        } == 0
        {
            return Err("BOOKMARK_PUBLISH_FAILED".into());
        }
        Ok(())
    })();
    let _ = fs::remove_file(temp);
    result
}

fn delete_at(root: &Path, id: &str) -> Result<(), String> {
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
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = LOCK.lock().map_err(|_| "BOOKMARK_BUSY")?;
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
    fn store_and_corrupt_record_guard() {
        let good = "https://chatgpt.com/c/12345678-abcd-4def-9012-123456789abc";
        let mut nonce = [0u8; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let tag: String = nonce.iter().map(|b| format!("{b:02x}")).collect();
        let root =
            std::env::temp_dir().join(format!("lp-chat-bookmark-{}-{tag}", std::process::id()));
        save_at(&root, "workspace-01", good).unwrap();
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
        delete_at(&root, "workspace-01").unwrap();
        assert!(read_at(&root, "workspace-01").unwrap().is_none());
        let _ = fs::remove_dir_all(root);
    }
}
