// Keyboard navigation is an operator-only UI decision, not browser automation.
// Browser focus may be owned by WebView2 and not reach the Svelte document.
export function browserShortcut({key="",ctrlKey=false,metaKey=false,altKey=false,
 shiftKey=false,editable=false,activeTab="main",tabs=[]}={}){
 if(editable||shiftKey)return null;
 const ctrl=ctrlKey||metaKey;
 if(ctrl&&!altKey){
  const k=key.toLowerCase();
  if(k==="l")return {type:"ADDRESS"};
  if(k==="t")return {type:"NEW_TAB"};
  if(k==="w")return activeTab==="main"?null:{type:"CLOSE_TAB",tabId:activeTab};
  if(k==="r")return {type:"RELOAD"};
  if(/^[1-4]$/.test(k)){
   const tabId=k==="1"?"main":tabs[Number(k)-2];
   return tabId?{type:"SELECT_TAB",tabId}:null;
  }
 }
 if(altKey&&!ctrlKey){
  if(key==="ArrowLeft")return {type:"BACK"};
  if(key==="ArrowRight")return {type:"FORWARD"};
  if(key==="Home")return {type:"MAIN_TAB"};
 }
 return null;
}
