// UI input preflight only. Rust chat_manual_handoff.rs alone builds the
// outgoing manual draft; a second JS prompt formatter could disagree.
// The supplied reply remains unverified and never becomes a send receipt.
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const encoder=new TextEncoder();
const valid=(s,max)=>typeof s==="string"&&s.trim().length>0&&s.length<=max&&
 !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s);
const bytes=s=>encoder.encode(s).length;

export function prepareOperatorContinuation({workspaceId,priorDraft,reply,nextAction}={}){
 if(!WORKSPACE.test(workspaceId??"")||!valid(priorDraft,12000)||
    bytes(priorDraft)>12000||!valid(reply,16000)||bytes(reply)>16000||
    (nextAction!==undefined&&nextAction!==""&&
     (!valid(nextAction,800)||bytes(nextAction)>800)))
  return {ready:false,reason:"INVALID_OPERATOR_CONTINUATION_INPUT"};
 // Native formats a short 1,200-byte excerpt only when no reviewed step
 // exists. With a specific next step it relies on the SAME saved chat
 // rather than retransmitting the prior prompt and full pasted reply.
 return {ready:true,status:"INPUT_VALIDATED",workspaceId,
  source:"DESKTOP_INPUT_PREFLIGHT",responseVerified:false,
  deliveryVerified:false,nextPromptAllowed:false,
  excerpted:!nextAction&&bytes(reply)>1200};
}
