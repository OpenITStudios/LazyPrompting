import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';
import {AgentRunControllerV2} from '../src/agent/agent-run-controller.mjs';
import {AgentBackendRegistry} from '../src/agent/agent-backend-registry.mjs';
import {AGENT_CAPABILITIES} from '../src/agent/agent-contract.mjs';
const H=c=>c.repeat(64);
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
 const id={goalId:'goal-1',workspaceId:'workspace-01',taskId:'task-1'};
 const backend={
  async probe(){return {ready:true}},
  async openSession(){return {sessionId:'session-1'}},
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
  async assertDispatchAllowed(){return true}
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
test('lost transport receipt preserves durable reservation and blocks all redispatch',()=>withRoot(async root=>{
 const metrics={dispatches:0,observes:0,lost:true};const fx=make(root,metrics);
 const a=await fx.setup();
 assert.equal((await a.start(fx.input)).reason,'AGENT_DISPATCH_OUTCOME_UNKNOWN');
 const stored=await new PromptOutbox(fx.path).read();
 assert.equal(stored.items[0].state,'RESERVED');
 assert.equal((await a.start(fx.input)).status,'RECONCILE_REQUIRED');
 assert.equal(metrics.dispatches,1);
}));
