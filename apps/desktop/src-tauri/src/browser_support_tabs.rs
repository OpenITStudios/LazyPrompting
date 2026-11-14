// Supporting tabs own separate WebViews and share the existing normal
// browser profile. The protected main ChatGPT view retains its original label.
use std::{collections::BTreeMap,sync::Mutex};
use serde::Serialize;
use tauri::{Manager,Window,Webview};
#[derive(Default)]
pub(crate) struct BrowserSupportTabs { groups:Mutex<BTreeMap<String,Group>> }
#[derive(Default)]
struct Group { tabs:Vec<u8>,active:u8 }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct Snapshot { workspace_id:String,tabs:Vec<String>,active_tab:String,source:&'static str }
fn id(n:u8)->String{if n==0{"main".into()}else{format!("tab-{n:02}")}}
fn label(workspace:&str,n:u8)->Result<String,String>{
 let base=crate::embedded_webview::label_for(workspace)?;
 if n>3{return Err("SUPPORT_TAB_LIMIT".into())}
 Ok(if n==0{base}else{format!("{base}-tab-{n:02}")})
}
impl BrowserSupportTabs{
 fn snapshot(&self,workspace:&str)->Result<Snapshot,String>{
  label(workspace,0)?;
  let lock=self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?;
  let group=lock.get(workspace);
  Ok(Snapshot{workspace_id:workspace.into(),tabs:group.map(|g|g.tabs.iter().map(|n|id(*n)).collect()).unwrap_or_default(),
   active_tab:id(group.map(|g|g.active).unwrap_or(0)),source:"NATIVE_TAB_REGISTRY"})
 }
 pub(crate) fn hide(&self,window:&Window,workspace:&str)->Result<(),String>{
  let tabs=self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?
   .get(workspace).map(|g|g.tabs.clone()).unwrap_or_default();
  for n in tabs{if let Some(v)=window.get_webview(&label(workspace,n)?){
    v.hide().map_err(|_|"SUPPORT_TAB_HIDE_FAILED")?;
    crate::embedded_webview::set_memory_saving(&v,true);
  }}
  Ok(())
 }
 pub(crate) fn restore(&self,window:&Window,workspace:&str,
  pos:tauri::LogicalPosition<f64>,size:tauri::LogicalSize<f64>)->Result<(),String>{
  let active=self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?
   .get(workspace).map(|g|g.active).unwrap_or(0);
  if active==0{return Ok(())}
  let v=window.get_webview(&label(workspace,active)?).ok_or("SUPPORT_TAB_MISSING")?;
  let main=window.get_webview(&label(workspace,0)?).ok_or("MAIN_TAB_MISSING")?;
  main.hide().map_err(|_|"MAIN_TAB_HIDE_FAILED")?;
  v.set_position(pos).map_err(|_|"SUPPORT_TAB_BOUNDS_FAILED")?;
  v.set_size(size).map_err(|_|"SUPPORT_TAB_BOUNDS_FAILED")?;
  v.show().map_err(|_|"SUPPORT_TAB_SHOW_FAILED")?;
  crate::embedded_webview::set_memory_saving(&v,false);
  Ok(())
 }
 pub(crate) fn close_workspace(&self,window:&Window,workspace:&str)->Result<(),String>{
  self.hide(window,workspace)?;
  let tabs=self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?
   .get(workspace).map(|g|g.tabs.clone()).unwrap_or_default();
  for n in tabs{if let Some(v)=window.get_webview(&label(workspace,n)?){
    v.close().map_err(|_|"SUPPORT_TAB_CLOSE_FAILED")?;
  }}
  self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?.remove(workspace);
  Ok(())
 }
 // Native bookmark owner can read the selected supporting tab only.
 pub(crate) fn active_support_label(&self,workspace:&str)->Result<String,String>{
  let n=self.active(workspace)?;
  if n==0{return Err("BOOKMARK_MAIN_CHAT_PROTECTED".into())}
  label(workspace,n)
 }
 pub(crate) fn active_view_label(&self,workspace:&str)->Result<String,String>{
  label(workspace,self.active(workspace)?)
 }
 fn active(&self,workspace:&str)->Result<u8,String>{
  Ok(self.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?
    .get(workspace).map(|g|g.active).unwrap_or(0))
 }
}
fn parent(view:&Webview)->Result<(),String>{
 if view.label()!="main"{Err("INVALID_PARENT_WINDOW".into())}else{Ok(())}
}
#[tauri::command]
pub(crate) fn browser_tabs_snapshot(view:Webview,
 state:tauri::State<'_,BrowserSupportTabs>,workspace_id:String)->Result<serde_json::Value,String>{
 parent(&view)?;
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"TAB_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn open_support_tab(view:Webview,window:Window,
 state:tauri::State<'_,BrowserSupportTabs>,workspace_id:String,
 address:String,bounds:crate::embedded_webview::ViewBounds)->Result<serde_json::Value,String>{
 parent(&view)?;
 if cfg!(all(windows,debug_assertions)) &&
    std::env::var("LAZY_FIXTURE_BRIDGE_ENABLE").ok().as_deref()==Some("1"){
  return Err("SUPPORT_TABS_UNAVAILABLE_IN_FIXTURE".into());
 }
 let target=crate::embedded_webview::browser_address(&address)?;
 let (pos,size)=crate::embedded_webview::validated_bounds(&bounds)?;
 let home=window.get_webview(&label(&workspace_id,0)?).ok_or("MAIN_TAB_MISSING")?;
 let mut guard=state.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?;
 let group=guard.entry(workspace_id.clone()).or_default();
 let n=(1..=3).find(|n|!group.tabs.contains(n)).ok_or("SUPPORT_TAB_LIMIT")?;
 let new_label=label(&workspace_id,n)?;
 let tab=crate::embedded_webview::create_workspace_view(&window,&new_label,
  tauri::LogicalPosition::new(-10000.0,-10000.0),
  tauri::LogicalSize::new(320.0,240.0),Some(target))?;
 // New WebView is never allowed to overwrite the ChatGPT main tab.
 if let Err(e)=(||{
  tab.set_position(pos).map_err(|_|"SUPPORT_TAB_BOUNDS_FAILED")?;
  tab.set_size(size).map_err(|_|"SUPPORT_TAB_BOUNDS_FAILED")?;
  tab.show().map_err(|_|"SUPPORT_TAB_SHOW_FAILED")?;
  home.hide().map_err(|_|"MAIN_TAB_HIDE_FAILED")?;
  for other in &group.tabs{
   if let Some(v)=window.get_webview(&label(&workspace_id,*other)?){
    v.hide().map_err(|_|"SUPPORT_TAB_HIDE_FAILED")?;
   }
  }
  Ok::<(),String>(())
 })(){let _=tab.close();return Err(e)}
 group.tabs.push(n);group.active=n;
 drop(guard);
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"TAB_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn select_browser_tab(view:Webview,window:Window,
 state:tauri::State<'_,BrowserSupportTabs>,workspace_id:String,tab_id:String,
 bounds:crate::embedded_webview::ViewBounds)->Result<serde_json::Value,String>{
 parent(&view)?;
 let n=if tab_id=="main"{0}else{
  (1..=3).find(|n|id(*n)==tab_id).ok_or("INVALID_SUPPORT_TAB")?
 };
 let (pos,size)=crate::embedded_webview::validated_bounds(&bounds)?;
 let mut guard=state.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?;
 let group=guard.entry(workspace_id.clone()).or_default();
 if n!=0&&!group.tabs.contains(&n){return Err("SUPPORT_TAB_NOT_FOUND".into())}
 let target=window.get_webview(&label(&workspace_id,n)?).ok_or("TAB_NOT_MOUNTED")?;
 target.set_position(pos).map_err(|_|"TAB_BOUNDS_FAILED")?;
 target.set_size(size).map_err(|_|"TAB_BOUNDS_FAILED")?;
 target.show().map_err(|_|"TAB_SHOW_FAILED")?;
 for other in std::iter::once(0).chain(group.tabs.iter().copied()){
  if other==n{continue}
  if let Some(v)=window.get_webview(&label(&workspace_id,other)?){
   v.hide().map_err(|_|"TAB_HIDE_FAILED")?;
   crate::embedded_webview::set_memory_saving(&v,true);
  }
 }
 crate::embedded_webview::set_memory_saving(&target,false);
 group.active=n;drop(guard);
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"TAB_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn close_support_tab(view:Webview,window:Window,
 state:tauri::State<'_,BrowserSupportTabs>,workspace_id:String,tab_id:String,
 bounds:crate::embedded_webview::ViewBounds)->Result<serde_json::Value,String>{
 parent(&view)?;
 let n=(1..=3).find(|n|id(*n)==tab_id).ok_or("MAIN_TAB_PROTECTED")?;
 let (pos,size)=crate::embedded_webview::validated_bounds(&bounds)?;
 let mut guard=state.groups.lock().map_err(|_|"BROWSER_TABS_BUSY")?;
 let group=guard.entry(workspace_id.clone()).or_default();
 if !group.tabs.contains(&n){return Err("SUPPORT_TAB_NOT_FOUND".into())}
 if group.active==n{
  let home=window.get_webview(&label(&workspace_id,0)?).ok_or("MAIN_TAB_MISSING")?;
  home.set_position(pos).map_err(|_|"MAIN_TAB_BOUNDS_FAILED")?;
  home.set_size(size).map_err(|_|"MAIN_TAB_BOUNDS_FAILED")?;
  home.show().map_err(|_|"MAIN_TAB_SHOW_FAILED")?;
  group.active=0;
 }
 if let Some(v)=window.get_webview(&label(&workspace_id,n)?){
  v.close().map_err(|_|"SUPPORT_TAB_CLOSE_FAILED")?;
 }
 group.tabs.retain(|x|*x!=n);drop(guard);
 serde_json::to_value(state.snapshot(&workspace_id)?).map_err(|_|"TAB_SNAPSHOT_FAILED".into())
}
#[tauri::command]
pub(crate) fn browser_active_action(view:Webview,
 state:tauri::State<'_,BrowserSupportTabs>,workspace_id:String,
 action:String,address:Option<String>)->Result<serde_json::Value,String>{
 parent(&view)?;
 let n=state.active(&workspace_id)?;
 if n==0{return crate::embedded_webview::control_browser(
  view.app_handle(),&workspace_id,&action,address.as_deref());}
 let v=view.app_handle().get_webview(&label(&workspace_id,n)?).ok_or("SUPPORT_TAB_MISSING")?;
 if action=="location"&&address.is_none(){
  let mut url=v.url().map_err(|_|"SUPPORT_TAB_ADDRESS_UNAVAILABLE")?;
  url.set_query(None);url.set_fragment(None);
  return Ok(serde_json::json!({"workspaceId":workspace_id,"url":url.as_str()}));
 }
 match (action.as_str(),address.as_deref()){
  ("navigate",Some(url))=>v.navigate(crate::embedded_webview::browser_address(url)?),
  ("back",None)=>v.eval("history.back()"),
  ("forward",None)=>v.eval("history.forward()"),
  ("reload",None)=>v.reload(),
  _=>return Err("INVALID_BROWSER_ACTION".into())
 }.map_err(|_|"SUPPORT_TAB_NAVIGATION_FAILED")?;
 Ok(serde_json::json!({"workspaceId":workspace_id,"navigationRequested":true}))
}

// Native-only zoom: resolve the selected tab from the host-owned tab registry.
// The renderer cannot select an arbitrary WebView label or change app-shell zoom.
#[tauri::command]
pub(crate) fn browser_active_zoom(
 view:Webview,state:tauri::State<'_,BrowserSupportTabs>,
 workspace_id:String,level:u16
)->Result<serde_json::Value,String>{
 parent(&view)?;
 if !matches!(level,75|100|125|150){return Err("INVALID_ZOOM_LEVEL".into())}
 let n=state.active(&workspace_id)?;
 let target=view.app_handle().get_webview(&label(&workspace_id,n)?)
  .ok_or("BROWSER_TAB_NOT_MOUNTED")?;
 target.set_zoom(f64::from(level)/100.0).map_err(|_|"BROWSER_ZOOM_FAILED")?;
 Ok(serde_json::json!({"workspaceId":workspace_id,"tabId":id(n),
  "level":level,"status":"ZOOM_REQUESTED","source":"NATIVE_WEBVIEW",
  "nextPromptAllowed":false}))
}
