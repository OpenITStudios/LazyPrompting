// Operator-requested WebView2 Find API. No DOM traversal, transcript capture,
// scripting or clipboard access. Queries are never logged or persisted.
#[cfg(windows)]
use tauri::Manager;
#[cfg(windows)]
use windows_core::{Interface,PCWSTR};
#[cfg(windows)]
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2_28,ICoreWebView2Environment15,
};
#[cfg(windows)]
use webview2_com::FindStartCompletedHandler;

#[cfg(windows)]
#[tauri::command]
pub(crate) fn browser_find(
    webview:tauri::Webview,
    state:tauri::State<'_,crate::browser_support_tabs::BrowserSupportTabs>,
    workspace_id:String,
    action:String,
    query:Option<String>,
)->Result<serde_json::Value,String>{
    if webview.label()!="main"{return Err("FIND_MAIN_WINDOW_REQUIRED".into())}
    if !matches!(action.as_str(),"start"|"next"|"previous"|"stop"){
        return Err("INVALID_FIND_ACTION".into())
    }
    if action=="start"{
        let term=query.as_deref().ok_or("FIND_TERM_REQUIRED")?;
        if term.is_empty()||term.chars().count()>128||
           term.chars().any(|c|c.is_control()){
            return Err("INVALID_FIND_TERM".into())
        }
    }else if query.is_some(){return Err("FIND_TERM_NOT_ALLOWED".into())}
    // Never accept raw WebView labels from the renderer.
    let label=state.active_view_label(&workspace_id)?;
    let target=webview.app_handle().get_webview(&label)
        .ok_or("FIND_WEBVIEW_CLOSED")?;
    let term=query;
    let command=action.clone();
    let app=webview.app_handle().clone();
    let workspace=workspace_id.clone();
    let tab_id=label.rsplit_once("-tab-")
        .map(|(_,n)|format!("tab-{n}")).unwrap_or_else(||"main".into());
    target.with_webview(move|platform|{
        let result=(||->Result<(),windows_core::Error>{
            // WebView2 COM methods are unsafe and run only on the WebView UI thread.
            unsafe{
            let core=platform.controller().CoreWebView2()?
                .cast::<ICoreWebView2_28>()?;
            let find=core.Find()?;
            match command.as_str(){
                "start"=>{
                    let env=platform.environment().cast::<ICoreWebView2Environment15>()?;
                    let options=env.CreateFindOptions()?;
                    let value=term.as_deref().unwrap_or_default();
                    let wide:Vec<u16>=value.encode_utf16().chain(std::iter::once(0)).collect();
                    options.SetFindTerm(PCWSTR(wide.as_ptr()))?;
                    options.SetSuppressDefaultFindDialog(true)?;
                    options.SetShouldHighlightAllMatches(true)?;
                    // Starting is async; this handler does not expose page text.
                    let done=FindStartCompletedHandler::create(Box::new(|_|Ok(())));
                    find.Start(&options,&done)?;
                },
                "next"=>{find.FindNext()?;},
                "previous"=>{find.FindPrevious()?;},
                "stop"=>{find.Stop()?;},
                _=>unreachable!(),
            };
            Ok(())
            }
        })();
        if result.is_err(){
            use tauri::Emitter;
            if let Some(main)=app.get_webview("main"){
                let _=main.emit_to(tauri::EventTarget::webview("main"),
                    "browser-find-error",serde_json::json!({
                       "workspaceId":workspace,"tabId":tab_id,
                       "reason":"NATIVE_FIND_NOT_AVAILABLE"
                    }));
            }
        }
    }).map_err(|_|"FIND_DISPATCH_FAILED")?;
    Ok(serde_json::json!({"workspaceId":workspace_id,
       "status":"FIND_REQUESTED","source":"NATIVE_WEBVIEW_FIND",
       "nextPromptAllowed":false,"resultVerified":false}))
}
