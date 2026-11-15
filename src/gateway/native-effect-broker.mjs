// Confined Code Mode's first native-effect adapter. The authenticated Rust
// host owns identity, the existing workspace lease, draft retention and UI.
// This module only validates typed inputs and projects a bounded receipt.
// There is no shell/worker/browser permission, grant store or retry loop.
const WS=/^workspace-(0[1-9]|10)$/;
const ALLOWED=new Set(["goal","acceptance","repository","branch","baseSha","nextStep"]);
const SHA=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const isRecord=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const validText=(text,max)=>typeof text==="string"&&text.trim().length>0&&
 Buffer.byteLength(text,"utf8")<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
const bad=()=>{throw Error("CODE_MODE_EFFECT_ARGUMENTS_INVALID");};

export function validateManualHandoffArguments(args){
 if(!isRecord(args)||Object.keys(args).some(key=>!ALLOWED.has(key)) ||
    !validText(args.goal,2000) || !Array.isArray(args.acceptance) ||
    args.acceptance.length<1 || args.acceptance.length>8 ||
    args.acceptance.some(item=>!validText(item,400)))bad();
 const repo=args.repository,branch=args.branch;
 if((repo===undefined)!==(branch===undefined) ||
    (repo!==undefined && (typeof repo!=="string" ||
      !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
      repo.split("/").some(part=>[".",".."].includes(part)) ||
      !validText(branch,128)||branch.includes("..")||branch.startsWith("/")||
      branch.endsWith("/")|| !/^[A-Za-z0-9_./-]+$/.test(branch))) ||
    (args.baseSha!==undefined && (repo===undefined ||
       typeof args.baseSha!=="string"||!SHA.test(args.baseSha))) ||
    (args.nextStep!==undefined&&!validText(args.nextStep,600)))bad();
 return structuredClone(args);
}
export function projectManualHandoffReceipt(value,workspaceId){
 if(!WS.test(workspaceId??"")||!isRecord(value) ||
    value.status!=="DRAFT_ONLY" ||
    value.source!=="HOST_FORMATTED_UNVERIFIED_CLIENT_INPUT" ||
    value.workspaceId!==workspaceId ||
    value.delivery!=="MANUAL_COPY_PASTE" || value.sent!==false ||
    value.sessionVerified!==false||value.resultVerified!==false ||
    value.operatorReviewRequired!==true ||
    value.nextPromptAllowed!==false||value.qa!=="NOT_EXECUTED"||
    typeof value.draftFingerprint!=="string"||
    !/^[a-f0-9]{64}$/.test(value.draftFingerprint) ||
    !validText(value.draftPrompt,12000))
   throw Error("CODE_MODE_EFFECT_RECEIPT_INVALID");
 // No raw draft, repository name, client-supplied goal text, or page data
 // crosses the Code Mode result boundary. Native UI inbox holds the draft.
 return {source:"NATIVE_MANUAL_DRAFT_RECEIPT",workspaceId,
   draftFingerprint:value.draftFingerprint,status:"DRAFT_ONLY",
   delivery:"MANUAL_COPY_PASTE",sent:false,
   operatorReviewRequired:true,qa:"NOT_EXECUTED",
   nextPromptAllowed:false};
}
export async function prepareManualHandoff(args,{workspaceId,invoke}={}){
 if(!WS.test(workspaceId??"") || typeof invoke!=="function")
   throw Error("CODE_MODE_EFFECT_UNAVAILABLE");
 const validated=validateManualHandoffArguments(args);
 let response;
 try {
   response=await invoke("workspace_chat.prepare_handoff",{
     workspaceId,...validated
   });
 }catch{throw Error("CODE_MODE_EFFECT_RECONCILE_REQUIRED");}
 if(response?.status!=="OK")
   throw Error("CODE_MODE_EFFECT_RECONCILE_REQUIRED");
 try{return projectManualHandoffReceipt(response.structuredContent,workspaceId);}
 catch{throw Error("CODE_MODE_EFFECT_RECONCILE_REQUIRED");}
}
