// A receipt is trusted only if a separately configured verifier checks its provenance.
// The approved target is bound by the host, never selected by a model receipt.
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const validScope=s=>s&&REPO.test(s.repository??'')&&BRANCH.test(s.branch??'')&&
  !s.branch.includes('..')&&!s.branch.includes('//')&&
  !s.branch.startsWith('/')&&!s.branch.endsWith('/');
const LEGACY_SCOPE=Object.freeze({repository:'OpenITStudios/LazyPrompting',branch:'Local'});
export class ReceiptReconciler {
  constructor({sourceProvider,verifyReceipt,scope=null}={}){
    if(!sourceProvider||typeof sourceProvider.head!=='function'||typeof verifyReceipt!=='function')
      throw new Error('TRUSTED_EVIDENCE_PROVIDERS_REQUIRED');
    if(scope!==null&&!validScope(scope))throw new Error('INVALID_RECEIPT_SCOPE');
    this.sourceProvider=sourceProvider;this.verifyReceipt=verifyReceipt;
    this.scope=Object.freeze(scope?{repository:scope.repository,branch:scope.branch}:LEGACY_SCOPE);
    this.strictIdentity=scope!==null;
  }
  async reconcile({goal,observation,receipt}={}){
    if(!goal||!observation||goal.repository!==this.scope.repository||
       goal.branch!==this.scope.branch)
      return {verified:false,reason:'INVALID_TARGET',qa:'UNKNOWN'};
    if(this.strictIdentity&&(!ID.test(goal.id??'')||!ID.test(observation.promptId??'')))
      return {verified:false,reason:'INVALID_RECEIPT_IDENTITY',qa:'UNKNOWN'};
    const source=await this.sourceProvider.head(goal.repository,goal.branch);
    if(source.repository!==goal.repository||source.branch!==goal.branch||
       source.headSha!==observation.headSha)
      return {...source,verified:false,reason:'STALE_SOURCE',qa:'UNKNOWN'};
    if(!receipt)return {...source,verified:true,reason:'SOURCE_ONLY',qa:'NOT_EXECUTED',
      changed:false,acceptancePassed:false};
    const accepted=await this.verifyReceipt({receipt,goal,observation,headSha:source.headSha});
    const mismatched=this.strictIdentity&&(accepted?.repository!==goal.repository||
      accepted?.branch!==goal.branch||accepted?.goalId!==goal.id||
      accepted?.promptId!==observation.promptId);
    if(!accepted||accepted.trusted!==true||accepted.headSha!==source.headSha||
       !['PASS','FAIL','NOT_EXECUTED'].includes(accepted.qa)||mismatched)
      return {...source,verified:true,reason:'RECEIPT_UNVERIFIED',qa:'NOT_EXECUTED',
        changed:false,acceptancePassed:false};
    return {...source,verified:true,reason:'TRUSTED_RECEIPT',qa:accepted.qa,
      failure:accepted.qa==='FAIL'?String(accepted.failure??'').slice(0,512):undefined,
      changed:accepted.changed===true,acceptancePassed:accepted.qa==='PASS'&&accepted.acceptancePassed===true};
  }
}
