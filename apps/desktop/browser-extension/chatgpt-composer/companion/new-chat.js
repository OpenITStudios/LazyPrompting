/* LazyPrompting user-initiated New Chat rollover through ChatGPT's visible UI.
 * No private endpoints, transcript extraction, arbitrary chat lookup, bulk
 * deletion, background polling, or automatic retry of a destructive action.
 * An exact old conversation ID is armed only by the operator's button click.
 * A distinct saved Chat B is required before Chat A's own menu is touched.
 * The request for deletion is never proof of server-side removal.
 */
(() => {
  "use strict";
  if(globalThis.__lpCompanionNewChat)return;
  const C=globalThis.__lpCompanionCore;
  if(!C)return;
  const PENDING_KEY="lp-companion-new-chat-pending-v1";
  const RESULT_KEY="lp-companion-new-chat-result-v1";
  const TAB_KEY="lp-companion-new-chat-tab-v1";
  const SENT_KEY="lp-companion-new-chat-first-send-v1";
  const MAX_AGE=20*60*1000;
  const MENU_SELECTOR='[data-testid="delete-chat-menu-item"]';
  const DIALOG_SELECTOR='[data-testid="modal-delete-conversation-confirmation"]';
  const CONFIRM_SELECTOR='button[data-testid="delete-conversation-confirm-button"]';
  let last=null,busy=false,starting=false,scheduled=null,lastScan=0,stableId=null,stableSince=0;
  const api=globalThis.chrome?.storage?.local??null;

  function validId(id){
    return typeof id==="string"&&
      C.safeChatId("https://chatgpt.com/c/"+id)===id;
  }
  function validPending(p,now=Date.now()){
    return Boolean(p&&p.version===1&&p.phase==="AWAIT_CHAT_B"&&
      validId(p.oldId)&&typeof p.nonce==="string"&&
      /^[a-f0-9-]{36}$/i.test(p.nonce)&&Number.isSafeInteger(p.startedAt)&&
      now>=p.startedAt&&now-p.startedAt<=MAX_AGE);
  }
  function tabNonce(){
    try{return sessionStorage.getItem(TAB_KEY);}catch{return null;}
  }
  function clearTab(){
    try{sessionStorage.removeItem(TAB_KEY);
      sessionStorage.removeItem(SENT_KEY);}catch{}
  }
  function sawFirstSend(nonce){
    try{
      const value=JSON.parse(sessionStorage.getItem(SENT_KEY)??"null");
      const age=Date.now()-value?.at;
      return value?.nonce===nonce&&Number.isSafeInteger(value.at)&&
        age>=0&&age<=5*60*1000;
    }catch{return false;}
  }
  // The first send must originate from the blank New Chat page in this
  // same tab. Mere navigation to an existing saved chat is not enough.
  function noteComposeAction(event){
    if(!event?.isTrusted||globalThis.location?.pathname!=="/"||!tabNonce())return;
    const target=event.target;
    if(!target?.closest)return;
    const composer=target.closest('#prompt-textarea,[data-testid="composer-text-input"]');
    const send=event.type==="click"&&
      target.closest('button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]');
    const form=event.type==="submit"&&target.closest("form")&&
      target.querySelector?.('#prompt-textarea,[data-testid="composer-text-input"]');
    const enter=event.type==="keydown"&&event.key==="Enter"&&!event.shiftKey&&composer;
    if(!send&&!form&&!enter)return;
    try{
      if(!sessionStorage.getItem(SENT_KEY))
        sessionStorage.setItem(SENT_KEY,JSON.stringify({
          nonce:tabNonce(),at:Date.now()
        }));
    }catch{}
  }
  function isVisible(el){
    return Boolean(el&&el.isConnected!==false&&
      typeof el.getClientRects==="function"&&el.getClientRects().length>0);
  }
  function matchesOldHref(href,oldId){
    if(typeof href!=="string"||!validId(oldId))return false;
    try{
      const url=new URL(href,"https://chatgpt.com");
      return url.origin==="https://chatgpt.com"&&url.pathname==="/c/"+oldId&&
        !url.search&&!url.hash;
    }catch{return false;}
  }
  function locateOldRow(root,oldId){
    if(!root?.querySelectorAll||!validId(oldId))return null;
    const matches=Array.from(root.querySelectorAll("a[href]")).filter(a=>
      matchesOldHref(a.getAttribute?.("href"),oldId)&&
      a.closest?.('nav,aside,[role="navigation"],#history')&&isVisible(a));
    if(matches.length!==1)return null;
    const a=matches[0];
    const SELECTOR='button[data-testid^="history-item-"][data-testid$="-options"],button[aria-label^="Open conversation options for"]';
    for(let row=a.parentElement,depth=0;row&&depth<7;row=row.parentElement,depth++){
      if(row.matches?.('nav,aside,[role="navigation"],#history'))break;
      const options=Array.from(row.querySelectorAll?.(SELECTOR)??[]);
      const chatLinks=Array.from(row.querySelectorAll?.('a[href]')??[]).filter(link=>
        /^\/c\/[0-9a-f-]{36}$/i.test(link.getAttribute?.("href")??""));
      if(options.length===1&&chatLinks.length===1&&chatLinks[0]===a&&
         isVisible(options[0])){
        return {link:a,row,options:options[0]};
      }
    }
    return null;
  }
  function uniqueVisible(root,selector){
    const nodes=Array.from(root?.querySelectorAll?.(selector)??[]).filter(isVisible);
    return nodes.length===1?nodes[0]:null;
  }
  function noConflictingDialog(root){
    return !Array.from(root?.querySelectorAll?.('[role="dialog"],[role="alertdialog"]')??[])
      .some(el=>isVisible(el));
  }
  function waitFor(root,lookup,timeout=3500){
    const first=lookup();
    if(first)return Promise.resolve(first);
    return new Promise(resolve=>{
      let done=false;
      const finish=value=>{
        if(done)return;done=true;
        obs?.disconnect();clearTimeout(timer);resolve(value);
      };
      const obs=new MutationObserver(()=>{const found=lookup();if(found)finish(found);});
      obs.observe(root.documentElement??root,{childList:true,subtree:true,attributes:true,
        attributeFilter:["aria-expanded","data-state","hidden"]});
      const timer=setTimeout(()=>finish(null),timeout);
    });
  }
  function currentSavedChat(){
    return C.safeChatId(globalThis.location?.href??"");
  }
  function newChatReady(oldId){
    const id=currentSavedChat();
    if(!id||id===oldId)return null;
    const editor=document.querySelector('#prompt-textarea,[data-testid="composer-text-input"]');
    const turns=C.turns(document,3);
    return editor&&turns.length>0?id:null;
  }
  function broadcast(){
    document?.dispatchEvent?.(new Event("lp-companion-new-chat-state"));
  }
  function resultFor(id){
    return last&&validId(id)&&last.chatId===id&&
      Date.now()-last.at<10*60*1000?last.state:null;
  }
  async function finish(pending,newId,state){
    if(!api)return;
    last={chatId:newId,state,at:Date.now()};
    try{
      const current=(await api.get(PENDING_KEY))?.[PENDING_KEY];
      if(current?.nonce===pending.nonce){
        await api.set({[RESULT_KEY]:last});
        await api.remove(PENDING_KEY);
      }
    }catch{last={chatId:newId,state:"OLD_CHAT_RESULT_UNAVAILABLE",at:Date.now()};}
    clearTab();broadcast();
  }
  function canContinue(pending,newId){
    return tabNonce()===pending.nonce&&newId!==pending.oldId&&
      currentSavedChat()===newId&&Boolean(newChatReady(pending.oldId));
  }
  async function requestDelete(pending,newId){
    if(!canContinue(pending,newId)||!noConflictingDialog(document))return false;
    const target=locateOldRow(document,pending.oldId);
    if(!target)return false;
    // Another open menu or delete dialog is not ours; never act on it.
    if(uniqueVisible(document,MENU_SELECTOR)||uniqueVisible(document,DIALOG_SELECTOR)||
       uniqueVisible(document,'[role="menu"]'))return false;
    if(!canContinue(pending,newId))return false;
    target.options.click();
    const item=await waitFor(document,()=>uniqueVisible(document,MENU_SELECTOR));
    if(!item||!canContinue(pending,newId))return false;
    if(target.options.hasAttribute("aria-expanded")&&
       target.options.getAttribute("aria-expanded")==="false")return false;
    item.click();
    const dialog=await waitFor(document,()=>uniqueVisible(document,DIALOG_SELECTOR));
    if(!dialog||!canContinue(pending,newId))return false;
    const confirm=uniqueVisible(dialog,CONFIRM_SELECTOR);
    if(!confirm||confirm.disabled||!canContinue(pending,newId))return false;
    // The exact old sidebar row was selected. Click the one native
    // confirmation button, without suppressing ChatGPT's own dialog.
    confirm.click();
    return true; // UI request issued; not server deletion verification.
  }
  async function begin(oldId){
    if(!api||starting||currentSavedChat()!==oldId||!validId(oldId))return false;
    const cryptoApi=globalThis.crypto;
    if(typeof cryptoApi?.randomUUID!=="function")return false;
    starting=true;
    let nonce=null;
    try{
      const existing=(await api.get(PENDING_KEY))?.[PENDING_KEY];
      if(validPending(existing))return false; // never overwrite active rollover
      nonce=cryptoApi.randomUUID();
      sessionStorage.setItem(TAB_KEY,nonce);
      sessionStorage.removeItem(SENT_KEY);
      const pending={version:1,phase:"AWAIT_CHAT_B",
        oldId,nonce,startedAt:Date.now()};
      await api.set({[PENDING_KEY]:pending,[RESULT_KEY]:null});
      last=null;
      globalThis.location.assign("https://chatgpt.com/");
      return true;
    }catch{
      if(nonce&&tabNonce()===nonce)clearTab();
      return false;
    }finally{starting=false;}
  }
  async function resume(){
    if(!api||busy||starting)return;
    busy=true;
    try{
      const snapshot=await api.get([PENDING_KEY,RESULT_KEY]);
      const record=snapshot[PENDING_KEY];
      if(snapshot[RESULT_KEY]&&typeof snapshot[RESULT_KEY]==="object")
        last=snapshot[RESULT_KEY];
      if(!record||tabNonce()!==record.nonce)return;
      if(!validPending(record)){
        if(record.phase==="DELETE_ATTEMPTED"&&validId(record.newId)){
          await finish(record,record.newId,"OLD_CHAT_DELETE_UNVERIFIED");
        }else{
          await api.remove(PENDING_KEY);
          clearTab();
        }
        return;
      }
      if(!sawFirstSend(record.nonce))return;
      const newId=newChatReady(record.oldId);
      if(!newId)return;
      if(stableId!==newId){
        stableId=newId;stableSince=Date.now();schedule();return;
      }
      if(Date.now()-stableSince<700){schedule();return;}
      // Persist the one-shot destructive attempt BEFORE touching any menu.
      // A page reload/crash cannot replay a delete without another click.
      const locked={...record,phase:"DELETE_ATTEMPTED",newId};
      await api.set({[PENDING_KEY]:locked});
      let submitted=false;
      try{submitted=await requestDelete(record,newId);}catch{}
      await finish(locked,newId,submitted?"DELETE_REQUESTED":"OLD_CHAT_RETAINED");
    }catch{
      // Failed storage/DOM reads are not authorization to retry deletion.
    }finally{busy=false;}
  }
  function schedule(){
    if(scheduled!==null)return;
    scheduled=setTimeout(()=>{
      scheduled=null;lastScan=Date.now();void resume();
    },Math.max(80,850-(Date.now()-lastScan)));
  }
  const controller=Object.freeze({
    begin,resume,resultFor,validPending,matchesOldHref,locateOldRow,newChatReady,
    PENDING_KEY,RESULT_KEY,TAB_KEY
  });
  globalThis.__lpCompanionNewChat=controller;
  if(api&&globalThis.document?.documentElement){
    document.addEventListener("click",noteComposeAction,true);
    document.addEventListener("keydown",noteComposeAction,true);
    document.addEventListener("submit",noteComposeAction,true);
    const observer=new MutationObserver(schedule);
    observer.observe(document.documentElement,{subtree:true,childList:true});
    globalThis.addEventListener?.("popstate",schedule);
    globalThis.addEventListener?.("hashchange",schedule);
    document.addEventListener?.("visibilitychange",()=>{
      if(document.visibilityState!=="hidden")schedule();
    });
    schedule();
  }
})();

