// One host-owned WebView2 observation contract for desktop UI and installed
// stdio MCP/CLI. No second browser, daemon, relay or agent runtime.
// Page-derived text is untrusted; use only after operator's one-shot consent.
use std::{collections::{BTreeMap,HashSet},net::IpAddr,sync::{Arc,Mutex},time::{Duration,Instant}};
use serde_json::{json,Value};
use tauri::{Manager,Webview};

const GRANT_TTL:Duration=Duration::from_secs(60);
const MAX_RAW_UNITS:usize=128_000;
const MAX_LINES:usize=36;
const MAX_OUTPUT_BYTES:usize=4096;
const MAX_LABEL_CHARS:usize=96;

#[derive(Default)]
pub(crate) struct BrowserObservation {
 grants:Mutex<BTreeMap<String,Grant>>,
 previous:Mutex<BTreeMap<String,Previous>>,
}
struct Grant {label:String,url:String,created:Instant}
struct Previous {label:String,url:String,lines:Vec<String>}

fn safe_origin(url:&tauri::Url)->Option<String>{
 if url.scheme()!="https"||url.query().is_some()||url.fragment().is_some()||
    !url.username().is_empty()||url.password().is_some()||
    url.as_str().len()>2048{return None}
 let host=url.host_str()?.trim_end_matches('.').to_ascii_lowercase();
 if host.is_empty()||host.parse::<IpAddr>().is_ok()||
    host=="localhost"||[".localhost",".local",".lan",".internal",".onion"]
      .iter().any(|suffix|host.ends_with(suffix))||
    host=="chatgpt.com"||host.ends_with(".chatgpt.com")||
    host=="openai.com"||host.ends_with(".openai.com") {return None}
 Some(url.origin().ascii_serialization())
}
fn validate_mode(mode:&str)->Result<(),String>{
 if matches!(mode,"compact"|"delta"){Ok(())}else{Err("OBSERVATION_INVALID_MODE".into())}
}
impl BrowserObservation{
 fn arm(&self,workspace:&str,label:String,url:String)->Result<(),String>{
  crate::embedded_webview::label_for(workspace)?;
  let mut guard=self.grants.lock().map_err(|_|"OBSERVATION_BUSY")?;
  guard.insert(workspace.into(),Grant{label,url,created:Instant::now()});
  Ok(())
 }
 fn take(&self,workspace:&str,label:&str,url:&str)->Result<(),String>{
  let mut guard=self.grants.lock().map_err(|_|"OBSERVATION_BUSY")?;
  let grant=guard.remove(workspace).ok_or("OBSERVATION_APPROVAL_REQUIRED")?;
  if grant.created.elapsed()>GRANT_TTL||grant.label!=label||grant.url!=url {
   return Err("OBSERVATION_APPROVAL_EXPIRED_OR_CHANGED".into())
  }
  Ok(())
 }
 pub(crate) fn clear_tab(&self,workspace:&str,label:&str){
  if let Ok(mut grants)=self.grants.lock(){
   if grants.get(workspace).is_some_and(|g|g.label==label){grants.remove(workspace);}
  }
  if let Ok(mut prev)=self.previous.lock(){
   if prev.get(workspace).is_some_and(|p|p.label==label){prev.remove(workspace);}
  }
 }
 pub(crate) fn cancel_grant(&self,workspace:&str){
  if let Ok(mut map)=self.grants.lock(){map.remove(workspace);}
 }
 pub(crate) fn clear_workspace(&self,workspace:&str){
  if let Ok(mut map)=self.grants.lock(){map.remove(workspace);}
  if let Ok(mut map)=self.previous.lock(){map.remove(workspace);}
 }
 fn status(&self,workspace:&str)->Result<Value,String>{
  crate::embedded_webview::label_for(workspace)?;
  let map=self.grants.lock().map_err(|_|"OBSERVATION_BUSY")?;
  let grant=map.get(workspace);
  Ok(json!({"workspaceId":workspace,
    "armed":grant.is_some_and(|g|g.created.elapsed()<=GRANT_TTL),
    "tabId":grant.map(|g|tab_id(&g.label)).unwrap_or_default(),
    "source":"NATIVE_BROWSER_OBSERVATION",
    "readOnly":true,"nextPromptAllowed":false}))
 }
 fn project(&self,workspace:&str,label:&str,url:&str,mode:&str,lines:Vec<String>)
    ->Result<Value,String>{
  let mut cache=self.previous.lock().map_err(|_|"OBSERVATION_BUSY")?;
  let previous=cache.get(workspace);
  let valid=previous.is_some_and(|p|p.label==label&&p.url==url);
  let (effective,output)=if mode=="delta"&&valid{
   let older=&previous.unwrap().lines;
   let current:HashSet<&String>=lines.iter().collect();
   let past:HashSet<&String>=older.iter().collect();
   let mut changes=Vec::new();
   for line in older.iter().filter(|line|!current.contains(line)){changes.push(format!("- {line}"))}
   for line in lines.iter().filter(|line|!past.contains(line)){changes.push(format!("+ {line}"))}
   ("delta",if changes.is_empty(){vec!["(no observed changes)".into()]}else{changes})
  }else{("compact",lines.clone())};
  let mut text=String::new();
  let mut limited=false;
  for line in output{
   if text.len()+line.len()+1>MAX_OUTPUT_BYTES{limited=true;break}
   text.push_str(&line);text.push('\n');
  }
  cache.insert(workspace.into(),Previous{label:label.into(),url:url.into(),lines:lines.clone()});
  Ok(json!({"workspaceId":workspace,"tabId":tab_id(label),
   "mode":effective,"content":text,"items":lines.len(),
   "truncated":limited,"source":"NATIVE_WEBVIEW2_AX_CDP",
   "status":"OBSERVED_UNVERIFIED_PAGE_CONTENT","readOnly":true,
   "snapshotLocalRefs":true,"nextPromptAllowed":false,
   "resultVerified":false}))
 }
}
fn tab_id(label:&str)->String{
 label.strip_prefix(&format!("{}-tab-",label.get(..10).unwrap_or("")))
   .map(|n|format!("tab-{n}")).unwrap_or_else(||"main".into())
}
fn label_text(raw:&str)->String{
 let clean=raw.chars().filter(|c|!c.is_control()).take(MAX_LABEL_CHARS).collect::<String>();
 let lower=clean.to_ascii_lowercase();
 let digits=clean.chars().filter(|c|c.is_ascii_digit()).count();
 if digits>=12||["api_key","access_token","secret=","bearer ","password:"]
    .iter().any(|term|lower.contains(term)){
  return "[redacted]".into()
 }
 clean.split_whitespace().collect::<Vec<_>>().join(" ")
}
fn compact_ax(payload:&str)->Result<Vec<String>,String>{
 let root:Value=serde_json::from_str(payload).map_err(|_|"OBSERVATION_CDP_INVALID")?;
 let nodes=root.get("nodes").and_then(Value::as_array).ok_or("OBSERVATION_AX_UNAVAILABLE")?;
 let roles=["button","link","textbox","searchbox","checkbox","radio","switch",
   "combobox","option","menuitem","tab","heading","status","alert"];
 let mut lines=Vec::new();
 for node in nodes{
  if node.get("ignored").and_then(Value::as_bool)==Some(true){continue}
  let role=node.pointer("/role/value").and_then(Value::as_str).unwrap_or("");
  if !roles.contains(&role){continue}
  // Never emit node.value, attributes, backendNodeId, URLs, DOM or input contents.
  let name=node.pointer("/name/value").and_then(Value::as_str).unwrap_or("");
  if name.is_empty(){continue}
  let label=label_text(name);
  if label.is_empty(){continue}
  let line=format!("@e{} {} {}",lines.len()+1,role,
     serde_json::to_string(&label).map_err(|_|"OBSERVATION_LABEL_INVALID")?);
  lines.push(line);
  if lines.len()>=MAX_LINES{break}
 }
 Ok(lines)
}

