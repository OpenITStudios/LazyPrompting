import {publishStateFile} from "./publish-state-file.mjs";
import {mkdir,open,readFile,rm} from "node:fs/promises";
import {dirname,isAbsolute,resolve} from "node:path";
import {randomUUID} from "node:crypto";

const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
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
 Number.isSafeInteger(w.contextRevision)&&w.contextRevision>=0;
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
   if(current.workspaces.some(w=>w.workspaceId===workspace.workspaceId||w.sessionId===workspace.sessionId))
    throw new Error("WORKSPACE_IDENTITY_CONFLICT");
   current.workspaces.push(structuredClone(workspace));current.version++;return current;
  });
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
