import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {AgentBackendRegistry} from '../src/agent/agent-backend-registry.mjs';
import {AGENT_CAPABILITIES} from '../src/agent/agent-contract.mjs';
import {AgentRunControllerV2} from '../src/agent/agent-run-controller.mjs';
import {fingerprintAgentGoalScopeV2} from '../src/agent/goal-scope-v2.mjs';
const H=c=>c.repeat(64);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const profile=()=>({profileId:'fixture-readonly',adapterId:'codex-app-server',
 adapterContractVersion:1,runtimeVersion:'1.0.0',executableSha256:H('a'),
 platform:process.platform,capabilities:Object.fromEntries(AGENT_CAPABILITIES.map(k=>
 [k,['openSession','resumeSession','submitTurn','observeTurn','cancelTurn','readOnlyIsolation'].includes(k)?
   'SUPPORTED_VERIFIED':'UNKNOWN']))});
const scope=()=>({workerProfile:profile(),permissionPolicySha256:H('1'),
 sandboxPolicySha256:H('2'),executable:resolve('trusted.exe'),cwd:resolve('repository'),
 dataDir:resolve('data'),stopFile:resolve('stop'),objective:'Review source',
 acceptance:['Cite proof'],baseSha:'f'.repeat(40),
 limits:{maxActiveTasks:1,maxTurnsPerTask:2,wallMinutes:10},coding:null});
const input=()=>({goalId:'goal-1',workspaceId:'workspace-01',taskId:'task-1',scope:scope(),prompt:'Review this source.'});
class FakeOutbox {
  items=[]; calls=[];
  async read(){return {schemaVersion:1,items:this.items.map(x=>structuredClone(x))};}
  async reserve({workspaceId,taskId,sessionId,prompt}={}){
    this.calls.push('reserve');
    if(this.items.some(x=>x.taskId===taskId))return {reserved:false,reason:'TASK_ALREADY_DISPATCHED'};
    const promptId='dispatch-1';
    this.items.push({workspaceId,taskId,sessionId,promptId,state:'RESERVED',prompt,
      promptHash:createHash('sha256').update(prompt).digest('hex')});
    return {reserved:true,promptId};
  }
  async transaction(change){return change({items:this.items});}
  async reconcile({workspaceId,promptId,responseId,verified}){
    const e=this.items.find(x=>x.workspaceId===workspaceId&&x.promptId===promptId);
    assert.equal(e?.state,'ACKNOWLEDGED');
    assert.equal(e.responseHandle,responseId);
    assert.equal(verified,true);
    e.state='RESPONSE_VERIFIED';e.responseId=responseId;
  }
}
const state=()=>({outbox:new FakeOutbox(),submits:0,observes:0,cancels:0,opened:0,resumes:0,badResume:false,
 verifyApproved:true,verifyReceipt:true,verifyObservation:true,
 verifyReconcile:true,foreignReconcile:false,
 observation:'COMPLETED',dispatchError:false});
