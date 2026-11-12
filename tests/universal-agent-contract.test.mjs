import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {
  AGENT_CAPABILITIES, normalizeAgentProfile, fingerprintAgentProfile,
  requireAgentCapability, assertAgentBackendInterface
} from '../src/agent/agent-contract.mjs';
import {AgentBackendRegistry} from '../src/agent/agent-backend-registry.mjs';
import {
  normalizeAgentTurnReceipt,normalizeAgentEvent,AgentEventCursor
} from '../src/agent/agent-events.mjs';
import {fingerprintAgentGoalScopeV2} from '../src/agent/goal-scope-v2.mjs';
import {fingerprintGoalRunScope} from '../src/transport/goal-run-scope.mjs';

const H = c => c.repeat(64);
const profile = () => ({
  profileId:'opencode-readonly',adapterId:'opencode-v2',
  adapterContractVersion:1,runtimeVersion:'2.0.1',executableSha256:H('a'),
  platform:process.platform === 'darwin'?'darwin':process.platform === 'win32'?'win32':'linux',
  capabilities:Object.fromEntries(AGENT_CAPABILITIES.map(k=>[k,
    ['openSession','submitTurn','observeTurn','cancelTurn','readOnlyIsolation'].includes(k)
      ? 'SUPPORTED_VERIFIED' : 'UNKNOWN']))
});
const backend=()=>({
  async probe(){return {ready:true}},
  async openSession(){return {sessionId:'s1'}},
  async resumeSession(){return {sessionId:'s1'}},
  async submitTurn(){return {id:'turn1'}},
  async observeTurn(){return {state:'RUNNING'}},
  async cancelTurn(){return 'CONFIRMED'},
  async close(){}
});
const receipt=()=>({
  receiptVersion:1,goalId:'goal-1',taskId:'task-1',dispatchId:'dispatch-1',
  profileId:'opencode-readonly',adapterId:'opencode-v2',
  sessionId:'session-1',turnId:'turn-1',hostGeneration:'generation-1',
  scopeHash:H('f'),sourceSha:'a'.repeat(40)
});
const event=(sequence=1,state='TURN_RUNNING')=>({
  eventVersion:1,dispatchId:'dispatch-1',adapterId:'opencode-v2',
  sessionId:'session-1',turnId:'turn-1',hostGeneration:'generation-1',
  sequence,state,providerEvent:'session.updated',payloadDigest:H('b')
});
const attester=async ({eventDigest,receipt:r})=>({
  source:'TRUSTED_HOST',transportVerified:true,eventDigest,
  scopeHash:r.scopeHash,dispatchId:r.dispatchId
});
const goal=()=>({
  workerProfile:profile(),permissionPolicySha256:H('1'),sandboxPolicySha256:H('2'),
  executable:resolve('trusted-worker.exe'),cwd:resolve('repo'),
  dataDir:resolve('data'),stopFile:resolve('stop'),
  objective:'Read-only audit',acceptance:['Cite files and lines'],
  baseSha:'c'.repeat(40),limits:{maxActiveTasks:2,maxTurnsPerTask:2,wallMinutes:10},coding:null
});

