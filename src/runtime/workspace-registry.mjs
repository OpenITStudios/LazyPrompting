import {publishStateFile} from "./publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,isAbsolute,resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {verifyGoalContract,matchesNativeGoalApproval} from "../supervisor/goal-contract.mjs";

const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const goalBindingValid=w=>{
 const has=["goalId","goalHash","goalRevision"].some(k=>Object.hasOwn(w,k));
 return !has||(ID.test(w.goalId??"")&&DIGEST.test(w.goalHash??"")&&
  Number.isSafeInteger(w.goalRevision)&&w.goalRevision>=1&&
  w.goalRevision<=10000);
};
function validContinuation(workspace) {
 const step=workspace.continuation;
 return step==null||(step.taskId!==step.nextTaskId&&
  workspace.taskIds.includes(step.taskId)&&workspace.taskIds.includes(step.nextTaskId)&&
  typeof step.followUp==="string"&&step.followUp.trim().length>0&&step.followUp.length<=600&&
  typeof step.expectedResponse==="string"&&step.expectedResponse.trim().length>0&&step.expectedResponse.length<=300);
}
function valid(w){
 return w&&ID.test(w.workspaceId??"")&&ID.test(w.sessionId??"")&&
 Array.isArray(w.taskIds)&&w.taskIds.length<=100&&w.taskIds.every(x=>ID.test(x))&&
 ["READY","PAUSED","BLOCKED","STOPPED"].includes(w.status)&&
 (w.kind==="localCodex"
  ?typeof w.cwd==="string"&&isAbsolute(w.cwd)&&w.repository===undefined&&w.branch===undefined&&w.headSha===undefined&&validContinuation(w)
  :REPO.test(w.repository??"")&&BRANCH.test(w.branch??"")&&
   !w.branch.includes("..")&&!w.branch.startsWith("/")&&!w.branch.endsWith("/")&&SHA.test(w.headSha??""))&&
 Number.isSafeInteger(w.contextRevision)&&w.contextRevision>=0&&goalBindingValid(w);
}
export class WorkspaceRegistry {
 constructor(path){
  if(typeof path!=="string"||!path.trim())throw new Error("REGISTRY_PATH_REQUIRED");
  this.path=resolve(path);this.lock=this.path+".lock";
 }
 async read(){
  try{
   const data=JSON.parse(await readFile(this.path,"utf8"));
   if(data?.schemaVersion!==1||!Number.isSafeInteger(data.version)||data.version<0||
      !Array.isArray(data.workspaces)||data.workspaces.length>10||
      data.workspaces.some(w=>!valid(w))||
      new Set(data.workspaces.map(w=>w.workspaceId)).size!==data.workspaces.length||
      new Set(data.workspaces.map(w=>w.sessionId)).size!==data.workspaces.length||
      new Set(data.workspaces.filter(w=>w.repository!==undefined)
       .map(w=>w.repository.toLowerCase())).size!==
       data.workspaces.filter(w=>w.repository!==undefined).length||
      new Set(data.workspaces.flatMap(w=>w.taskIds)).size!==data.workspaces.reduce((n,w)=>n+w.taskIds.length,0))
     throw new Error("CORRUPT_WORKSPACE_REGISTRY");
   return data;
  }catch(e){if(e?.code==="ENOENT")return {schemaVersion:1,version:0,workspaces:[]};throw e;}
 }
 async mutate(expectedVersion,change){
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||typeof change!=="function")throw new Error("INVALID_MUTATION");
  await mkdir(dirname(this.path),{recursive:true});
  await mkdir(this.lock);
  try{
   const current=await this.read();
   if(current.version!==expectedVersion)return {ok:false,reason:"STALE_REGISTRY_VERSION"};
   const next=change(structuredClone(current));
   if(!next||next.schemaVersion!==1||next.version!==current.version+1||
      !Array.isArray(next.workspaces)||next.workspaces.length>10||
      next.workspaces.some(w=>!valid(w))||
      new Set(next.workspaces.map(w=>w.workspaceId)).size!==next.workspaces.length||
      new Set(next.workspaces.map(w=>w.sessionId)).size!==next.workspaces.length||
      new Set(next.workspaces.filter(w=>w.repository!==undefined)
       .map(w=>w.repository.toLowerCase())).size!==
       next.workspaces.filter(w=>w.repository!==undefined).length||
      new Set(next.workspaces.flatMap(w=>w.taskIds)).size!==next.workspaces.reduce((n,w)=>n+w.taskIds.length,0))
     throw new Error("INVALID_REGISTRY_TRANSITION");
   const tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);
    await fd.writeFile(JSON.stringify(next)+"\n");
    await fd.sync();await fd.close();fd=null;
    await publishStateFile(tmp,this.path);
   }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
   return {ok:true,version:next.version};
  }finally{await rm(this.lock,{recursive:true,force:true});}
 }
 async register(expectedVersion,workspace){
  if(!valid(workspace))throw new Error("INVALID_WORKSPACE");
  return this.mutate(expectedVersion,current=>{
   if(current.workspaces.some(w=>w.workspaceId===workspace.workspaceId||
       w.sessionId===workspace.sessionId||
       (w.repository!==undefined&&workspace.repository!==undefined&&
        w.repository.toLowerCase()===workspace.repository.toLowerCase())))
    throw new Error("WORKSPACE_IDENTITY_CONFLICT");
   current.workspaces.push(structuredClone(workspace));current.version++;return current;
  });
 }
 // Native-host integration point for registering one public GitHub source
 // with its existing canonical workspace record, not a second UI-side store.
 // Authenticated provider admission and branch HEAD are external requirements.
 async registerVerifiedPublicSource({expectedVersion,workspaceId,sessionId,
   repository,branch,readHead,authorize}={}){
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||
     !ID.test(workspaceId??"")||!ID.test(sessionId??"")||
     !REPO.test(repository??"")||!BRANCH.test(branch??"")||
     branch.includes("..")||branch.includes("//")||
     branch.startsWith("/")||branch.endsWith("/")||
     typeof readHead!=="function"||typeof authorize!=="function")
   throw Error("INVALID_PUBLIC_SOURCE_BINDING");
  // A UI-supplied flag is never sufficient to authorize persistent binding.
  const approved=await authorize({workspaceId,sessionId,repository,branch,
    operation:"REGISTER_PUBLIC_SOURCE"});
  if(approved?.trusted!==true||approved?.source!=="NATIVE_HOST"||
     approved?.workspaceId!==workspaceId||
     approved?.sessionId!==sessionId||approved?.repository!==repository||
     approved?.branch!==branch||approved?.operation!=="REGISTER_PUBLIC_SOURCE")
   return {ok:false,reason:"NATIVE_SOURCE_BINDING_AUTH_REQUIRED"};
  const observed=await readHead({repository,branch});
  if(observed?.repository!==repository||observed?.branch!==branch||
     !SHA.test(observed?.headSha??"")||
     observed?.proof!=="SOURCE_HEAD_VERIFIED")
   return {ok:false,reason:"PUBLIC_SOURCE_HEAD_UNVERIFIED"};
  // Same registry CAS/lock as all other workspace writers.
  return this.mutate(expectedVersion,current=>{
   if(current.workspaces.some(w=>w.workspaceId===workspaceId||
       w.sessionId===sessionId||
       w.repository?.toLowerCase()===repository.toLowerCase()))
    throw Error("PUBLIC_SOURCE_WORKSPACE_CONFLICT");
   current.workspaces.push({workspaceId,sessionId,taskIds:[],
     status:"PAUSED",repository,branch,headSha:observed.headSha,
     contextRevision:0});
   current.version++;
   return current;
  });
 }
 // Host-injected bridge between the existing approved checkpoint and the
 // existing workspace registry. No second goal store or chat transport.
 // A partial cross-file update remains PAUSED until independently reconciled.
 async bindApprovedGoal({expectedVersion,workspaceId,sessionId,contextRevision,
   checkpointStore,outbox,authorize}={}){
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||
     !ID.test(workspaceId??"")||!ID.test(sessionId??"")||
     !Number.isSafeInteger(contextRevision)||contextRevision<0||
     typeof checkpointStore?.read!=="function"||
     typeof outbox?.unresolvedWorkspaceEffects!=="function"||
     typeof authorize!=="function")
   throw Error("INVALID_GOAL_SCOPE_BINDING");
  const snapshot=await this.read();
  const w=snapshot.workspaces.find(x=>x.workspaceId===workspaceId);
  if(snapshot.version!==expectedVersion||!w||w.sessionId!==sessionId||
     w.status!=="PAUSED"||w.contextRevision!==contextRevision)
   return {ok:false,reason:"STALE_OR_ACTIVE_GOAL_WORKSPACE"};
  const checkpoint=await checkpointStore.read();
  const goal=checkpoint?.goalContract;
  if(!verifyGoalContract(goal)||checkpoint.phase!=="PAUSED"||
     checkpoint.chatState!=="UNBOUND"||checkpoint.pendingTaskId||
     checkpoint.goalId!==goal.goalId||checkpoint.goalHash!==goal.goalHash||
     goal.workspaceId!==workspaceId||goal.repository!==w.repository||
     goal.branch!==w.branch||goal.baseSha!==w.headSha||
     checkpoint.headSha!==w.headSha)
   return {ok:false,reason:"APPROVED_GOAL_CHECKPOINT_MISMATCH"};
  const isFirst=w.goalId===undefined;
  if(isFirst?(w.taskIds.length!==0):
     (w.goalId!==goal.goalId||w.goalRevision+1!==goal.revision))
   return {ok:false,reason:"GOAL_REVISION_OR_TASK_CONFLICT"};
  const effects=await outbox.unresolvedWorkspaceEffects({workspaceId});
  if(effects?.workspaceId!==workspaceId||effects.unresolved!==false)
   return {ok:false,reason:"GOAL_HAS_UNRECONCILED_OUTBOX"};
  const approval=await authorize({
   operation:"BIND_GOAL_SCOPE",goalId:goal.goalId,
   workspaceId,sessionId,contextRevision,registryVersion:expectedVersion,
   goalHash:goal.goalHash,revision:goal.revision,
   repository:goal.repository,branch:goal.branch,baseSha:goal.baseSha
  });
  if(!matchesNativeGoalApproval(goal,approval,"BIND_GOAL_SCOPE")||
     approval.sessionId!==sessionId||
     approval.contextRevision!==contextRevision||
     approval.registryVersion!==expectedVersion)
   return {ok:false,reason:"NATIVE_GOAL_BINDING_APPROVAL_REQUIRED"};
  const updated=await this.mutate(expectedVersion,current=>{
   const target=current.workspaces.find(x=>x.workspaceId===workspaceId);
   if(!target||target.status!=="PAUSED"||
      target.sessionId!==sessionId||target.contextRevision!==contextRevision||
      target.repository!==goal.repository||target.branch!==goal.branch||
      target.headSha!==goal.baseSha||
      (isFirst?(target.goalId!==undefined||target.taskIds.length!==0):
       (target.goalId!==goal.goalId||
        target.goalRevision+1!==goal.revision)))
    throw Error("STALE_GOAL_BINDING");
   target.goalId=goal.goalId;target.goalHash=goal.goalHash;
   target.goalRevision=goal.revision;target.contextRevision++;
   current.version++;return current;
  });
  if(updated.ok!==true)return updated;
  const after=await checkpointStore.read();
  if(after?.goalHash!==goal.goalHash||
     after.goalContract?.revision!==goal.revision||
     after.phase!=="PAUSED"||after.chatState!=="UNBOUND")
   return {ok:false,reason:"GOAL_BINDING_RECONCILE_REQUIRED"};
  return {ok:true,workspaceId,goalId:goal.goalId,
   goalRevision:goal.revision,contextRevision:contextRevision+1,
   nextPromptAllowed:false};
 }
 // Read the existing durable binding without exposing other workspaces.
 // This is a source snapshot, never a ChatGPT session or execution grant.
 async readSourceBinding({workspaceId,sessionId}={}){
  if(!ID.test(workspaceId??"")||!ID.test(sessionId??""))
   return {status:"BLOCKED",reason:"INVALID_WORKSPACE_IDENTITY",
    nextPromptAllowed:false};
  const state=await this.read();
  const w=state.workspaces.find(item=>item.workspaceId===workspaceId);
  if(!w||w.sessionId!==sessionId)
   return {status:"BLOCKED",reason:"WORKSPACE_SESSION_BINDING_NOT_FOUND",
    nextPromptAllowed:false};
  if(w.kind==="localCodex"||typeof w.repository!=="string")
   return {status:"BLOCKED",reason:"NO_GITHUB_SOURCE_BINDING",
    nextPromptAllowed:false};
  return {status:"SOURCE_BOUND",workspaceId,sessionId,
   repository:w.repository,branch:w.branch,headSha:w.headSha,
   contextRevision:w.contextRevision,workspaceStatus:w.status,
   registryVersion:state.version,qa:"NOT_EXECUTED",acceptancePassed:false,
   ...(w.goalId?{goalId:w.goalId,goalHash:w.goalHash,
     goalRevision:w.goalRevision}:{}),
   nextPromptAllowed:false};
 }
 async switchSession({expectedVersion,workspaceId,oldSessionId,newSessionId,contextRevision}={}){
  if(!ID.test(workspaceId??"")||!ID.test(oldSessionId??"")||!ID.test(newSessionId??"")||
     oldSessionId===newSessionId||!Number.isSafeInteger(contextRevision)||contextRevision<0)
   throw new Error("INVALID_SESSION_SWITCH");
  return this.mutate(expectedVersion,current=>{
   const w=current.workspaces.find(x=>x.workspaceId===workspaceId);
   if(!w||w.sessionId!==oldSessionId||w.contextRevision!==contextRevision||
      w.status!=="PAUSED")throw new Error("STALE_HANDOFF_BINDING");
   if(current.workspaces.some(x=>x.sessionId===newSessionId))throw new Error("SESSION_ALREADY_BOUND");
   w.sessionId=newSessionId;w.contextRevision++;
   // Preserve the old chat as an immutable reference; do not delete it.
   w.previousSessions=[...(w.previousSessions??[]),oldSessionId];
   if(w.previousSessions.length>100)throw new Error("SESSION_HISTORY_CAPACITY");
   current.version++;return current;
  });
 }
 async setStatus(expectedVersion,workspaceId,status){
  if(!ID.test(workspaceId??"")||!["READY","PAUSED","BLOCKED","STOPPED"].includes(status))
   throw new Error("INVALID_STATUS_CHANGE");
  return this.mutate(expectedVersion,current=>{
   const w=current.workspaces.find(x=>x.workspaceId===workspaceId);
   if(!w)throw new Error("WORKSPACE_NOT_FOUND");
   if(w.status==="STOPPED"&&status==="READY")throw new Error("STOPPED_REQUIRES_NEW_AUTHORIZATION");
   w.status=status;current.version++;return current;
  });
 }
}
