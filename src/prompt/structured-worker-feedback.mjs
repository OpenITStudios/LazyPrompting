import {createHash} from 'node:crypto';

// Verified, bounded feedback from an authorized *agent host*. This is NOT
// an adapter to ChatGPT's consumer Web UI, a page scraper, or permission to send.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const KINDS=new Set(['CODEX_APP_SERVER','AUTHORIZED_STRUCTURED_CALLBACK']);
const OUTCOMES=new Set(['CONTINUE','DONE','WAIT','BLOCKED','NEEDS_APPROVAL']);
const KEYS=new Set(['schemaVersion','goalId','workspaceId','sessionId','taskId','promptId',
  'responseHandle','responseId','contextRevision','repository','branch','baseSha',
  'provider','outcome','summary','blocker','nextAction','evidenceRefs']);
const NEXT_KEYS=new Set(['action','owner','proof','requiresApproval']);
const REF_KEYS=new Set(['kind','ref']);
const REF_KINDS=new Set(['COMMIT','QA_RECEIPT','ARTIFACT','DOCUMENT']);
const fail=reason=>({status:'REVIEW_REQUIRED',reason,nextPromptAllowed:false});
const id=s=>typeof s==='string'&&ID.test(s);
const bounded=(s,max)=>typeof s==='string'&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s);
const text=(s,max)=>bounded(s,max)&&s.trim().length>0;
const exactKeys=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).every(k=>keys.has(k));
const validIdentity=x=>x&&WORKSPACE.test(x.workspaceId??'')&&
  [x.goalId,x.sessionId,x.taskId,x.promptId,x.responseHandle,x.responseId].every(id)&&
  REPO.test(x.repository??'')&&BRANCH.test(x.branch??'')&&
  !x.branch.includes('..')&&!x.branch.startsWith('/')&&!x.branch.endsWith('/')&&
  !x.branch.includes('//')&&SHA.test(x.baseSha??'')&&
  Number.isSafeInteger(x.contextRevision)&&x.contextRevision>=0;

function normalize(raw,identity){
  if(!exactKeys(raw,KEYS)||raw.schemaVersion!==1||
     !KINDS.has(raw.provider)||!OUTCOMES.has(raw.outcome)||
     !text(raw.summary,600)||
     (raw.blocker!==undefined&&!text(raw.blocker,300))||
     !Array.isArray(raw.evidenceRefs)||raw.evidenceRefs.length>8||
     raw.evidenceRefs.some(x=>!exactKeys(x,REF_KEYS)||!REF_KINDS.has(x.kind)||
       !text(x.ref,200)))return null;
  for(const key of ['goalId','workspaceId','sessionId','taskId','promptId',
    'responseHandle','responseId','contextRevision','repository','branch','baseSha']){
    if(raw[key]!==identity[key])return null;
  }
  let nextAction=null;
  if(raw.nextAction!=null){
    if(!exactKeys(raw.nextAction,NEXT_KEYS)||
       !text(raw.nextAction.action,200)||!text(raw.nextAction.owner,160)||
       !text(raw.nextAction.proof,260)||
       (raw.nextAction.requiresApproval!==undefined&&
         typeof raw.nextAction.requiresApproval!=='boolean'))return null;
    nextAction={action:raw.nextAction.action,owner:raw.nextAction.owner,
      proof:raw.nextAction.proof,requiresApproval:raw.nextAction.requiresApproval===true};
  }
  if(raw.outcome==='CONTINUE'&&!nextAction)return null;
  if(raw.outcome!=='CONTINUE'&&nextAction)return null;
  if(['WAIT','BLOCKED','NEEDS_APPROVAL'].includes(raw.outcome)&&
     !text(raw.blocker,300))return null;
  return Object.freeze({schemaVersion:1,
    goalId:identity.goalId,workspaceId:identity.workspaceId,sessionId:identity.sessionId,
    taskId:identity.taskId,promptId:identity.promptId,
    responseHandle:identity.responseHandle,responseId:identity.responseId,
    contextRevision:identity.contextRevision,repository:identity.repository,
    branch:identity.branch,baseSha:identity.baseSha,
    provider:raw.provider,outcome:raw.outcome,
    summary:raw.summary,blocker:raw.blocker??null,nextAction,
    evidenceRefs:raw.evidenceRefs.map(x=>({kind:x.kind,ref:x.ref}))});
}
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');

export class StructuredWorkerFeedback {
  constructor({readResult,verifyResult}={}){
    if(typeof readResult!=='function'||typeof verifyResult!=='function')
      throw Error('WORKER_FEEDBACK_TRUSTED_HOST_REQUIRED');
    this.readResult=readResult;
    this.verifyResult=verifyResult;
  }
  async resolve({identity,allowedActions=[]}={}){
    if(!validIdentity(identity)||!Array.isArray(allowedActions)||
       allowedActions.length>32||allowedActions.some(x=>!text(x,200)))
      return fail('INVALID_WORKER_FEEDBACK_SCOPE');
    let raw,normalized;
    try{
      raw=await this.readResult({...identity});
      if(!raw)return fail('NO_VERIFIABLE_WORKER_RESULT');
      normalized=normalize(raw,identity);
    }catch{return fail('WORKER_RESULT_UNAVAILABLE');}
    if(!normalized)return fail('WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH');
    const fingerprint=hash(normalized);
    let attestation;
    try{attestation=await this.verifyResult({identity:{...identity},
      fingerprint,provider:normalized.provider});}
    catch{return fail('WORKER_RESULT_ATTESTATION_UNAVAILABLE');}
    // Only the trusted host may produce this attestation. Neither a model
    // claim nor an MCP input containing {trusted:true} can mint it.
    if(attestation?.trusted!==true||attestation.source!=='TRUSTED_HOST'||
       attestation.transportVerified!==true||attestation.operatorScopeApproved!==true||
       attestation.provider!==normalized.provider||
       !DIGEST.test(attestation.fingerprint??'')||attestation.fingerprint!==fingerprint||
       attestation.status!=='TURN_COMPLETED'||
       ['goalId','workspaceId','sessionId','taskId','promptId','responseHandle',
         'responseId','contextRevision','repository','branch','baseSha']
         .some(key=>attestation[key]!==identity[key]))
      return fail('WORKER_RESULT_ATTESTATION_MISMATCH');
    if(normalized.outcome==='CONTINUE'&&
       !allowedActions.includes(normalized.nextAction.action))
      return fail('WORKER_NEXT_ACTION_OUT_OF_SCOPE');
    // This report is *not* an independent QA receipt. No response text,
    // browser DOM or caller-provided evidence is used to assert QA PASS.
    if(normalized.outcome==='WAIT')return {
      ...fail('WORKER_REQUESTED_WAIT'),report:report(normalized)};
    if(normalized.outcome==='BLOCKED')return {
      ...fail('WORKER_REPORTED_BLOCKER'),report:report(normalized)};
    if(normalized.outcome==='NEEDS_APPROVAL')return {
      ...fail('WORKER_REQUIRES_OPERATOR_APPROVAL'),report:report(normalized)};
    return {status:'VERIFIED',reason:'TRUSTED_STRUCTURED_WORKER_RESULT',
      nextPromptAllowed:false,
      proposal:{outcome:normalized.outcome,
        ...(normalized.nextAction?{nextAction:normalized.nextAction}:{})},
      report:report(normalized),fingerprint};
  }
}
function report(v){return {provider:v.provider,outcome:v.outcome,
  summary:v.summary,blocker:v.blocker,evidenceRefs:v.evidenceRefs};}