test('profile is strict, bounded, canonical and frozen',()=>{
  const v=normalizeAgentProfile(profile());
  assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.capabilities));
  assert.equal(Object.keys(v.capabilities).length,AGENT_CAPABILITIES.length);
  assert.equal(fingerprintAgentProfile({...profile(),capabilities:{...profile().capabilities}}),
    fingerprintAgentProfile(profile()));
});
test('profile rejects unknown fields, untrusted state, malformed executable and platform',()=>{
  assert.throws(()=>normalizeAgentProfile({...profile(),trusted:true}),/INVALID_AGENT_PROFILE/);
  assert.throws(()=>normalizeAgentProfile({...profile(),executableSha256:'unknown'}),/INVALID_AGENT_PROFILE/);
  assert.throws(()=>normalizeAgentProfile({...profile(),platform:'web'}),/INVALID_AGENT_PROFILE/);
  assert.throws(()=>normalizeAgentProfile({...profile(),adapterContractVersion:2}),/INVALID_AGENT_PROFILE/);
  const p=profile();p.capabilities.submitTurn='ALWAYS_ALLOWED';
  assert.throws(()=>normalizeAgentProfile(p),/INVALID_AGENT_PROFILE/);
  const q=profile();delete q.capabilities.cancelTurn;
  assert.throws(()=>normalizeAgentProfile(q),/INVALID_AGENT_PROFILE/);
});
test('missing or unverified provider capability is never silently promoted',()=>{
  assert.throws(()=>requireAgentCapability(profile(),'workspaceWriteIsolation'),/AGENT_CAPABILITY_NOT_VERIFIED/);
  assert.throws(()=>requireAgentCapability(profile(),'magic'),/UNKNOWN_AGENT_CAPABILITY/);
  assert.equal(requireAgentCapability(profile(),'readOnlyIsolation').profileId,'opencode-readonly');
});
test('backend contract rejects missing methods including cancel and resume',()=>{
  const b=backend();delete b.cancelTurn;
  assert.throws(()=>assertAgentBackendInterface(b),/AGENT_BACKEND_METHOD_MISSING:cancelTurn/);
  assert.equal(assertAgentBackendInterface(backend()).probe instanceof Function,true);
});
test('registry refuses construction without a trusted host callback',()=>{
  assert.throws(()=>new AgentBackendRegistry(),/TRUSTED_AGENT_REGISTRATION_REQUIRED/);
});
test('registry requires exact host binding and rejects self-attested metadata',async()=>{
  const blocked=new AgentBackendRegistry({verifyRegistration:async()=>({trusted:true})});
  await assert.rejects(blocked.register({profile:profile(),backend:backend()}),/AGENT_PROFILE_NOT_ATTESTED/);
  assert.equal(blocked.list().length,0);
});
test('registered profile selection is exact, no automatic fallback or unsafe write',async()=>{
  const approved=new AgentBackendRegistry({verifyRegistration:async ({profile:p,fingerprint})=>({
    source:'TRUSTED_HOST',verified:true,profileId:p.profileId,fingerprint
  })});
  await approved.register({profile:profile(),backend:backend()});
  assert.equal(approved.list().length,1);
  assert.equal(approved.resolve('opencode-readonly','submitTurn').profile.adapterId,'opencode-v2');
  assert.throws(()=>approved.resolve('unknown','submitTurn'),/AGENT_PROFILE_UNAVAILABLE/);
  assert.throws(()=>approved.resolve('opencode-readonly','workspaceWriteIsolation'),/AGENT_CAPABILITY_NOT_VERIFIED/);
  await assert.rejects(approved.register({profile:profile(),backend:backend()}),/AGENT_PROFILE_ALREADY_REGISTERED/);
  await approved.close();assert.equal(approved.list().length,0);
});
test('receipt is correlated with exact host, task, provider, source and scope',()=>{
  const r=normalizeAgentTurnReceipt(receipt(),receipt());
  assert.equal(r.turnId,'turn-1');
  assert.ok(Object.isFrozen(r));
  for(const field of ['taskId','dispatchId','sessionId','profileId','hostGeneration','scopeHash','sourceSha']) {
    assert.throws(()=>normalizeAgentTurnReceipt(receipt(),{[field]:'wrong'}),/AGENT_RECEIPT_SCOPE_MISMATCH/);
  }
});
test('receipt cannot carry model-declared QA or changed identity',()=>{
  assert.throws(()=>normalizeAgentTurnReceipt({...receipt(),qa:'PASS'},receipt()),/INVALID_AGENT_RECEIPT/);
  assert.throws(()=>normalizeAgentTurnReceipt({...receipt(),turnId:''},receipt()),/INVALID_AGENT_RECEIPT/);
  assert.throws(()=>normalizeAgentTurnReceipt(receipt(),{}),/AGENT_RECEIPT_SCOPE_MISMATCH/);
  assert.throws(()=>normalizeAgentTurnReceipt(receipt(),{dispatchId:'dispatch-1'}),/AGENT_RECEIPT_SCOPE_MISMATCH/);
});
test('normalized event binds to accepted receipt not model metadata',()=>{
  const e=normalizeAgentEvent(event(),receipt());
  assert.equal(e.state,'TURN_RUNNING');
  assert.throws(()=>normalizeAgentEvent({...event(),sessionId:'wrong'},receipt()),/AGENT_EVENT_SCOPE_OR_SCHEMA_MISMATCH/);
  assert.throws(()=>normalizeAgentEvent({...event(),payloadDigest:'BAD'},receipt()),/AGENT_EVENT_SCOPE_OR_SCHEMA_MISMATCH/);
  assert.throws(()=>normalizeAgentEvent({...event(),trusted:true},receipt()),/AGENT_EVENT_SCOPE_OR_SCHEMA_MISMATCH/);
});
test('host-attested event still cannot authorize next prompt or QA',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:attester});
  const first=await cursor.observe(event(1,'TURN_RUNNING'));
  assert.deepEqual([first.status,first.qa,first.nextPromptAllowed],['HOST_OBSERVED','NOT_EXECUTED',false]);
  const last=await cursor.observe(event(2,'TURN_COMPLETED'));
  assert.deepEqual([last.status,last.qa,last.nextPromptAllowed],['HOST_OBSERVED','NOT_EXECUTED',false]);
  assert.equal((await cursor.observe(event(3,'TURN_RUNNING'))).status,'RECONCILE_REQUIRED');
});
test('stale sequence and replay do not advance event cursor',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:attester});
  assert.equal((await cursor.observe(event(2))).reason,'AGENT_EVENT_ORDER_OR_REPLAY');
  assert.equal(cursor.nextSequence,1);
  assert.equal((await cursor.observe(event(1))).status,'HOST_OBSERVED');
  assert.equal((await cursor.observe(event(1))).reason,'AGENT_EVENT_ORDER_OR_REPLAY');
});
test('missing host attestation does not advance state',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:async()=>({source:'AGENT_MODEL',transportVerified:true})});
  assert.equal((await cursor.observe(event(1))).reason,'AGENT_EVENT_NOT_ATTESTED');
  assert.equal(cursor.nextSequence,1);
});
test('event must carry same provider, dispatch, host generation and turn',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:attester});
  for(const field of ['adapterId','dispatchId','hostGeneration','turnId']) {
    await assert.rejects(cursor.observe({...event(1),[field]:'other'}),/AGENT_EVENT_SCOPE_OR_SCHEMA_MISMATCH/);
  }
  assert.equal(cursor.nextSequence,1);
});
test('v2 goal fingerprint has separate domain and binds provider + policies',()=>{
  const base=goal();
  const v1=fingerprintGoalRunScope(base);
  const v2=fingerprintAgentGoalScopeV2(base);
  assert.notEqual(v1,v2);
  assert.equal(v2,fingerprintAgentGoalScopeV2(goal()));
  assert.equal(v1,fingerprintGoalRunScope({...base,workerProfile:{...base.workerProfile,adapterId:'another-agent'}}));
  assert.notEqual(v2,fingerprintAgentGoalScopeV2({...base,workerProfile:{...base.workerProfile,adapterId:'another-agent'}}));
  assert.notEqual(v2,fingerprintAgentGoalScopeV2({...base,permissionPolicySha256:H('e')}));
  assert.notEqual(v2,fingerprintAgentGoalScopeV2({...base,sandboxPolicySha256:H('e')}));
  assert.notEqual(v2,fingerprintAgentGoalScopeV2({...base,workerProfile:{...base.workerProfile,executableSha256:H('d')}}));
});
test('v2 goal cannot omit native sandbox/permission binding or smuggle fields',()=>{
  const g=goal();delete g.sandboxPolicySha256;
  assert.throws(()=>fingerprintAgentGoalScopeV2(g),/INVALID_AGENT_GOAL_SCOPE_V2/);
  assert.throws(()=>fingerprintAgentGoalScopeV2({...goal(),approved:true}),/INVALID_AGENT_GOAL_SCOPE_V2/);
  assert.throws(()=>fingerprintAgentGoalScopeV2({...goal(),sourceSha:'bad'}),/INVALID_AGENT_GOAL_SCOPE_V2/);
  const bad=goal();bad.executable='relative.exe';
  assert.throws(()=>fingerprintAgentGoalScopeV2(bad),/INVALID_GOAL_RUN_SCOPE/);
});

