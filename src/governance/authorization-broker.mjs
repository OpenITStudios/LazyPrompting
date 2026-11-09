// Host-side authorization gate. The caller must provide a trusted verifier, not model-supplied flags.
export class AuthorizationBroker {
  constructor({verifyGrant,readCurrentHead,clock=()=>Date.now()}={}){
    if(typeof verifyGrant!=="function"||typeof readCurrentHead!=="function")throw new Error("TRUSTED_PROVIDERS_REQUIRED");
    this.verifyGrant=verifyGrant;this.readCurrentHead=readCurrentHead;this.clock=clock;
    this.used=new Set(); // process-local replay guard; durable replay protection remains required
  }
  async authorize({grantId,goalId,taskId,repository,branch,expectedHead,operation}={}){
    const deny=reason=>({authorized:false,reason});
    if(!/^[A-Za-z0-9:_-]{1,128}$/.test(grantId??"")||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(goalId??"")||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??"")||
       repository!=="OpenITStudios/LazyPrompting"||branch!=="Local"||
       !/^[a-f0-9]{40}$/.test(expectedHead??"")||operation!=="agent-dispatch")return deny("INVALID_SCOPE");
    const key=grantId+":"+taskId;
    if(this.used.has(key))return deny("REPLAYED_TASK");
    const grant=await this.verifyGrant(grantId); // only a trusted host can issue and verify a grant
    if(!grant||grant.trusted!==true||grant.revoked===true||
       grant.goalId!==goalId||grant.repository!==repository||grant.branch!==branch||
       !Array.isArray(grant.operations)||!grant.operations.includes(operation)||
       !Number.isSafeInteger(grant.expiresAt)||grant.expiresAt<=this.clock())return deny("GRANT_NOT_VALID");
    const actual=await this.readCurrentHead(repository,branch);
    if(actual!==expectedHead)return deny("STALE_HEAD");
    this.used.add(key);
    return {authorized:true,reason:"TRUSTED_SCOPE_VERIFIED",grantId,taskId};
  }
}
