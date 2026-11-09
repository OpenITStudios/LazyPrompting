// Verifies a host-issued authorization against the persisted reservation and current grant.
// This is a verification boundary, not a grant issuer or cryptographic signature.
export class ReservationVerifier {
 constructor({ledger,verifyGrant,readCurrentHead,clock=()=>Date.now()}={}){
  if(!ledger||typeof ledger.read!=="function"||typeof verifyGrant!=="function"||
     typeof readCurrentHead!=="function"||typeof clock!=="function")
    throw new Error("TRUSTED_RESERVATION_PROVIDERS_REQUIRED");
  this.ledger=ledger;this.verifyGrant=verifyGrant;this.readCurrentHead=readCurrentHead;this.clock=clock;
 }
 async verify({receipt,goalId,taskId,repository,branch,operation}={}){
  if(!receipt||receipt.authorized!==true||receipt.reason!=="TRUSTED_SCOPE_RESERVED"||
     receipt.goalId!==goalId||receipt.taskId!==taskId||
     receipt.repository!==repository||receipt.branch!==branch||
     receipt.operation!==operation||operation!=="agent-dispatch"||
     repository!=="OpenITStudios/LazyPrompting"||branch!=="Local"||
     !/^[a-f0-9]{40}$/.test(receipt.expectedHead??"")||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(receipt.grantId??""))return false;
  const grant=await this.verifyGrant(receipt.grantId);
  if(!grant||grant.trusted!==true||grant.revoked===true||grant.goalId!==goalId||
     grant.repository!==repository||grant.branch!==branch||
     !Array.isArray(grant.operations)||!grant.operations.includes(operation)||
     !Number.isSafeInteger(grant.expiresAt)||grant.expiresAt<=this.clock())return false;
  const head=await this.readCurrentHead(repository,branch);
  if(head!==receipt.expectedHead)return false;
  const ledger=await this.ledger.read();
  const matches=ledger.reservations.filter(r=>r.key===receipt.grantId+":"+taskId&&
    r.taskId===taskId&&r.goalId===goalId&&r.grantId===receipt.grantId&&
    r.headSha===receipt.expectedHead&&r.status==="RESERVED");
  return matches.length===1;
 }
}
