// Native, application-owned site-permission policy. Browser cookies and
// ordinary login storage remain shared, but no permission can be granted from
// a website, UI flag, prompt, or untrusted renderer payload.
use std::{collections::{BTreeMap,VecDeque},sync::Mutex};
use serde::Serialize;
use tauri::webview::{PermissionKind,PermissionResponse};

const MAX_EVENTS:usize=20;
#[derive(Default)]
pub(crate) struct BrowserSitePermissions {
    events:Mutex<BTreeMap<String,VecDeque<DeniedEvent>>>,
}
#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
struct DeniedEvent { permission:String,status:&'static str }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct PermissionSnapshot {
    workspace_id:String,
    policy:&'static str,
    events:Vec<DeniedEvent>,
    source:&'static str,
    next_prompt_allowed:bool,
}
fn safe_kind(kind:PermissionKind)->&'static str{
    match kind{
        PermissionKind::Microphone=>"Microphone",
        PermissionKind::Camera=>"Camera",
        PermissionKind::Geolocation=>"Geolocation",
        PermissionKind::Notifications=>"Notifications",
        PermissionKind::ClipboardRead=>"ClipboardRead",
        PermissionKind::DisplayCapture=>"DisplayCapture",
        PermissionKind::Midi=>"Midi",
        PermissionKind::Sensors=>"Sensors",
        PermissionKind::LocalFonts=>"LocalFonts",
        PermissionKind::WindowManagement=>"WindowManagement",
        PermissionKind::PointerLock=>"PointerLock",
        PermissionKind::AutomaticDownloads=>"AutomaticDownloads",
        PermissionKind::FileSystemAccess=>"FileSystemAccess",
        PermissionKind::Autoplay=>"Autoplay",
        PermissionKind::MediaKeySystemAccess=>"MediaKeySystemAccess",
        PermissionKind::Other=>"Other",
        _=>"Other",
    }
}
fn workspace_for_label(label:&str)->Option<String>{
    let first=label.get(..10)?;
    let id=first.strip_prefix("browser-")?;
    if id.len()!=2||!matches!(id,"01"|"02"|"03"|"04"|"05"|"06"|"07"|"08"|"09"|"10"){
        return None
    }
    if label!=first && !matches!(label.get(10..),Some("-tab-01"|"-tab-02"|"-tab-03")){
        return None
    }
    Some(format!("workspace-{id}"))
}
impl BrowserSitePermissions {
    pub(crate) fn respond(&self,label:&str,kind:PermissionKind)->PermissionResponse{
        // Unknown labels are denied without recording a workspace identity.
        if let Some(id)=workspace_for_label(label){
            if let Ok(mut map)=self.events.lock(){
                let list=map.entry(id).or_default();
                list.push_front(DeniedEvent{
                    permission:safe_kind(kind).to_owned(),status:"DENIED",
                });
                list.truncate(MAX_EVENTS);
            }
        }
        PermissionResponse::Deny
    }
    fn snapshot(&self,workspace:&str)->Result<PermissionSnapshot,String>{
        crate::embedded_webview::label_for(workspace)?;
        let events=self.events.lock().map_err(|_|"SITE_PERMISSION_STATE_UNAVAILABLE")?;
        Ok(PermissionSnapshot{
            workspace_id:workspace.to_owned(),
            policy:"DENY_NEW_REQUESTS",
            events:events.get(workspace).map(|list|list.iter().cloned().collect())
                .unwrap_or_default(),
            source:"NATIVE_WEBVIEW_PERMISSION_POLICY",
            next_prompt_allowed:false,
        })
    }
}
#[tauri::command]
pub(crate) fn browser_site_permission_status(
    view:tauri::Webview,
    state:tauri::State<'_,BrowserSitePermissions>,
    workspace_id:String,
)->Result<serde_json::Value,String>{
    if view.label()!="main"{return Err("SITE_PERMISSION_MAIN_WINDOW_REQUIRED".into())}
    serde_json::to_value(state.snapshot(&workspace_id)?)
        .map_err(|_|"SITE_PERMISSION_SNAPSHOT_FAILED".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browser_labels_are_scoped(){
        assert_eq!(workspace_for_label("browser-01"),Some("workspace-01".into()));
        assert_eq!(workspace_for_label("browser-10-tab-03"),Some("workspace-10".into()));
        for label in ["main","browser-00","browser-11","browser-01-tab-04",
            "browser-01-not-tab","browser-1","browser-01-tab-01-extra"]{
            assert!(workspace_for_label(label).is_none(),"{label}");
        }
    }
    #[test]
    fn permission_requests_are_denied_and_bounded(){
        let policy=BrowserSitePermissions::default();
        for _ in 0..22{
            assert!(matches!(policy.respond("browser-01-tab-01",
                PermissionKind::Geolocation),PermissionResponse::Deny));
        }
        let one=policy.snapshot("workspace-01").unwrap();
        assert_eq!(one.events.len(),20);
        assert_eq!(one.events[0].permission,"Geolocation");
        assert!(policy.snapshot("workspace-02").unwrap().events.is_empty());
        assert_eq!(one.policy,"DENY_NEW_REQUESTS");
    }
}
