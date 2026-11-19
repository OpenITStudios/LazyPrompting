// Context Capsules contain only explicit, bounded, workspace-owned facts.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
export function admitContext({binding,capsule,callerSessionId}={}){
 if(!binding||!capsule||!ID.test(callerSessionId??"")||
    binding.sessionId!==callerSessionId||capsule.workspaceId!==binding.workspaceId||
    capsule.sessionId!==binding.sessionId||capsule.repository!==binding.repository||
    capsule.branch!==binding.branch||capsule.headSha!==binding.headSha||
    !SHA.test(capsule.headSha??"")||capsule.contextRevision!==binding.contextRevision||
    !Number.isSafeInteger(capsule.contextRevision)||capsule.contextRevision<0||
    binding.status!=="READY")return {admitted:false,reason:"CONTEXT_SCOPE_MISMATCH"};
 // Legacy contexts remain compatible, but once a goal binding exists,
 // every capsule must carry the exact host-bound goal identity and revision.
 const scoped=["goalId","goalHash","goalRevision"].some(k=>
  Object.hasOwn(binding,k)||Object.hasOwn(capsule,k));
 if(scoped&&(!ID.test(binding.goalId??"")||
    !/^[a-f0-9]{64}$/.test(binding.goalHash??"")||
    !Number.isSafeInteger(binding.goalRevision)||binding.goalRevision<1||
    capsule.goalId!==binding.goalId||
    capsule.goalHash!==binding.goalHash||
    capsule.goalRevision!==binding.goalRevision))
  return {admitted:false,reason:"GOAL_CONTEXT_SCOPE_MISMATCH"};
 const fields=["goal","decisions","constraints","progress","evidence","checkpoint","nextAction"];
 if(fields.some(k=>!Object.hasOwn(capsule,k)))return {admitted:false,reason:"INCOMPLETE_CAPSULE"};
 const bytes=Buffer.byteLength(JSON.stringify(capsule),"utf8");
 if(bytes>65536)return {admitted:false,reason:"CONTEXT_BUDGET_EXCEEDED"};
 return {admitted:true,workspaceId:binding.workspaceId,contextRevision:binding.contextRevision,capsule:structuredClone(capsule)};
}
