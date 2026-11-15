import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';
import {AgentRunControllerV2} from '../src/agent/agent-run-controller.mjs';
import {AgentBackendRegistry} from '../src/agent/agent-backend-registry.mjs';
import {AGENT_CAPABILITIES} from '../src/agent/agent-contract.mjs';
const H=c=>c.repeat(64);
const goalId='12345678-1234-1234-1234-123456789abc';
const runId=goalId+'.'+'a'.repeat(32);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const profile=()=>({profileId:'opencode-readonly',adapterId:'opencode-v2',
 adapterContractVersion:1,runtimeVersion:'2.2.3',executableSha256:H('a'),
 platform:process.platform,capabilities:Object.fromEntries(AGENT_CAPABILITIES.map(name=>
 [name,['readOnlyIsolation','openSession','resumeSession','submitTurn','observeTurn','cancelTurn'].includes(name)?
  'SUPPORTED_VERIFIED':'UNKNOWN']))});
function make(root,metrics){
 const scope={workerProfile:profile(),permissionPolicySha256:H('b'),sandboxPolicySha256:H('c'),
  executable:join(root,'opencode.exe'),cwd:join(root,'checkout'),dataDir:join(root,'data'),
  stopFile:join(root,'stop'),objective:'Review read-only source',acceptance:['Validate source'],
  baseSha:'e'.repeat(40),limits:{maxActiveTasks:1,maxTurnsPerTask:2,wallMinutes:10},coding:null};
 const id={goalId,runId,workspaceId:'workspace-01',taskId:'task-1'};
 const backend={
  async probe(){return {ready:true}},
  async openSession(){
   metrics.opens=(metrics.opens??0)+1;
   if(metrics.openLost)throw Error('SESSION_UNKNOWN');
   return {sessionId:'session-1'};
  },
  async resumeSession({sessionId}){return {sessionId}},
  async submitTurn(){metrics.dispatches++;if(metrics.lost)throw Error('lost');
    return {sessionId:'session-1',turnId:'turn-1'}},
  async observeTurn(receipt){metrics.observes++;return {receipt,state:'COMPLETED',resultRef:'turn-1'}},
  async cancelTurn(){return 'CONFIRMED'}, async close(){}
 };
 const host={
  async verifyApprovedScope({context}){return {...context,source:'TRUSTED_HOST',approved:true}},
  async verifySession({context,sessionId}){return {source:'TRUSTED_HOST',verified:true,
    sessionId,scopeHash:context.scopeHash,profileId:context.profileId,hostGeneration:'host-1'}},
  async attestTurnReceipt({receipt,receiptDigest}){return {source:'TRUSTED_HOST',verified:true,
    receiptDigest,dispatchId:receipt.dispatchId,scopeHash:receipt.scopeHash}},
  async attestObservation({observation,observationDigest}){return {source:'TRUSTED_HOST',verified:true,
    observationDigest,scopeHash:observation.receipt.scopeHash,
    dispatchId:observation.receipt.dispatchId}},
  async authorizeCancel({receipt}){return {source:'TRUSTED_HOST',approved:true,
    scopeHash:receipt.scopeHash,dispatchId:receipt.dispatchId}},
  async assertDispatchAllowed({context,scope,dispatchId}){
   return {...context,...(dispatchId?{dispatchId}:{}),
    source:'TRUSTED_HOST',schemaVersion:3,action:'start',
    admitted:true,osSandboxVerified:true,
    reservationOwner:'PROMPT_OUTBOX',qa:'NOT_EXECUTED',
    nextPromptAllowed:false,
    executableSha256:scope.workerProfile.executableSha256,
    permissionPolicySha256:scope.permissionPolicySha256,
    sandboxPolicySha256:scope.sandboxPolicySha256};
  },
  async reconcileReservedDispatch({context,dispatchId,sessionId,promptHash}){
   return {source:'TRUSTED_HOST',verified:metrics.reconciliation===true,
    dispatchId,sessionId,promptHash,scopeHash:context.scopeHash,
    profileId:context.profileId,turnId:'turn-1',hostGeneration:'host-1'};
  }
 };
 const setup=async()=>{
  const registry=new AgentBackendRegistry({verifyRegistration:async ({profile:p,fingerprint})=>({
    source:'TRUSTED_HOST',verified:true,profileId:p.profileId,fingerprint})});
  await registry.register({profile:profile(),backend});
  return new AgentRunControllerV2({registry,host,
    outboxFor:async()=>new PromptOutbox(join(root,'canonical-outbox.json'))});
 };
 return {setup,input:{...id,scope,prompt:'Read source.'},path:join(root,'canonical-outbox.json')};
}
async function withRoot(fn){const root=await mkdtemp(join(tmpdir(),'lp-agent-'));
 try{await fn(root)}finally{await rm(root,{recursive:true,force:true})}}
