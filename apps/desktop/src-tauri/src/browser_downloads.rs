// Native owner of one-shot supporting-tab downloads. Ordinary browser profile
// remains shared; no renderer/website can grant itself download permission.
use serde::Serialize;
use std::{collections::VecDeque,fs,path::{Path,PathBuf},sync::Mutex};
use tauri::{Manager,webview::DownloadEvent};

const MAX_RECORDS:usize=20;
#[derive(Default)]
pub(crate) struct DownloadGate { state:Mutex<State> }
#[derive(Default)]
struct State { armed:Option<Arm>,records:VecDeque<Record> }
struct Arm { workspace_id:String,view_label:String,origin:String }
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
struct Record {
 workspace_id:String,
 status:&'static str,
 file_name:Option<String>,
 // No download URL, query tokens, website text or profile credentials retained.
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct Snapshot {
 workspace_id:String,
 armed:bool,
 records:Vec<Record>,
 source:&'static str,
 next_prompt_allowed:bool,
}
fn push(state:&mut State,record:Record){
 state.records.push_front(record);
 state.records.truncate(MAX_RECORDS);
}
fn origin(url:&tauri::Url)->Option<String>{
 if url.scheme()!="https"||url.host_str().is_none()||
    !url.username().is_empty()||url.password().is_some(){return None}
 let mut clean=url.clone();
 clean.set_path("/");clean.set_query(None);clean.set_fragment(None);
 Some(clean.to_string())
}
fn safe_root(path:&Path)->Result<(),String>{
 if let Ok(metadata)=fs::symlink_metadata(path){
  if metadata.file_type().is_symlink()||!metadata.is_dir(){
   return Err("DOWNLOAD_DIRECTORY_UNSAFE".into())
  }
 }
 fs::create_dir_all(path).map_err(|_|"DOWNLOAD_DIRECTORY_UNAVAILABLE")?;
 let meta=fs::symlink_metadata(path).map_err(|_|"DOWNLOAD_DIRECTORY_UNAVAILABLE")?;
 if !meta.is_dir()||meta.file_type().is_symlink(){
  return Err("DOWNLOAD_DIRECTORY_UNSAFE".into())
 }
 Ok(())
}
fn file_target(root:&Path)->Result<(PathBuf,String),String>{
 for _ in 0..4 {
  let mut nonce=[0u8;16];
  getrandom::getrandom(&mut nonce).map_err(|_|"DOWNLOAD_ENTROPY_UNAVAILABLE")?;
  let name=format!("download-{}.bin",nonce.iter().map(|b|format!("{b:02x}")).collect::<String>());
  let path=root.join(&name);
  match fs::symlink_metadata(&path){
   Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok((path,name)),
   Ok(_)=>continue,
   Err(_)=>return Err("DOWNLOAD_TARGET_UNAVAILABLE".into())
  }
 }
 Err("DOWNLOAD_TARGET_COLLISION".into())
}
impl DownloadGate{
 fn snapshot(&self,workspace:&str)->Result<Snapshot,String>{
  crate::embedded_webview::label_for(workspace)?;
  let state=self.state.lock().map_err(|_|"DOWNLOAD_GATE_BUSY")?;
  Ok(Snapshot{workspace_id:workspace.into(),
   armed:state.armed.as_ref().is_some_and(|a|a.workspace_id==workspace),
   records:state.records.iter().filter(|r|r.workspace_id==workspace).cloned().collect(),
   source:"NATIVE_ONE_SHOT_DOWNLOAD_GATE",next_prompt_allowed:false})
 }
 pub(crate) fn request(&self,app:&tauri::AppHandle,view:&tauri::Webview,event:DownloadEvent<'_>)->bool{
  match event{
   DownloadEvent::Requested {url,destination}=>{
    let label=view.label().to_string();
    let workspace=label.get(0..10).unwrap_or("").replacen("browser-","workspace-",1);
    let mut state=match self.state.lock(){Ok(s)=>s,Err(_)=>return false};
    let armed=state.armed.take();
    let permitted=armed.as_ref().is_some_and(|a|
       a.view_label==label&&a.workspace_id==workspace&&
       view.url().ok().and_then(|u|origin(&u)).as_deref()==Some(a.origin.as_str())&&
       url.scheme()=="https");
    if !permitted {
      push(&mut state,Record{workspace_id:workspace,status:"BLOCKED",file_name:None});
      return false;
    }
    // Do not use the remote proposed filename or a user-selected absolute path.
    let dir=match app.path().app_local_data_dir(){
      Ok(p)=>p.join("browser-downloads"),Err(_)=>return false
    };
    if safe_root(&dir).is_err(){return false}
    let (path,name)=match file_target(&dir){Ok(v)=>v,Err(_)=>return false};
    *destination=path;
    push(&mut state,Record{workspace_id:workspace,status:"REQUESTED",file_name:Some(name)});
    true
   }
   DownloadEvent::Finished {path,success,..}=>{
    let label=view.label().to_string();
    let workspace=label.get(0..10).unwrap_or("").replacen("browser-","workspace-",1);
    if let Ok(mut state)=self.state.lock(){
     let name=path.file_name().and_then(|s|s.to_str()).map(str::to_owned);
     push(&mut state,Record{workspace_id:workspace,
      status:if success{"FINISHED_UNVERIFIED"}else{"FAILED"},
      file_name:name});
    }
    true
   }
   _=>false,
  }
 }
}
#[tauri::command]
pub(crate) fn browser_download_status(
 webview:tauri::Webview,state:tauri::State<'_,DownloadGate>,
 workspace_id:String
)->Result<serde_json::Value,String>{
 if webview.label()!="main"{return Err("DOWNLOAD_MAIN_WINDOW_REQUIRED".into())}
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"DOWNLOAD_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn arm_browser_download(
 webview:tauri::Webview,
 tabs:tauri::State<'_,crate::browser_support_tabs::BrowserSupportTabs>,
 gate:tauri::State<'_,DownloadGate>,workspace_id:String
)->Result<serde_json::Value,String>{
 if webview.label()!="main"{return Err("DOWNLOAD_MAIN_WINDOW_REQUIRED".into())}
 let label=tabs.active_support_label(&workspace_id)?;
 let target=webview.app_handle().get_webview(&label).ok_or("DOWNLOAD_TAB_MISSING")?;
 let address=target.url().map_err(|_|"DOWNLOAD_PAGE_UNKNOWN")?;
 let origin=origin(&address).ok_or("DOWNLOAD_REQUIRES_HTTPS")?;
 let mut state=gate.state.lock().map_err(|_|"DOWNLOAD_GATE_BUSY")?;
 if state.armed.is_some(){return Err("DOWNLOAD_ALREADY_ARMED".into())}
 state.armed=Some(Arm{workspace_id:workspace_id.clone(),view_label:label,origin});
 drop(state);
 serde_json::to_value(gate.snapshot(&workspace_id)?).map_err(|_|"DOWNLOAD_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn cancel_browser_download_arm(
 webview:tauri::Webview,state:tauri::State<'_,DownloadGate>,
 workspace_id:String
)->Result<serde_json::Value,String>{
 if webview.label()!="main"{return Err("DOWNLOAD_MAIN_WINDOW_REQUIRED".into())}
 crate::embedded_webview::label_for(&workspace_id)?;
 let mut lock=state.state.lock().map_err(|_|"DOWNLOAD_GATE_BUSY")?;
 if lock.armed.as_ref().is_some_and(|a|a.workspace_id==workspace_id){lock.armed=None}
 drop(lock);
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"DOWNLOAD_SNAPSHOT_FAILED".into())
}
