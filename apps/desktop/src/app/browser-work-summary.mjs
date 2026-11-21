// Presentation only: one coherent Chat A → Chat B → cleanup status.
// Neither a browser hint nor this projection authorizes sending or deletion.
const view=(kind,step,title,detail)=>({kind,step,title,detail});

export function projectBrowserWorkSummary({
 hasDraft=false,sendStatus=null,pluginStatus=null,responseHint=null,chatState=null,
 cleanupState="NONE",rolloverPrepared=false,hasSavedChat=false,oldChatReviewed=false
}={}){
 if(sendStatus==="AMBIGUOUS_HOLD")
  return view("hold","Reconcile","Recovery required",
   "Several send attempts remain unresolved. Do not switch or delete chats before reviewing the original conversation.");
 if(sendStatus==="UNKNOWN")
  return view("hold","Reconcile","Send status unavailable",
   "Native send state is unconfirmed. Inspect the outbox before continuing.");
 if(sendStatus==="REVIEW_REQUIRED")
  return view("review","Reconcile","Review original conversation",
   "A native send attempt still needs operator review; delivery and completion are unverified.");
 if(pluginStatus==="RECONCILE_REQUIRED")
  return view("hold","Reconcile","Plugin recovery required",
   "The native plugin intent has an uncertain outcome. Do not retry, resend or clear it automatically.");
 if(pluginStatus==="UNAVAILABLE")
  return view("hold","Reconcile","Plugin status unavailable",
   "Native plugin pending effects could not be checked. Do not retry or dispatch new work from this status.");
 if(pluginStatus!==null&&pluginStatus!=="NO_PENDING")
  return view("review","Review","Plugin binding needs review",
   "The native plugin intent is not verified for this chat. Check binding and scope before continuing.");
 if(hasSavedChat&&chatState==="UNBOUND")
  return view("hold","Bind","Current chat differs from saved link",
   "Return to the saved ordinary ChatGPT conversation or review the bookmark before sending or cleaning up.");
 if(cleanupState==="PENDING_REVIEW"){
  if(hasDraft)
   return view("hold","Reconcile","Resolve manual handoff draft",
    "A staged draft requires review or dismissal before old-chat deletion. The native host also checks this hold.");
  if(sendStatus!=="NO_PENDING")
   return view("hold","Reconcile","Check pending workspace effects",
    "Native send status is not confirmed clear. Refresh the status before cleanup.");
  if(oldChatReviewed)
   return view("review","Cleanup","Delete old chat manually",
    "The old URL was reviewed. Use ChatGPT's own Delete flow, then record the result locally. This is not server verification.");
  return view("review","Cleanup","Previous chat ready for review",
   "The old URL is preserved. Confirm Chat B, GitHub continuity and outstanding work before opening Chat A.");
 }
 if(chatState==="FULL_CONFIRMED")
  return view("hold","Recover","Chat full — prepare New Chat",
   "The native send guard blocks this saved conversation. Prepare a Codex checkpoint and a new persistent chat.");
 if(chatState==="ESTIMATE_CAP_HOLD")
  return view("hold","Recover","4M planning guard — New Chat required",
   "The reported estimate reached 4M. Native Send once is held. Complete a checkpoint and bind Chat B; official ChatGPT limits are unknown.");
 if(rolloverPrepared===true)
  return view("review","Recover","New Chat preparation active",
   "Native Send once is held on the saved Chat A. Complete the Codex checkpoint and bind Chat B.");
 if(chatState==="ROLLOVER_DUE")
  return view("review","Prepare","Prepare New Chat before 4M",
   "Operator-reported estimate is at least 3.6M. Reconcile the checkpoint and switch chats before the 4M planning stop.");
 if(chatState==="LONG_CHAT_ADVISORY")
  return view("review","Prepare","3.2M checkpoint advisory",
   "The estimate is operator-reported. Review continuity and plan a new chat; this is not an official token limit.");
 if(hasDraft)
  return view("review","Review","Draft ready for review",
   "Inspect the proposed prompt below. Only a user action can send it, and the reply is not verified.");
 if(responseHint==="ERROR")
  return view("hold","Reconcile","Page status indicates an error",
   "A possible page error was observed. Inspect the original conversation.");
 if(responseHint==="WAITING"||responseHint==="GENERATING")
  return view("active","Observe","ChatGPT may be responding",
   "UI controls only; no final answer or QA has been verified.");
 if(responseHint==="POSSIBLY_COMPLETED")
  return view("review","Review","Review ChatGPT response",
   "Generation controls changed, but the reply has not been verified.");
 if(!hasSavedChat||chatState==="UNBOUND")
  return view("idle","Bind","Save the active chat link",
   "Bind the exact ordinary ChatGPT conversation before reviewed native sending or rollover.");
 return view("idle","Monitor","Chat bound",
  "Monitor locally; the remaining official thread capacity is unknown. Autonomous continuation is not connected.");
}

