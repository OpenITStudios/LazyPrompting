// Presentation only: one coherent Chat A → Chat B → cleanup status.
// Neither a browser hint nor this projection authorizes sending or deletion.
const view=(kind,step,title,detail)=>({kind,step,title,detail});

export function projectBrowserWorkSummary({
 hasDraft=false,sendStatus=null,responseHint=null,chatState=null,
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
 if(rolloverPrepared===true && chatState!=="FULL_CONFIRMED")
  return view("review","Recover","New Chat preparation active",
   "Native Send once is held on the saved Chat A. Complete the Codex checkpoint and bind Chat B.");
 if(chatState==="FULL_CONFIRMED")
  return view("hold","Recover","Chat full — prepare New Chat",
   "The native send guard blocks this saved conversation. Prepare a Codex checkpoint and a new persistent chat.");
 if(chatState==="LONG_CHAT_ADVISORY")
  return view("review","Prepare","Long-chat advisory",
   "Estimate is operator-reported, not an official thread limit. Review continuity before the next milestone.");
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