test('parallel registrations cannot overwrite an in-flight profile',async()=>{
  let allow;const promise=new Promise(resolve=>allow=resolve);
  const reg=new AgentBackendRegistry({verifyRegistration:async ({profile:p,fingerprint})=>{
    await promise;return {source:'TRUSTED_HOST',verified:true,profileId:p.profileId,fingerprint};
  }});
  const pending=reg.register({profile:profile(),backend:backend()});
  await assert.rejects(reg.register({profile:profile(),backend:backend()}),/AGENT_PROFILE_ALREADY_REGISTERED/);
  allow();await pending;
  assert.equal(reg.list().length,1);
  await reg.close();
});
test('registry closed during host verification cannot reopen',async()=>{
  let allow;const promise=new Promise(resolve=>allow=resolve);
  const reg=new AgentBackendRegistry({verifyRegistration:async ({profile:p,fingerprint})=>{
    await promise;return {source:'TRUSTED_HOST',verified:true,profileId:p.profileId,fingerprint};
  }});
  const pending=reg.register({profile:profile(),backend:backend()});
  await reg.close();allow();
  await assert.rejects(pending,/AGENT_REGISTRY_CLOSED/);
  assert.equal(reg.list().length,0);
});
test('simultaneous provider events cannot both pass host ordering',async()=>{
  let release;const wait=new Promise(resolve=>release=resolve);
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:async input=>{
    await wait;return attester(input);
  }});
  const first=cursor.observe(event(1));
  assert.equal((await cursor.observe(event(1))).reason,'AGENT_EVENT_IN_FLIGHT');
  release();assert.equal((await first).status,'HOST_OBSERVED');
  assert.equal(cursor.nextSequence,2);
});
test('unknown worker outcome must reconcile, never auto-complete',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:attester});
  const observed=await cursor.observe(event(1,'WORKER_DISCONNECTED'));
  assert.equal(observed.status,'RECONCILE_REQUIRED');
  assert.equal(observed.qa,'NOT_EXECUTED');
  assert.equal(observed.nextPromptAllowed,false);
  assert.equal((await cursor.observe(event(2,'TURN_COMPLETED'))).status,'RECONCILE_REQUIRED');
});
test('host attestation exception holds the event without advancing sequence',async()=>{
  const cursor=new AgentEventCursor({receipt:receipt(),expected:receipt(),verifyHostEvent:async()=>{throw Error('offline')}});
  assert.equal((await cursor.observe(event(1))).reason,'AGENT_EVENT_NOT_ATTESTED');
  assert.equal(cursor.nextSequence,1);
});
