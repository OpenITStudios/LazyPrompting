// Presentation only. This is never an authorization or ChatGPT receipt.
export function projectBrowserWorkSummary({hasDraft=false,sendStatus=null,responseHint=null}={}){
 if(sendStatus==="AMBIGUOUS_HOLD")
  return {kind:"hold",title:"Recovery required",detail:"Several send attempts remain unresolved. Do not retry before reviewing the original chat."};
 if(sendStatus==="UNKNOWN")
  return {kind:"hold",title:"Send status unavailable",detail:"Native send state is unconfirmed. Check diagnostics before another send."};
 if(sendStatus==="REVIEW_REQUIRED")
  return {kind:"review",title:"Review original conversation",detail:"A local send attempt needs operator review. ChatGPT delivery and completion are unverified."};
 if(hasDraft===true)
  return {kind:"review",title:"Draft ready for review",detail:"Inspect the proposed prompt below. Only a user action can send it; the reply is not verified."};
 if(responseHint==="ERROR")
  return {kind:"hold",title:"Page status indicates an error",detail:"A possible page error was observed. Inspect the original conversation."};
 if(responseHint==="WAITING"||responseHint==="GENERATING")
  return {kind:"active",title:"ChatGPT may be responding",detail:"UI controls only; no final answer or QA has been verified."};
 if(responseHint==="POSSIBLY_COMPLETED")
  return {kind:"review",title:"Review ChatGPT response",detail:"Generation controls changed, but the reply has not been verified."};
 return {kind:"idle",title:"No active draft shown",detail:"Use the browser normally. Autonomous ChatGPT continuation is not connected."};
}