function backend(s){return {
 async probe(){return {ready:true}},
 async openSession(){s.opened++;return {sessionId:'session-1'}},
 async resumeSession({sessionId}){s.resumes++;return {sessionId:s.badResume?'foreign':sessionId}},
 async submitTurn(){s.submits++;if(s.dispatchError)throw Error('NETWORK_LOST');
   return {sessionId:'session-1',turnId:'turn-1'};},
 async observeTurn(receipt){s.observes++;return {state:s.observation,receipt,resultRef:'turn-1'};},
 async cancelTurn(){s.cancels++;return 'CONFIRMED'},
 async close(){}
};}
function host(s){return {
 async verifyApprovedScope({context}){return {source:'TRUSTED_HOST',approved:s.verifyApproved,...context}},
 async verifySession({context,sessionId}){return {source:'TRUSTED_HOST',verified:true,
    sessionId,scopeHash:context.scopeHash,profileId:context.profileId,hostGeneration:'gen-1'}},
 async attestTurnReceipt({receipt,receiptDigest}){return {source:'TRUSTED_HOST',
   verified:s.verifyReceipt,receiptDigest,dispatchId:receipt.dispatchId,scopeHash:receipt.scopeHash}},
 async attestObservation({observation,observationDigest}){return {source:'TRUSTED_HOST',
    verified:s.verifyObservation,observationDigest,dispatchId:observation.receipt.dispatchId,
    scopeHash:observation.receipt.scopeHash}},
 async authorizeCancel({receipt}){return {source:'TRUSTED_HOST',approved:true,
   dispatchId:receipt.dispatchId,scopeHash:receipt.scopeHash}},
 async assertDispatchAllowed(){return true},
 async reconcileReservedDispatch({context,dispatchId,sessionId,promptHash}){
   return {source:'TRUSTED_HOST',verified:s.verifyReconcile,
     dispatchId,sessionId:s.foreignReconcile?'foreign':sessionId,
     promptHash,scopeHash:context.scopeHash,profileId:context.profileId,
     turnId:'turn-1',hostGeneration:'gen-1'};
 }
};}
async function harness(s=state()){
 const r=new AgentBackendRegistry({verifyRegistration:async ({profile:p,fingerprint})=>({
   source:'TRUSTED_HOST',verified:true,fingerprint,profileId:p.profileId})});
 await r.register({profile:profile(),backend:backend(s)});
 return {controller:new AgentRunControllerV2({registry:r,host:host(s),
   outboxFor:async()=>s.outbox}),s,registry:r};
}
test('happy path: one host-approved goal, attested provider result but never QA PASS',async()=>{
 const {controller,s}=await harness();
 const started=await controller.start(input());
 assert.equal(started.status,'ACKNOWLEDGED');
 assert.equal(started.receipt.dispatchId,'dispatch-1');
 assert.equal(s.outbox.items[0].agentReceipt.scopeHash,fingerprintAgentGoalScopeV2(scope()));
 const observed=await controller.observe(input());
 assert.equal(observed.status,'RESULT_ATTESTED');
 assert.equal(observed.qa,'NOT_EXECUTED');
 assert.equal(observed.nextPromptAllowed,false);
 assert.equal(s.outbox.items[0].state,'RESPONSE_VERIFIED');
 assert.equal(s.submits,1);
});
test('dispatch is reserved before network call and never blindly resent on lost reply',async()=>{
 const h=await harness();h.s.dispatchError=true;
 assert.equal((await h.controller.start(input())).reason,'AGENT_DISPATCH_OUTCOME_UNKNOWN');
 assert.equal(h.s.outbox.items[0].state,'RESERVED');
 assert.equal((await h.controller.start(input())).status,'RECONCILE_REQUIRED');
 assert.equal(h.s.submits,1);
 assert.equal((await h.controller.observe(input())).reason,'AGENT_UNACKNOWLEDGED_SEND');
});
test('scope must be attested by host: model-provided approved=true has no authority',async()=>{
 const h=await harness();h.s.verifyApproved=false;
 await assert.rejects(h.controller.start({...input(),approved:true}),/AGENT_SCOPE_NOT_APPROVED/);
 assert.equal(h.s.submits,0);
});
test('worker profile change and coding scope cannot be sneaked into read-only v2',async()=>{
 const h=await harness();const changed=input();changed.scope.workerProfile={...profile(),adapterId:'opencode-v2'};
 await assert.rejects(h.controller.start(changed),/AGENT_PROFILE_SCOPE_CHANGED/);
 const written=input();written.scope.coding={git:resolve('git'),root:resolve('worktrees'),tasks:[{files:['x'],verify:[resolve('node')]}]};
 await assert.rejects(h.controller.start(written),/AGENT_V2_WRITE_DISABLED/);
 assert.equal(h.s.submits,0);
});
test('invalid receipt proof leaves RESERVED and prevents a repeat',async()=>{
 const h=await harness();h.s.verifyReceipt=false;
 assert.equal((await h.controller.start(input())).reason,'AGENT_DISPATCH_RECEIPT_UNVERIFIED');
 assert.equal(h.s.outbox.items[0].state,'RESERVED');
 assert.equal((await h.controller.start(input())).status,'RECONCILE_REQUIRED');
 assert.equal(h.s.submits,1);
});
test('stale stored receipt is rejected before observeTurn',async()=>{
 const h=await harness();await h.controller.start(input());
 h.s.outbox.items[0].agentReceipt={...h.s.outbox.items[0].agentReceipt,sourceSha:'e'.repeat(40)};
 assert.equal((await h.controller.observe(input())).reason,'AGENT_STORED_RECEIPT_CONFLICT');
 assert.equal(h.s.observes,0);
});
test('untrusted terminal/worker claim never becomes DONE',async()=>{
 const h=await harness();await h.controller.start(input());h.s.verifyObservation=false;
 assert.equal((await h.controller.observe(input())).reason,'AGENT_TURN_NOT_ATTESTED');
 assert.equal(h.s.outbox.items[0].state,'ACKNOWLEDGED');
});
test('unknown or failed provider outcomes require reconciliation',async()=>{
 for(const status of ['UNKNOWN','FAILED']){
  const h=await harness();await h.controller.start(input());h.s.observation=status;
  const out=await h.controller.observe(input());
  assert.equal(out.status,'RECONCILE_REQUIRED');
  assert.equal(out.nextPromptAllowed,false);
  assert.equal(h.s.outbox.items[0].state,'ACKNOWLEDGED');
 }
});
test('cancel requires native host callback and does not imply completed QA',async()=>{
 const h=await harness();await h.controller.start(input());
 const result=await h.controller.cancel(input());
 assert.equal(result.status,'STOP_REQUESTED');assert.equal(result.qa,'NOT_EXECUTED');
 assert.equal(h.s.cancels,1);
});
test('not configured and malformed host/outbox fails closed',async()=>{
 await assert.rejects(Promise.resolve().then(()=>new AgentRunControllerV2()),/TRUSTED_AGENT_RUN_HOST_REQUIRED/);
 const h=await harness();h.s.outbox.items=[];
 assert.equal((await h.controller.observe(input())).reason,'AGENT_OUTBOX_PENDING_NOT_UNIQUE');
});

