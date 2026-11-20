/* Original popup, browser-local operator estimates only. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const flags=[["show-strip","lp-helium-strip-visible",true],
 ["compact-default","lp-helium-compact-default",true],
 ["collapsed-default","lp-helium-collapse-default",false]];
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
async function setup(){
 try{
  const snapshot=await chrome.storage.local.get([...flags.map(x=>x[1]),"lp-helium-last-chat"]);
  for(const [element,key,fallback] of flags){
   const input=$(element);
   input.checked=typeof snapshot[key]==="boolean"?snapshot[key]:fallback;
   input.addEventListener("change",()=>{
    chrome.storage.local.set({[key]:input.checked}).catch(()=>{
     input.checked=!input.checked;$("feedback").textContent="Setting not saved.";
    });
   });
  }
  const id=snapshot["lp-helium-last-chat"];
  if(validId(id)){
   $("chat-id").textContent="…"+id.slice(-6);
   const record=await chrome.storage.local.get("lp-helium-reported-tokens:"+id);
   const n=record["lp-helium-reported-tokens:"+id];
   if(Number.isSafeInteger(n)&&n>0&&n<=100_000_000){
    $("tokens").textContent="~"+new Intl.NumberFormat("en-US").format(n);
    $("stage").textContent=(n>=4_000_000?"Move chat now":
     n>=3_600_000?"Prepare a new chat":
     n>=3_200_000?"Review your checkpoint":"Below 3.2M checkpoint")+
     " · operator-reported tokens";
    $("progress").style.width=Math.min(100,n/4_000_000*100)+"%";
   }
  }
 }catch{$("feedback").textContent="Local data unavailable.";}
 $("settings").addEventListener("click",()=>chrome.runtime.openOptionsPage());
 $("advanced").addEventListener("click",()=>chrome.runtime.openOptionsPage());
}
document.addEventListener("DOMContentLoaded",()=>{void setup();});
})();
