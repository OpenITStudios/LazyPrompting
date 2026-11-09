import {mkdir,open,readFile,rm,rmdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
// Single-host exclusive lease; stale locks intentionally block until operator reconciliation.
export class DurableWriteLease {
 constructor(root,{readHead}={}){
  if(typeof root!=="string"||!root.trim()||typeof readHead!=="function")
   throw new Error("LEASE_HOST_REQUIRED");
  this.root=resolve(root);this.readHead=readHead;
 }
 async acquire({workspaceId,repository,branch,expectedHead}={}){
  if(!ID.test(workspaceId??"")||repository!=="OpenITStudios/LazyPrompting"||
     branch!=="Local"||!SHA.test(expectedHead??""))return {acquired:false,reason:"INVALID_SCOPE"};
  await mkdir(this.root,{recursive:true,mode:0o700});
  const path=join(this.root,"lazyprompting-local.writer");
  try{await mkdir(path,{mode:0o700});}
  catch(e){if(e.code==="EEXIST")return {acquired:false,reason:"LEASE_HELD_OR_STALE"};throw e;}
  const token=randomUUID();
  try{
   const fd=await open(join(path,"owner.json"),"wx",0o600);
   try{await fd.writeFile(JSON.stringify({workspaceId,repository,branch,expectedHead,token})+"\n");await fd.sync();}
   finally{await fd.close();}
   const current=await this.readHead(repository,branch);
   if(current!==expectedHead){await rm(path,{recursive:true,force:true});return {acquired:false,reason:"STALE_HEAD"};}
   return {acquired:true,token,expectedHead};
  }catch(e){
   // Do not delete a potentially committed lease on ambiguous IO failure.
   return {acquired:false,reason:"LEASE_STATE_UNKNOWN",detail:String(e.code??"IO_ERROR")};
  }
 }
 async verify({workspaceId,token,expectedHead}={}){
  if(!ID.test(workspaceId??"")||!SHA.test(expectedHead??"")||typeof token!=="string")return false;
  try{
   const owner=JSON.parse(await readFile(join(this.root,"lazyprompting-local.writer","owner.json"),"utf8"));
   if(owner.workspaceId!==workspaceId||owner.token!==token||owner.expectedHead!==expectedHead)return false;
   return await this.readHead(owner.repository,owner.branch)===expectedHead;
  }catch{return false;}
 }
 async release({workspaceId,token}={}){
  const path=join(this.root,"lazyprompting-local.writer");
  try{
   const owner=JSON.parse(await readFile(join(path,"owner.json"),"utf8"));
   if(owner.workspaceId!==workspaceId||owner.token!==token)return false;
   await rm(join(path,"owner.json"));
   await rmdir(path);
   return true;
  }catch{return false;}
 }
}
