import assert from 'node:assert/strict';
import {StructuredWorkerFeedback} from '../src/prompt/structured-worker-feedback.mjs';
import {TrustedGoalReview} from '../src/prompt/trusted-goal-review.mjs';
let n=0;
const eq=(a,b,why)=>{assert.deepEqual(a,b,why);n++};
const sha='a'.repeat(40);
const id={goalId:'goal-01',workspaceId:'workspace-01',sessionId:'chat-01',
 taskId:'task-01',promptId:'prompt-01',responseHandle:'handle-01',responseId:'result-01',
 contextRevision:3,repository:'OpenITStudios/Project',branch:'Local',baseSha:sha};
function harness({changeResult,changeReview,changeAttestation,changeIdentity}={}){
 let reviews=0,proposal=null;
 const feedback=new StructuredWorkerFeedback({
  readResult:async()=>{
   const r={schemaVersion:1,...id,provider:'CODEX_APP_SERVER',outcome:'CONTINUE',
     summary:'A test is still failing',evidenceRefs:[],nextAction:{action:'Fix UV',owner:'uv',proof:'rerun tests'}};
   changeResult?.(r);return r;
  },
  verifyResult:async({identity,fingerprint,provider})=>{
   const r={...identity,fingerprint,provider,trusted:true,source:'TRUSTED_HOST',
     status:'TURN_COMPLETED',transportVerified:true,operatorScopeApproved:true};
   changeAttestation?.(r);return r;
  }
 });
 const gate=new TrustedGoalReview({feedback,readIdentity:async()=>{
   const identity={...id,allowedActions:['Fix UV']};changeIdentity?.(identity);return identity;
 },review:{inspectUnderLease:async({proposal:p})=>{
   reviews++;proposal=p;
   const r={status:'REVIEWED',nextPromptAllowed:false,...id,checkpointVersion:4,
     source:{repository:id.repository,branch:id.branch,baseSha:sha,
       headSha:'b'.repeat(40),qa:'PASS',acceptancePassed:false},
     decision:{state:'READY',reason:'AUTHORIZED_NEXT_ACTION'}};
   changeReview?.(r);return r;
 }}});
 return {run:(extra={})=>gate.inspectUnderLease({workspaceId:'workspace-01',receipt:{},...extra}),
  get reviews(){return reviews},get proposal(){return proposal}};
}
{
 const h=harness(),r=await h.run({proposal:{outcome:'DONE',nextAction:{action:'Delete main'}}});
 eq(r.status,'REVIEWED','bound result reviewed');
 eq(r.feedbackVerified,true,'feedback verified');
 eq(r.nextPromptAllowed,false,'still read-only');
 eq(h.proposal.outcome,'CONTINUE','untrusted MCP proposal ignored');
 eq(h.proposal.nextAction.action,'Fix UV','host result proposal used');
 eq(r.workerReport.summary,'A test is still failing','short report for Codex');
 eq(r.workerFeedbackHash.length,64,'hash bound to checkpoint');
 eq(h.reviews,1,'one review');
}
for(const [name,options,reason] of [
 ['wrong worker response',{changeResult:r=>{r.responseId='other'}},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['no transport',{changeAttestation:r=>{r.transportVerified=false}},'WORKER_RESULT_ATTESTATION_MISMATCH'],
 ['wrong source head',{changeReview:r=>{r.source.baseSha='c'.repeat(40)}},'WORKER_FEEDBACK_REVIEW_BINDING_MISMATCH'],
 ['wrong review session',{changeReview:r=>{r.sessionId='other'}},'WORKER_FEEDBACK_REVIEW_BINDING_MISMATCH'],
 ['unknown action',{changeIdentity:r=>{r.allowedActions=['Delete main']}},'WORKER_NEXT_ACTION_OUT_OF_SCOPE'],
 ['not ready',{changeReview:r=>{r.decision.state='BLOCKED'}},'WORKER_FEEDBACK_REVIEW_BINDING_MISMATCH']
]){
 const h=harness(options),r=await h.run();
 eq(r.reason,reason,name);
 eq(r.nextPromptAllowed,false,name+' never dispatch');
}
for(const [outcome,reason] of [
 ['WAIT','WORKER_REQUESTED_WAIT'],
 ['BLOCKED','WORKER_REPORTED_BLOCKER'],
 ['NEEDS_APPROVAL','WORKER_REQUIRES_OPERATOR_APPROVAL']]){
 const h=harness({changeResult:r=>{r.outcome=outcome;delete r.nextAction;r.blocker='Operator decision';}}),
 r=await h.run();
 eq(r.reason,reason,outcome+' no blind continue');
 eq(h.reviews,0,outcome+' does not use GitHub review');
}
{
 const h=harness({changeReview:r=>{
   r.status='REVIEW_REQUIRED';r.reason='TRUSTED_MILESTONE_RECEIPT_MISSING';
   r.source.headSha=sha;r.source.changed=false;
 }}),r=await h.run();
 eq(r.status,'REVIEW_REQUIRED','no commit or QA still needs evidence');
 eq(r.workerReport.summary,'A test is still failing','verified explanation survives missing commit');
 eq(r.feedbackVerified,true,'worker feedback provenance distinct from QA proof');
 eq(r.nextPromptAllowed,false,'missing commit cannot auto continue');
}
{
 const h=harness(),r=await h.run({workspaceId:'workspace-11'});
 eq(r.reason,'INVALID_WORKSPACE_ID','wrong workspace rejected');
 eq(h.reviews,0,'no side effects');
}
assert.throws(()=>new TrustedGoalReview(),/TRUSTED_GOAL_REVIEW_HOST_REQUIRED/);n++;
console.log('Trusted goal review contract: PASS ('+n+' assertions; synthetic host only)');
