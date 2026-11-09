import {mkdir,open,readFile,rename,rm} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {randomUUID} from "node:crypto";

const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
function valid(w){
 return w&&ID.test(w.workspaceId??"")&&ID.test(w.sessionId??"")&&
 Array.isArray(w.taskIds)&&w.taskIds.length<=100&&w.taskIds.every(x=>ID.test(x))&&
 ["READY","PAUSED","BLOCKED","STOPPED"].includes(w.status)&&
 w.repository==="OpenITStudios/LazyPrompting"&&w.branch==="Local"&&SHA.test(w.headSha??"")&&
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
      new Set(data.workspaces.map(w=>w.sessionId)).size!==data.workspaces.length)
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
      new Set(next.workspaces.map(w=>w.sessionId)).size!==next.workspaces.length)
     throw new Error("INVALID_REGISTRY_TRANSITION");
   const tmp=this.path+"."+randomUUID()+".tmp";
   let fd;
   try{
    fd=await open(tmp,"wx",0o600);
    await fd.writeFile(JSON.stringify(next)+"\n");
    await fd.sync();await fd.close();fd=null;
    await rename(tmp,this.path);
    const dir=await open(dirname(this.path),"r");
    try{await dir.sync();}finally{await dir.close();}
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