test('duplicate reservation does not create another session',async()=>{
 const {controller,s}=await harness();
 assert.equal((await controller.start(input())).status,'ACKNOWLEDGED');
 assert.equal((await controller.start(input())).status,'RECONCILE_REQUIRED');
 assert.equal(s.opened,1);
 assert.equal(s.submits,1);
});
test('session mismatch on resume is held without result observation',async()=>{
 const {controller,s}=await harness();
 assert.equal((await controller.start(input())).status,'ACKNOWLEDGED');
 s.badResume=true;
 const result=await controller.observe(input());
 assert.equal(result.reason,'AGENT_SESSION_RECONCILE_REQUIRED');
 assert.equal(s.observes,0);
 assert.equal(s.resumes,1);
});

test('lost send is recovered only by host proof of exact reserved dispatch',async()=>{
 const h=await harness();h.s.dispatchError=true;
 assert.equal((await h.controller.start(input())).reason,'AGENT_DISPATCH_OUTCOME_UNKNOWN');
 assert.equal(h.s.outbox.items[0].state,'RESERVED');
 const recovered=await h.controller.reconcileReserved(input());
 assert.equal(recovered.status,'ACKNOWLEDGED');
 assert.equal(recovered.recovered,true);
 assert.equal(h.s.outbox.items[0].state,'ACKNOWLEDGED');
 assert.equal((await h.controller.observe(input())).status,'RESULT_ATTESTED');
 assert.equal(h.s.submits,1);
 assert.equal((await h.controller.reconcileReserved(input())).status,'RECONCILE_REQUIRED');
});
test('foreign or missing host reconciliation leaves the reservation untouched',async()=>{
 const h=await harness();h.s.dispatchError=true;
 await h.controller.start(input());
 h.s.foreignReconcile=true;
 assert.equal((await h.controller.reconcileReserved(input())).reason,
  'AGENT_RESERVED_DISPATCH_UNVERIFIED');
 assert.equal(h.s.outbox.items[0].state,'RESERVED');
 h.s.foreignReconcile=false;h.s.verifyReconcile=false;
 assert.equal((await h.controller.reconcileReserved(input())).reason,
  'AGENT_RESERVED_DISPATCH_UNVERIFIED');
 assert.equal(h.s.submits,1);
});
