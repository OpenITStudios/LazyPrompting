// All writes must pass through a trusted host adapter with a conditional ref update.
// This module does not make GitHub's REST file update atomic against unrelated writers.
export class GuardedGitHubWriter {
 constructor({lease,readHead,conditionalWrite,verifyAuthorization}={}){
  if(!lease||typeof lease.verify!=="function"||typeof readHead!=="function"||
     typeof conditionalWrite!=="function"||typeof verifyAuthorization!=="function")
    throw new Error("TRUSTED_GITHUB_WRITER_REQUIRED");
  this.lease=lease;this.readHead=readHead;this.conditionalWrite=conditionalWrite;
  this.verifyAuthorization=verifyAuthorization;
 }
 async write({workspaceId,repository,branch,expectedHead,leaseToken,grant,change}={}){
  const deny=reason=>({status:"NOT_WRITTEN",reason});
  if(repository!=="OpenITStudios/LazyPrompting"||branch!=="Local"||
     !/^[a-f0-9]{40}$/.test(expectedHead??"")||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId??"")||
     !change||typeof change!=="object"||Array.isArray(change))
    return deny("INVALID_WRITE_SCOPE");
  if(!(await this.lease.verify({workspaceId,token:leaseToken,expectedHead})))
    return deny("WRITE_LEASE_INVALID");
  if((await this.readHead(repository,branch))!==expectedHead)
    return deny("STALE_HEAD");
  if((await this.verifyAuthorization({workspaceId,repository,branch,expectedHead,grant,operation:"repo-write"}))!==true)
    return deny("WRITE_AUTHORIZATION_DENIED");
  // The host MUST compare expectedHead atomically at the remote ref-update boundary.
  // No automatic retry after uncertain mutation.
  try{
   const result=await this.conditionalWrite({repository,branch,expectedHead,change});
   if(!result||result.applied!==true||!/^[a-f0-9]{40}$/.test(result.commitSha??""))
    return {status:"RECONCILE_REQUIRED",reason:"REMOTE_WRITE_UNCONFIRMED"};
   return {status:"WRITTEN",commitSha:result.commitSha};
  }catch{return {status:"RECONCILE_REQUIRED",reason:"REMOTE_WRITE_OUTCOME_UNKNOWN"};}
 }
}