#[tauri::command]
pub(crate) fn browser_observation_arm(
 view:Webview,workspace_id:String,
 tabs:tauri::State<'_,crate::browser_support_tabs::BrowserSupportTabs>,
 state:tauri::State<'_,BrowserObservation>
)->Result<Value,String>{
 if view.label()!="main"{return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into())}
 let label=tabs.active_support_label(&workspace_id)?;
 let tab=view.app_handle().get_webview(&label).ok_or("OBSERVATION_TAB_NOT_FOUND")?;
 let url=tab.url().map_err(|_|"OBSERVATION_URL_UNAVAILABLE")?;
 safe_origin(&url).ok_or("OBSERVATION_SITE_NOT_ELIGIBLE")?;
 state.arm(&workspace_id,label,url.to_string())?;
 state.status(&workspace_id)
}
#[tauri::command]
pub(crate) fn browser_observation_cancel(
 view:Webview,workspace_id:String,
 state:tauri::State<'_,BrowserObservation>
)->Result<Value,String>{
 if view.label()!="main"{return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into())}
 state.clear_workspace(&workspace_id);
 state.status(&workspace_id)
}
#[tauri::command]
pub(crate) fn browser_observation_status(
 view:Webview,workspace_id:String,
 state:tauri::State<'_,BrowserObservation>
)->Result<Value,String>{
 if view.label()!="main"{return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into())}
 state.status(&workspace_id)
}
#[tauri::command]
pub(crate) async fn browser_observe(
 view:Webview,workspace_id:String,mode:Option<String>
)->Result<Value,String>{
 if view.label()!="main"{return Err("OBSERVATION_MAIN_WINDOW_REQUIRED".into())}
 observe(view.app_handle(),&workspace_id,mode.as_deref().unwrap_or("compact")).await
}
pub(crate) async fn observe(
 app:&tauri::AppHandle,workspace:&str,mode:&str
)->Result<Value,String>{
 validate_mode(mode)?;
 let tabs=app.state::<crate::browser_support_tabs::BrowserSupportTabs>();
 let label=tabs.active_support_label(workspace)?;
 let view=app.get_webview(&label).ok_or("OBSERVATION_TAB_NOT_FOUND")?;
 let address=view.url().map_err(|_|"OBSERVATION_URL_UNAVAILABLE")?;
 safe_origin(&address).ok_or("OBSERVATION_SITE_NOT_ELIGIBLE")?;
 let url=address.to_string();
 let state=app.state::<BrowserObservation>();
 // Authorization is consumed before reading even if the CDP call fails.
 state.take(workspace,&label,&url)?;
 let raw=read_ax_tree(&view).await?;
 // Prevent same-tab navigation or a workspace tab switch from leaking a
 // response whose original approval no longer matches.
 if tabs.active_support_label(workspace)?!=label||
    view.url().map_err(|_|"OBSERVATION_URL_UNAVAILABLE")?.as_str()!=url {
   return Err("OBSERVATION_TAB_CHANGED".into())
 }
 let lines=compact_ax(&raw)?;
 state.project(workspace,&label,&url,mode,lines)
}
async fn read_ax_tree(view:&Webview)->Result<String,String>{
 use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
 use windows_core::PCWSTR;
 let (tx,rx)=tokio::sync::oneshot::channel::<Result<String,String>>();
 let sender=Arc::new(Mutex::new(Some(tx)));
 let handle=Arc::clone(&sender);
 view.with_webview(move|platform|{
  let operation=(||->windows_core::Result<()>{
   unsafe{
    let core=platform.controller().CoreWebView2()?;
    let callback=CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
     move |hr,result|{
      let reply=if !hr.is_ok(){Err("OBSERVATION_CDP_FAILED".into())}
       else if result.is_null(){Err("OBSERVATION_CDP_EMPTY".into())}
       else if result.len()>MAX_RAW_UNITS{Err("OBSERVATION_CDP_TOO_LARGE".into())}
       else{result.to_string().map_err(|_|"OBSERVATION_CDP_INVALID_UTF16".into())};
      if let Ok(mut lock)=handle.lock(){
       if let Some(sender)=lock.take(){let _=sender.send(reply);}
      }
      Ok(())
     }));
    let method:Vec<u16>="Accessibility.getFullAXTree".encode_utf16()
       .chain(std::iter::once(0)).collect();
    let params:Vec<u16>="{}".encode_utf16().chain(std::iter::once(0)).collect();
    core.CallDevToolsProtocolMethod(
      PCWSTR(method.as_ptr()),PCWSTR(params.as_ptr()),&callback)?;
    Ok(())
   }
  })();
  if operation.is_err(){
   if let Ok(mut lock)=sender.lock(){
    if let Some(tx)=lock.take(){let _=tx.send(Err("OBSERVATION_CDP_DISPATCH_FAILED".into()));}
   }
  }
 }).map_err(|_|"OBSERVATION_WEBVIEW_UNAVAILABLE")?;
 tokio::time::timeout(Duration::from_secs(3),rx)
  .await.map_err(|_|"OBSERVATION_CDP_TIMEOUT")?
  .map_err(|_|"OBSERVATION_CDP_DROPPED")?
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]
 fn compact_ax_only_projects_bounded_public_semantic_labels(){
  let input=json!({"nodes":[
    {"role":{"value":"button"},"name":{"value":"Open menu"}},
    {"role":{"value":"textbox"},"name":{"value":"Search docs"},
      "value":{"value":"private query"}},
    {"role":{"value":"generic"},"name":{"value":"private body text"}},
    {"role":{"value":"button"},"name":{"value":"secret=123"}}
  ]}).to_string();
  let lines=compact_ax(&input).unwrap();
  assert_eq!(lines.len(),3);
  assert!(lines[0].contains("Open menu"));
  assert!(lines[1].contains("Search docs"));
  assert!(!lines.join(" ").contains("private query"));
  assert!(!lines.join(" ").contains("private body"));
  assert!(lines[2].contains("[redacted]"));
 }
 #[test]
 fn grant_is_one_shot_and_bound_to_tab(){
  let gate=BrowserObservation::default();
  gate.arm("workspace-01","browser-01-tab-01".into(),
    "https://example.com/".into()).unwrap();
  assert!(gate.take("workspace-01","browser-01-tab-02",
    "https://example.com/").is_err());
  assert!(gate.take("workspace-01","browser-01-tab-01",
    "https://example.com/").is_err());
 }
}
