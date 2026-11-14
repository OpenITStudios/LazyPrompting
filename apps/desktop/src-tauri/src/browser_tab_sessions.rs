// Explicit user-owned supporting-tab URL snapshots. Separate from ChatGPT
// bookmarks and the canonical task/workspace registry. No cookies or chat data.
#[cfg(windows)]
use serde::{Deserialize,Serialize};
#[cfg(windows)]
use serde_json::{json,Value};
#[cfg(windows)]
use std::{fs::{self,OpenOptions},io::Write,os::windows::ffi::OsStrExt,path::{Path,PathBuf},sync::Mutex};
#[cfg(windows)]
use tauri::Manager;
#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::{
    MoveFileExW,MOVEFILE_REPLACE_EXISTING,MOVEFILE_WRITE_THROUGH,
};

#[cfg(windows)]
static LOCK:Mutex<()> = Mutex::new(());

#[cfg(windows)]
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct SavedTabs {
    schema_version:u8,
    workspace_id:String,
    urls:Vec<String>,
}
#[cfg(windows)]
fn record_path(root:&Path,id:&str)->Result<PathBuf,String>{
    crate::embedded_webview::label_for(id)?;
    Ok(root.join(format!("{id}.json")))
}
#[cfg(windows)]
fn safe_url(text:&str)->Option<String>{
    if text.len()>2048{return None}
    let mut url=crate::embedded_webview::browser_address(text).ok()?;
    // Do not persist navigation query tokens, fragments or credentials.
    if url.query().is_some() || url.fragment().is_some(){return None}
    if url.scheme()!="https"{return None}
    if matches!(url.host_str(),Some("chatgpt.com"|"www.chatgpt.com"|"chat.openai.com")){
        return None; // ChatGPT conversation recovery belongs to chat_bookmarks.
    }
    url.set_fragment(None);
    Some(url.as_str().to_owned())
}
#[cfg(windows)]
fn load(root:&Path,id:&str)->Result<Option<Vec<String>>,String>{
    let path=record_path(root,id)?;
    match fs::symlink_metadata(&path){
        Ok(m) if !m.file_type().is_file()||m.file_type().is_symlink()=>
            return Err("TAB_SESSION_UNSAFE_FILE".into()),
        Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(None),
        Err(_)=>return Err("TAB_SESSION_READ_FAILED".into()),
        _=>{}
    }
    let bytes=fs::read(path).map_err(|_|"TAB_SESSION_READ_FAILED")?;
    if bytes.len()>8192{return Err("TAB_SESSION_INVALID".into())}
    let saved:SavedTabs=serde_json::from_slice(&bytes).map_err(|_|"TAB_SESSION_INVALID")?;
    if saved.schema_version!=1||saved.workspace_id!=id||saved.urls.len()>3||
       saved.urls.iter().any(|url|safe_url(url).as_deref()!=Some(url.as_str()))||
       saved.urls.iter().collect::<std::collections::HashSet<_>>().len()!=saved.urls.len()
    {return Err("TAB_SESSION_INVALID".into())}
    Ok(Some(saved.urls))
}
#[cfg(windows)]
fn to_wide(path:&Path)->Vec<u16>{
    path.as_os_str().encode_wide().chain(std::iter::once(0)).collect()
}
#[cfg(windows)]
fn save(root:&Path,id:&str,urls:&[String])->Result<(),String>{
    let path=record_path(root,id)?;
    if urls.len()>3 || urls.iter().any(|u|safe_url(u).as_deref()!=Some(u.as_str())){
        return Err("TAB_SESSION_INVALID".into())
    }
    if let Ok(m)=fs::symlink_metadata(&path){
        if !m.file_type().is_file()||m.file_type().is_symlink(){
            return Err("TAB_SESSION_UNSAFE_FILE".into())
        }
    }
    fs::create_dir_all(root).map_err(|_|"TAB_SESSION_WRITE_FAILED")?;
    let mut nonce=[0u8;16];
    getrandom::getrandom(&mut nonce).map_err(|_|"TAB_SESSION_ENTROPY_FAILED")?;
    let temp=root.join(format!(".{id}.{}.tmp",
        nonce.iter().map(|b|format!("{b:02x}")).collect::<String>()));
    let bytes=serde_json::to_vec(&SavedTabs{
        schema_version:1,workspace_id:id.into(),urls:urls.to_vec()
    }).map_err(|_|"TAB_SESSION_INVALID")?;
    let result=(||{
        let mut out=OpenOptions::new().write(true).create_new(true).open(&temp)
            .map_err(|_|"TAB_SESSION_WRITE_FAILED")?;
        out.write_all(&bytes).map_err(|_|"TAB_SESSION_WRITE_FAILED")?;
        out.sync_all().map_err(|_|"TAB_SESSION_WRITE_FAILED")?;
        drop(out);
        let from=to_wide(&temp);let to=to_wide(&path);
        if unsafe{MoveFileExW(from.as_ptr(),to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)}==0{
            return Err("TAB_SESSION_PUBLISH_FAILED".into())
        }
        Ok(())
    })();
    let _=fs::remove_file(temp);
    result
}
#[cfg(windows)]
fn root(view:&tauri::Webview)->Result<PathBuf,String>{
    if view.label()!="main"{return Err("TAB_SESSION_MAIN_WINDOW_REQUIRED".into())}
    Ok(view.app_handle().path().app_local_data_dir()
        .map_err(|_|"TAB_SESSION_DATA_DIR_UNAVAILABLE")?.join("browser-tab-sessions"))
}
#[cfg(windows)]
#[tauri::command]
pub(crate) async fn save_browser_tabs(
    webview:tauri::Webview,workspace_id:String
)->Result<Value,String>{
    let root=root(&webview)?;
    let main=crate::embedded_webview::label_for(&workspace_id)?;
    if webview.app_handle().get_webview(&main).is_none(){
        return Err("TAB_SESSION_MAIN_CLOSED".into())
    }
    let mut urls=Vec::new();
    // Read only the three native supporting-tab URL slots, never the main chat.
    for n in 1..=3{
        let label=format!("{main}-tab-{n:02}");
        if let Some(tab)=webview.app_handle().get_webview(&label){
            let url=tab.url().map_err(|_|"TAB_SESSION_URL_UNKNOWN")?;
            let clean=safe_url(url.as_str()).ok_or("TAB_SESSION_URL_NOT_SAVABLE")?;
            urls.push(clean);
        }
    }
    let id=workspace_id.clone();
    tauri::async_runtime::spawn_blocking(move||{
        let _guard=LOCK.lock().map_err(|_|"TAB_SESSION_BUSY")?;
        save(&root,&id,&urls)
    }).await.map_err(|_|"TAB_SESSION_WRITE_FAILED")??;
    Ok(json!({"workspaceId":workspace_id,"status":"SAVED",
        "source":"LOCAL_SUPPORT_URL_SNAPSHOT_ONLY",
        "chatVerified":false,"nextPromptAllowed":false}))
}
#[cfg(windows)]
#[tauri::command]
pub(crate) async fn read_saved_browser_tabs(
    webview:tauri::Webview,workspace_id:String
)->Result<Value,String>{
    let root=root(&webview)?;
    crate::embedded_webview::label_for(&workspace_id)?;
    let id=workspace_id.clone();
    let urls=tauri::async_runtime::spawn_blocking(move||{
        let _guard=LOCK.lock().map_err(|_|"TAB_SESSION_BUSY")?;
        load(&root,&id)
    }).await.map_err(|_|"TAB_SESSION_READ_FAILED")??;
    Ok(json!({"workspaceId":workspace_id,"status":
        if urls.is_some(){"AVAILABLE"}else{"NOT_FOUND"},
        "urls":urls.unwrap_or_default(),
        "source":"LOCAL_SUPPORT_URL_SNAPSHOT_ONLY",
        "chatVerified":false,"nextPromptAllowed":false}))
}
#[cfg(all(windows,test))]
mod tests {
    use super::*;
    #[test]
    fn only_non_sensitive_https_support_urls_persist(){
        assert_eq!(safe_url("https://github.com/owner/repo"),
            Some("https://github.com/owner/repo".into()));
        for value in [
            "https://chatgpt.com/c/test",
            "https://example.com/path?token=private",
            "https://example.com/#key",
            "http://example.com/",
            "https://user:secret@example.com/"
        ]{assert!(safe_url(value).is_none(),"{value}")}
    }
}
