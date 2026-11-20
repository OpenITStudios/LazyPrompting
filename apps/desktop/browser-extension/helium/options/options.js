/* Local only; never accesses a ChatGPT session. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const flags=[["show-strip","lp-helium-strip-visible",true],
 ["compact-default","lp-helium-compact-default",true],
 ["collapsed-default","lp-helium-collapse-default",false]];
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
async function setup(){
 try{
  const record=await chrome.storage.local.get(flags.map(x=>x[1]));
  for(const [element,key,fallback] of flags){
   const control=$(element);
   control.checked=typeof record[key]==="boolean"?record[key]:fallback;
   control.addEventListener("change",()=>{
    chrome.storage.local.set({[key]:control.checked}).then(()=>{
     $("feedback").textContent="Setting saved locally.";
    }).catch(()=>{
     control.checked=!control.checked;$("feedback").textContent="Save failed.";
    });
   });
  }
 }catch{$("feedback").textContent="Local settings unavailable.";}
 $("reveal").addEventListener("click",()=>{
  chrome.storage.local.set({"lp-helium-strip-visible":true}).then(()=>{
   $("show-strip").checked=true;$("feedback").textContent="Strip enabled.";
  }).catch(()=>{$("feedback").textContent="Could not enable strip.";});
 });
 $("clear").addEventListener("click",async()=>{
  try{
   const {["lp-helium-last-chat"]:id}=await chrome.storage.local.get("lp-helium-last-chat");
   if(!validId(id)){$("feedback").textContent="No previous chat available.";return;}
   await chrome.storage.local.remove("lp-helium-reported-tokens:"+id);
   $("feedback").textContent="The last chat's estimate was cleared.";
  }catch{$("feedback").textContent="Could not clear the estimate.";}
 });
}
document.addEventListener("DOMContentLoaded",()=>{void setup();});
})();
