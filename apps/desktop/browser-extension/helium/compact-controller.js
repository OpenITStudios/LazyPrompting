/* Always-on Compact History for Helium; no settings, no extra toolbar.
 * Reads only the separate Usage Meter's rendered token estimate and
 * ChatGPT's structural turn markers. No transcript extraction. */
(() => {
  "use strict";
  if(globalThis.__lpHeliumCompactActive)return;
  const C=globalThis.__lpCompanionCore;
  const M=globalThis.__lpCompactHistory;
  const U=globalThis.__lpHeliumUsageSignal;
  if(!C||!M||!U)return;
  globalThis.__lpHeliumCompactActive=true;
  let active=null,timer=null,lastScan=0,toast=null,pending=null,since=0;
  const warned=new Map();
  const level={UNKNOWN:0,NORMAL:0,CHECKPOINT:1,PREPARE:2,STOP:3};
  function dismiss(){
    if(toast){toast.remove();toast=null;}
  }
  function notify(chat,stage){
    const rank=level[stage]??0;
    if(!chat||rank<=0||rank<=(warned.get(chat)??0))return;
    warned.set(chat,rank);
    if(warned.size>24)warned.delete(warned.keys().next().value);
    dismiss();
    const notice=document.createElement("div");
    notice.id="lp-helium-rollover-hint";
    notice.setAttribute("role","status");
    const line=document.createElement("span");
    line.textContent=stage==="STOP"?"4M · pindah chat":
      stage==="PREPARE"?"3,6M · siapkan chat baru":"3,2M · checkpoint";
    const close=document.createElement("button");
    close.type="button";close.textContent="×";
    close.setAttribute("aria-label","Tutup notifikasi");
    close.addEventListener("click",dismiss);
    notice.append(line,close);document.body?.append(notice);
    toast=notice;
    setTimeout(()=>{if(toast===notice)dismiss();},7000);
  }
  function schedule(fast=false){
    if(timer!==null)return;
    timer=setTimeout(scan,fast?240:Math.max(0,1100-(Date.now()-lastScan)));
  }
  function scan(){
    timer=null;lastScan=Date.now();
    const chat=C.safeChatId(location.href);
    if(chat!==active){
      M.reset(document);dismiss();active=chat;pending=null;since=0;
    }
    if(!chat)return;
    // Automatic where CSS is supported; existing owner fails closed if
    // more than 3000 turns are mounted or the page structure is unsafe.
    const compact=M.apply(document,{enabled:true,
      activeElement:document.activeElement,
      selection:globalThis.getSelection?.()??null});
    const loaded=Number.isSafeInteger(compact.loaded)?compact.loaded:0;
    U.decorate(document,loaded);
    if(compact.pending>0)schedule(true);
    const reading=U.observe(document);
    if(!reading)return; // Never invent tokens if Usage Meter is absent.
    const signature=chat+":"+reading.tokens;
    if(signature!==pending){
      pending=signature;since=Date.now();schedule();return;
    }
    if(Date.now()-since>=650)notify(chat,U.stage(reading.tokens));
  }
  const observer=new MutationObserver(()=>schedule());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  globalThis.addEventListener("popstate",()=>schedule());
  globalThis.addEventListener("hashchange",()=>schedule());
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState!=="hidden")schedule();
  });
  schedule();
})();

