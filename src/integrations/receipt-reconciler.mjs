// A receipt is trusted only if a separately configured verifier checks its provenance.
export class ReceiptReconciler {
  constructor({sourceProvider,verifyReceipt}={}){
    if(!sourceProvider||typeof sourceProvider.head!=="function"||typeof verifyReceipt!=="function")
      throw new Error("TRUSTED_EVIDENCE_PROVIDERS_REQUIRED");
    this.sourceProvider=sourceProvider;this.verifyReceipt=verifyReceipt;
  }
  async reconcile({goal,observation,receipt}={}){
    if(!goal||!observation||goal.repository!=="OpenITStudios/LazyPrompting"||goal.branch!=="Local")
      return {verified:false,reason:"INVALID_TARGET",qa:"UNKNOWN"};
    const source=await this.sourceProvider.head(goal.repository,goal.branch);
    if(source.headSha!==observation.headSha)
      return {...source,verified:false,reason:"STALE_SOURCE",qa:"UNKNOWN"};
    if(!receipt)return {...source,verified:true,reason:"SOURCE_ONLY",qa:"NOT_EXECUTED",changed:false,acceptancePassed:false};
    const accepted=await this.verifyReceipt({receipt,goal,observation,headSha:source.headSha});
    if(!accepted||accepted.trusted!==true||accepted.headSha!==source.headSha||
       !["PASS","FAIL","NOT_EXECUTED"].includes(accepted.qa))
      return {...source,verified:true,reason:"RECEIPT_UNVERIFIED",qa:"NOT_EXECUTED",changed:false,acceptancePassed:false};
    return {...source,verified:true,reason:"TRUSTED_RECEIPT",qa:accepted.qa,
      failure:accepted.qa==="FAIL"?String(accepted.failure??"").slice(0,512):undefined,
      changed:accepted.changed===true,acceptancePassed:accepted.acceptancePassed===true};
  }
}