test('real PromptOutbox persists a host-attested result and restart reads it idempotently',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0};const fixture=make(root,metrics);
 const a=await fixture.setup();const sent=await a.start(fixture.input);
 assert.equal(sent.status,'ACKNOWLEDGED');
 const stored=await new PromptOutbox(fixture.path).read();
 assert.equal(stored.items[0].agentReceipt.turnId,'turn-1');
 const observed=await a.observe(fixture.input);
 assert.equal(observed.status,'RESULT_ATTESTED');
 assert.equal((await new PromptOutbox(fixture.path).read()).items[0].state,'RESPONSE_VERIFIED');
 // New controller instance simulates restart; same canonical file is source of truth.
 const restarted=await fixture.setup().catch(e=>{throw e});
 const result=await restarted.observe(fixture.input);
 assert.equal(result.status,'RESULT_ATTESTED');
 assert.equal(result.qa,'NOT_EXECUTED');assert.equal(metrics.observes,1);
 assert.equal(metrics.dispatches,1);
}));
test('file-backed session intent survives restart and holds without a provider turn',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0,openLost:true};const fx=make(root,metrics);
 const a=await fx.setup();
 assert.equal((await a.start(fx.input)).reason,'AGENT_SESSION_OUTCOME_UNKNOWN');
 const stored=await new PromptOutbox(fx.path).read();
 assert.equal(stored.items[0].state,'SESSION_PENDING');
 assert.equal(stored.items[0].sessionId,undefined);
 assert.equal(stored.items[0].agentIntent.scopeHash.length,64);
 assert.equal(stored.items[0].agentIntent.runId,runId);
 assert.equal((await (await fx.setup()).start(fx.input)).status,'RECONCILE_REQUIRED');
 assert.equal(metrics.opens,1);assert.equal(metrics.dispatches,0);
}));
test('persisted cross-goal intent fails before provider observation',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0};const fx=make(root,metrics);
 const agent=await fx.setup();
 assert.equal((await agent.start(fx.input)).status,'ACKNOWLEDGED');
 const state=JSON.parse(await readFile(fx.path,'utf8'));
 state.items[0].agentIntent.goalId='foreign-goal';
 await writeFile(fx.path,JSON.stringify(state)+'\n');
 const restarted=await fx.setup();
 assert.equal((await restarted.observe(fx.input)).reason,'AGENT_OUTBOX_SCOPE_CHANGED');
 assert.equal(metrics.observes,0);
 assert.equal(metrics.dispatches,1);
}));
test('lost transport receipt preserves durable reservation and blocks all redispatch',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0,lost:true};const fx=make(root,metrics);
 const a=await fx.setup();
 assert.equal((await a.start(fx.input)).reason,'AGENT_DISPATCH_OUTCOME_UNKNOWN');
 const stored=await new PromptOutbox(fx.path).read();
 assert.equal(stored.items[0].state,'RESERVED');
 assert.equal((await a.start(fx.input)).status,'RECONCILE_REQUIRED');
 assert.equal(metrics.dispatches,1);
}));

test('file-backed unknown send can recover exact host-attested receipt on restart',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0,lost:true,reconciliation:true};
 const fx=make(root,metrics),a=await fx.setup();
 assert.equal((await a.start(fx.input)).status,'RECONCILE_REQUIRED');
 const next=await fx.setup();
 const recovered=await next.reconcileReserved(fx.input);
 assert.equal(recovered.status,'ACKNOWLEDGED');
 assert.equal((await new PromptOutbox(fx.path).read()).items[0].state,'ACKNOWLEDGED');
 assert.equal((await next.observe(fx.input)).status,'RESULT_ATTESTED');
 assert.equal(metrics.dispatches,1);
}));
