/* Shared Helium/WebView2 New Chat: navigation only.
 * The content script cannot attest a native Work checkpoint, pending
 * PromptOutbox or chat rebind. A previous Chat A is NEVER deleted here.
 * Stale pending-delete storage from older extension versions is inert.
 */
(() => {
  "use strict";
  if(globalThis.__lpCompanionNewChat)return;
  const C=globalThis.__lpCompanionCore;
  if(!C)return;
  let starting=false;
  async function begin(oldId){
    if(starting||typeof oldId!=="string"||
       C.safeChatId(globalThis.location?.href??"")!==oldId)return false;
    starting=true;
    try{
      // Explicit operator navigation; not native rollover or send proof.
      globalThis.location.assign("https://chatgpt.com/");
      return true;
    }catch{return false;}
    finally{starting=false;}
  }
  // Preserve the existing toolbar interface; no extra state/permission owner.
  globalThis.__lpCompanionNewChat=Object.freeze({begin,resultFor:()=>null});
})();
