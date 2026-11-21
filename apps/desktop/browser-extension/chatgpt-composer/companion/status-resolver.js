/* One pure status decision for both Helium and WebView2.
 * No DOM, ChatGPT transport, timers, extra UI or message contents.
 */
(() => {
  "use strict";
  if(globalThis.__lpCompanionStatusResolver)return;
  const NONE=Object.freeze({id:"none",label:"",level:"",title:"",retry:false});
  const status=(id,label,level,title,retry=false)=>({id,label,level,title,retry});
  function resolve({
    meterLimit=false,responseError=false,notice=null,retryAvailable=false,
    tokens=null,soon=null,switchAt=null,
    newChatUnavailable=false,cleanupStatus=null
  }={}){
    // Explicit source order: confirmed limit > response error >
    // possible limit > context thresholds > normal.
    if(meterLimit===true)
      return status("limit","Limit hit","limit",
        "Limit hit reported by the separate Usage Meter; confirm in ChatGPT.");
    if(responseError===true||notice==="RESPONSE_ERROR_POSSIBLE")
      return status("error","Error","error",
        "ChatGPT response error. Retry uses the original Regenerate control.",
        retryAvailable===true);
    if(notice==="USAGE_CAP_POSSIBLE")
      return status("possible-usage","Possible usage limit","advisory",
        "Unverified usage-limit notice. Check the ChatGPT page.");
    if(notice==="CHAT_LENGTH_POSSIBLE")
      return status("possible-chat","Possible chat limit","advisory",
        "Unverified chat-length notice. Check the ChatGPT page.");
    // Action failure uses this same slot; never overwrite its DOM directly.
    if(newChatUnavailable===true)
      return status("newchat-error","New Chat unavailable","advisory",
        "New Chat could not start. The current chat remains unchanged.");
    if(Number.isSafeInteger(tokens)&&tokens>=0){
      if(Number.isSafeInteger(switchAt)&&switchAt>0&&tokens>=switchAt)
        return status("switch","Switch chat","switch",
          "Planning warning from estimated tokens, not an official hard limit.");
      if(Number.isSafeInteger(soon)&&soon>0&&tokens>=soon)
        return status("soon","New chat soon","soon",
          "Planning warning from estimated tokens, not an official hard limit.");
    }
    if(["OLD_CHAT_DELETE_UNVERIFIED","OLD_CHAT_RESULT_UNAVAILABLE"].includes(cleanupStatus))
      return status("cleanup-unknown","Delete unverified","advisory",
        "Previous-chat deletion could not be verified.");
    if(cleanupStatus==="OLD_CHAT_RETAINED")
      return status("cleanup-retained","Old chat retained","advisory",
        "The old chat was retained.");
    return NONE;
  }
  globalThis.__lpCompanionStatusResolver=Object.freeze({resolve});
})();