// Existing native statuses are displayed together without granting an action.
// Codex V1 runs are app-wide; there is NO verified relationship to the
// selected ChatGPT workspace, plugin goal, or extension conversation.
const PLUGIN_SIGNALS=new Set([
 "NOT_CHECKED","NO_PENDING","AWAITING_VERIFIED_BINDING",
 "BIND_WINDOW_EXPIRED_HOLD","LEGACY_UNTIMED_HOLD",
 "CLOCK_UNCERTAIN_HOLD","IDENTITY_LINKED_CHAT_UNVERIFIED",
 "RECONCILE_REQUIRED","UNAVAILABLE"
]);
const CODEX_SIGNALS=new Set(["NOT_CHECKED","LOADING","AVAILABLE","UNAVAILABLE"]);
const COMPANION_SIGNALS=new Set([
 "NOT_CHECKED","UNAVAILABLE","none","limit","error",
 "possible-usage","possible-chat","newchat-error",
 "switch","soon","cleanup-unknown","cleanup-retained"
]);
const COMPANION_LABELS=Object.freeze({
 "none":"no active warning",limit:"limit hint",error:"error hint",
 "possible-usage":"possible usage limit","possible-chat":"possible chat limit",
 "newchat-error":"New Chat unavailable",switch:"switch chat (estimate)",
 soon:"new chat soon (estimate)","cleanup-unknown":"old-chat deletion unverified",
 "cleanup-retained":"old chat retained"
});
export function projectIntegratedWorkSignals({
 pluginStatus="NOT_CHECKED",codexStatus="NOT_CHECKED",
 codexRuns=[],codexTruncated=false,companionSignal="NOT_CHECKED"
}={}){
 const neutral=(label,visible=true)=>Object.freeze({
  source:"NATIVE_STATUS_PROJECTION_ONLY",label,visible,
  chatBound:false,nextPromptAllowed:false,deliveryVerified:false,
  resultVerified:false,qa:"NOT_VERIFIED"
 });
 if(!PLUGIN_SIGNALS.has(pluginStatus)||!CODEX_SIGNALS.has(codexStatus)||
    !COMPANION_SIGNALS.has(companionSignal)||
    !Array.isArray(codexRuns)||codexRuns.length>10||
    typeof codexTruncated!=="boolean")
  return neutral("Native status unavailable; review before continuing.");
 if(pluginStatus==="NOT_CHECKED"&&codexStatus==="NOT_CHECKED"&&
    companionSignal==="NOT_CHECKED")
  return neutral("",false);
 const plugin=pluginStatus==="NO_PENDING"?"Plugin: no pending intent recorded":
   pluginStatus==="NOT_CHECKED"?"Plugin: not checked":
   pluginStatus==="UNAVAILABLE"?"Plugin: status unavailable":
   "Plugin: review required";
 let codex="Codex V1: not checked";
 if(codexStatus==="LOADING")codex="Codex V1: checking";
 else if(codexStatus==="UNAVAILABLE")codex="Codex V1: status unavailable";
 else if(codexStatus==="AVAILABLE"){
  // The existing native receipt parser already validates each run.
  // A count is informational; it never certifies QA, completion or
  // association with a particular ChatGPT conversation.
  const count=codexRuns.length;
  codex="Codex V1: "+count+(codexTruncated?"+":"")+
    " app-wide run"+(count===1?"":"s")+" (not chat-linked)";
 }
 const companion=companionSignal==="NOT_CHECKED"?"":
   companionSignal==="UNAVAILABLE"?"Companion: unavailable / unbound":
   "Companion: "+COMPANION_LABELS[companionSignal]+" (UI only)";
 return neutral([plugin,codex,companion].filter(Boolean).join(" · "));
}
