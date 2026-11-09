// In-process lease only. A distributed/persistent writer lock is still required.
export class RepositoryWriteLease {
 constructor(){this.leases=new Map();}
 acquire({workspaceId,repository,branch,headSha}={}){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId??"")||
     repository!=="OpenITStudios/LazyPrompting"||branch!=="Local"||
     !/^[a-f0-9]{40}$/.test(headSha??""))
   return {acquired:false,reason:"INVALID_SCOPE"};
  const key=repository+"@"+branch;
  if(this.leases.has(key))return {acquired:false,reason:"WRITE_LEASE_HELD"};
  const token=crypto.randomUUID();
  this.leases.set(key,{workspaceId,headSha,token});
  return {acquired:true,token};
 }
 release({repository,branch,workspaceId,token}={}){
  const key=repository+"@"+branch,held=this.leases.get(key);
  if(!held||held.workspaceId!==workspaceId||held.token!==token)return false;
  this.leases.delete(key);return true;
 }
}
