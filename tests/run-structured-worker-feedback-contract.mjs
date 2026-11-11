import assert from 'node:assert/strict';
import {StructuredWorkerFeedback} from '../src/prompt/structured-worker-feedback.mjs';
let n=0;
const eq=(a,b,why)=>{assert.deepEqual(a,b,why);n++};
const identity={goalId:'goal-01',workspaceId:'workspace-01',sessionId:'chat-01',
  taskId:'task-01',promptId:'prompt-01',responseHandle:'handle-01',responseId:'response-01',
  contextRevision:2,repository:'OpenITStudios/Project',branch:'Local',baseSha:'a'.repeat(40)};
const allowedActions=['Review code'];
function harness({change,attest,missing=false}={}){
  let verifierCalls=0;
  const feedback=new StructuredWorkerFeedback({
    readResult:async()=>{
      if(missing)return null;
      const x={schemaVersion:1,...identity,provider:'CODEX_APP_SERVER',
        outcome:'CONTINUE',summary:'Checked the module; the UV tests remain',
        nextAction:{action:'Review code',owner:'UV generator',proof:'Run UV tests'},
        evidenceRefs:[{kind:'ARTIFACT',ref:'artifact-01'}]};
      change?.(x);return x;
    },
    verifyResult:async({identity:id,fingerprint,provider})=>{
      verifierCalls++;
      const x={...id,provider,fingerprint,trusted:true,source:'TRUSTED_HOST',
        status:'TURN_COMPLETED',transportVerified:true,operatorScopeApproved:true};
      attest?.(x);return x;
    }
  });
  return {run:()=>feedback.resolve({identity,allowedActions}),get calls(){return verifierCalls}};
}
{
 const h=harness(),r=await h.run();
 eq(r.status,'VERIFIED','authorized result accepted');
 eq(r.proposal.outcome,'CONTINUE','outcome is only a proposal');
 eq(r.proposal.nextAction.action,'Review code','bounded approved next step');
 eq(r.report.summary,'Checked the module; the UV tests remain','summary preserved');
 eq(r.nextPromptAllowed,false,'no send permission');
 eq(r.fingerprint.length,64,'fingerprint present');
 eq(h.calls,1,'one attestation');
}
for(const [name,change,reason] of [
 ['response mismatch',r=>{r.responseId='wrong'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['branch mismatch',r=>{r.branch='main'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['prompt mismatch',r=>{r.promptId='other'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['context mismatch',r=>{r.contextRevision=4},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['unapproved provider',r=>{r.provider='CHATGPT_WEB_SCRAPER'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['excess field',r=>{r.trusted=true},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['embedded transcript',r=>{r.transcript='full ChatGPT reply'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['oversize summary',r=>{r.summary='x'.repeat(601)},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['action injection',r=>{r.nextAction.grant='true'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['missing next action',r=>{delete r.nextAction},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['bad artifact kind',r=>{r.evidenceRefs=[{kind:'WEB',ref:'x'}]},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH'],
 ['unexpected outcome',r=>{r.outcome='PRODUCTION_DISPATCH'},'WORKER_RESULT_SCOPE_OR_SCHEMA_MISMATCH']
 ]){
 const h=harness({change}),r=await h.run();
 eq(r.reason,reason,name);
 eq(r.nextPromptAllowed,false,name+' never sends');
 eq(h.calls,0,name+' never reaches verifier');
}
for(const [name,attest] of [
 ['untrusted',r=>{r.trusted=false}],
 ['wrong fingerprint',r=>{r.fingerprint='b'.repeat(64)}],
 ['wrong binding',r=>{r.responseHandle='other'}],
 ['UI-only',r=>{r.status='UI_COMPLETED_OBSERVED'}],
 ['transport absent',r=>{r.transportVerified=false}],
 ['operator approval absent',r=>{r.operatorScopeApproved=false}]
]){
 const h=harness({attest}),r=await h.run();
 eq(r.reason,'WORKER_RESULT_ATTESTATION_MISMATCH',name);
 eq(r.nextPromptAllowed,false,name+' cannot send');
}
{
 const h=harness({missing:true});eq((await h.run()).reason,'NO_VERIFIABLE_WORKER_RESULT','missing feedback held');
}
{
 const h=harness({change:r=>{r.outcome='DONE';delete r.nextAction;r.evidenceRefs=[]}}),r=await h.run();
 eq(r.status,'VERIFIED','DONE claim recognized');
 eq(r.proposal.outcome,'DONE','DONE is not QA PASS');
 eq(Object.hasOwn(r,'qa'),false,'QA proof must be separate');
}
for(const [outcome,reason] of [
 ['WAIT','WORKER_REQUESTED_WAIT'],['BLOCKED','WORKER_REPORTED_BLOCKER'],
 ['NEEDS_APPROVAL','WORKER_REQUIRES_OPERATOR_APPROVAL']]){
 const h=harness({change:r=>{r.outcome=outcome;delete r.nextAction;r.blocker='Needs operator';}}),r=await h.run();
 eq(r.reason,reason,outcome+' holds');
 eq(r.report.blocker,'Needs operator',outcome+' reason recorded');
 eq(r.nextPromptAllowed,false,outcome+' never sends');
}
assert.throws(()=>new StructuredWorkerFeedback(),/TRUSTED_HOST_REQUIRED/);n++;
console.log('Structured worker feedback contract: PASS ('+n+' assertions; synthetic host only)');
