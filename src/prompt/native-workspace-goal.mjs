import {join,isAbsolute} from "node:path";
import {CheckpointStore} from "../supervisor/checkpoint-store.mjs";
import {PromptOutbox} from "./prompt-outbox.mjs";
import {createGoalContract,verifyGoalContract,matchesNativeGoalApproval} from "../supervisor/goal-contract.mjs";

// Private, native-bootstrapped gateway service: NOT a public MCP capability.
// The existing CheckpointStore and PromptOutbox remain the only disk owners.
// No ChatGPT transport, source attestation, worker dispatch or new scheduler.
const WS=/^workspace-(0[1-9]|10)$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const exact=(value,keys)=>value!==null&&typeof value==="object"&&
 !Array.isArray(value)&&Object.keys(value).sort().join(",")===
 [...keys].sort().join(",");
const block=reason=>({source:"NATIVE_WORKSPACE_GOAL",status:"BLOCKED",
 reason,nextPromptAllowed:false,qa:"NOT_EXECUTED"});

function store(dataDir,workspaceId){
 if(!isAbsolute(dataDir)||dataDir.length>4096||!WS.test(workspaceId??""))
  throw Error("GOAL_STORAGE_SCOPE_INVALID");
 return new CheckpointStore(join(dataDir,"goal-contracts",workspaceId,"checkpoint.json"));
}
function project(workspaceId,checkpoint){
 if(checkpoint===null)return {source:"NATIVE_WORKSPACE_GOAL",schemaVersion:1,
  workspaceId,goalId:null,goalRevision:null,phase:"UNINITIALIZED",chatState:null,
  pendingTask:false,requiresReconciliation:false,operatorApproved:false,
  sourceVerified:false,chatTurnVerified:false,qa:"NOT_EXECUTED",
  nextPromptAllowed:false};
 const goal=checkpoint.goalContract;
 if(!verifyGoalContract(goal)||goal.workspaceId!==workspaceId||
    checkpoint.goalId!==goal.goalId||checkpoint.goalHash!==goal.goalHash||
    !Number.isSafeInteger(checkpoint.version)||checkpoint.version<0||
    !["PAUSED","STOPPED","DONE","READY","DISPATCH_PENDING","WAITING",
      "RECONCILE_REQUIRED"].includes(checkpoint.phase)||
    !["UNBOUND","BOUND_VERIFIED"].includes(checkpoint.chatState))
  throw Error("GOAL_CHECKPOINT_SCOPE_INVALID");
 return {source:"NATIVE_WORKSPACE_GOAL",schemaVersion:1,
  workspaceId,goalId:goal.goalId,goalRevision:goal.revision,
  phase:checkpoint.phase,chatState:checkpoint.chatState,
  pendingTask:typeof checkpoint.pendingTaskId==="string"&&checkpoint.pendingTaskId.length>0,
  requiresReconciliation:["DISPATCH_PENDING","WAITING","RECONCILE_REQUIRED"].includes(checkpoint.phase),
  operatorApproved:true,sourceVerified:false,chatTurnVerified:false,
  qa:"NOT_EXECUTED",nextPromptAllowed:false};
}
export async function handleNativeWorkspaceGoal({action,dataDir,payload}={}){
 if(!["preview","commit","status"].includes(action)||!isAbsolute(dataDir??"")||
    dataDir.length>4096||!payload||typeof payload!=="object"||
    Array.isArray(payload))
  throw Error("GOAL_HOST_REQUEST_INVALID");
 if(action==="status"){
  if(!exact(payload,["workspaceId"])||!WS.test(payload.workspaceId??""))
   throw Error("GOAL_STATUS_SCOPE_INVALID");
  return project(payload.workspaceId,await store(dataDir,payload.workspaceId).read());
 }
 if(action==="preview"){
  if(!exact(payload,["goalId","request"])||!ID.test(payload.goalId??"")||
     !exact(payload.request,["workspaceId","repository","branch","baseSha",
      "objective","acceptance","constraints","nonGoals","preserve",
      "allowedActions","limits"]))
   throw Error("GOAL_PREVIEW_INPUT_INVALID");
  // A preview cannot overwrite an existing goal or bind an existing chat.
  const request=payload.request,checkpoint=store(dataDir,request.workspaceId);
  if(await checkpoint.read()!==null)return block("GOAL_ALREADY_EXISTS");
  const pending=await new PromptOutbox(join(dataDir,"outbox.json"))
    .unresolvedWorkspaceEffects({workspaceId:request.workspaceId});
  if(pending.unresolved!==false)return block("GOAL_OUTBOX_NOT_QUIESCENT");
  const contract=createGoalContract({schemaVersion:1,goalId:payload.goalId,
   revision:1,...request});
  return {source:"NATIVE_WORKSPACE_GOAL_PREVIEW",contract,
   nextPromptAllowed:false,qa:"NOT_EXECUTED"};
 }
 if(!exact(payload,["contract","approval"])||
    !verifyGoalContract(payload.contract)||
    !matchesNativeGoalApproval(payload.contract,payload.approval,"APPROVE_GOAL"))
  throw Error("NATIVE_GOAL_APPROVAL_REQUIRED");
 const contract=payload.contract;
 const checkpoint=store(dataDir,contract.workspaceId);
 // Reconcile an interrupted prior commit by STATUS, never automatic replay.
 const result=await checkpoint.initializeApprovedGoal({
  contract,outbox:new PromptOutbox(join(dataDir,"outbox.json")),
  authorize:async request=>({...request,
   trusted:payload.approval.trusted,source:payload.approval.source,
   operatorApproved:payload.approval.operatorApproved})
 });
 if(result.ok!==true)return block(result.reason);
 return project(contract.workspaceId,await checkpoint.read());
}
