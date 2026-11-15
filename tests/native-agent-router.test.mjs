import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {AgentRunControllerV2} from '../src/agent/agent-run-controller.mjs';
import {NativeAgentRequestRouter} from '../src/agent/native-agent-request-router.mjs';
import {fingerprintAgentGoalScopeV2} from '../src/agent/goal-scope-v2.mjs';
import {AGENT_CAPABILITIES} from '../src/agent/agent-contract.mjs';

const H=c=>c.repeat(64);
const runId='12345678-1234-1234-1234-123456789abc.'+H('a').slice(0,32);
const goalId='12345678-1234-1234-1234-123456789abc';
const profile={
  profileId:'codex-local',adapterId:'codex-app-server',
  adapterContractVersion:1,runtimeVersion:'1.0.0',
  executableSha256:H('a'),platform:process.platform,
  capabilities:Object.fromEntries(AGENT_CAPABILITIES.map(x=>[x,'UNKNOWN']))
};
const scope={
  workerProfile:profile,permissionPolicySha256:H('b'),
  sandboxPolicySha256:H('c'),executable:resolve('worker.exe'),
  cwd:resolve('repo'),dataDir:resolve('data'),stopFile:resolve('stop'),
  objective:'Read-only review',acceptance:['Review source'],
  baseSha:'d'.repeat(40),limits:{maxActiveTasks:1,maxTurnsPerTask:1,wallMinutes:10},
  coding:null
};
function harness(patch={}){
  const r=new NativeAgentRequestRouter();
  let reads=0,authorizations=0;
  const bound={source:'TRUSTED_HOST',schemaVersion:2,approved:true,
    runId,goalId,workspaceId:'workspace-01',taskId:'task-1',
    scope,scopeHash:fingerprintAgentGoalScopeV2(scope),prompt:'Review source'};
  const allow={source:'TRUSTED_HOST',schemaVersion:3,approved:true,admitted:true,
    runId,action:'start',scopeHash:bound.scopeHash,goalId,
    workspaceId:'workspace-01',taskId:'task-1',sourceSha:scope.baseSha,
    workerProfileId:profile.profileId,executableSha256:profile.executableSha256,
    permissionPolicySha256:scope.permissionPolicySha256,
    sandboxPolicySha256:scope.sandboxPolicySha256,osSandboxVerified:true,
    reservationOwner:'PROMPT_OUTBOX',qa:'NOT_EXECUTED',nextPromptAllowed:false};
  // This prototype-only instance passes the router's type check but cannot
  // execute any private method; every fixture MUST stop at preflight.
  const controller=Object.create(AgentRunControllerV2.prototype);
  r.bind({controller,
    readApprovedRun:async()=>{reads++;return bound;},
    authorizeAction:async()=>{authorizations++;return {...allow,...patch};}});
  return {router:r,calls:()=>({reads,authorizations})};
}
test('source-only action is denied without an attached native controller',async()=>{
  const r=new NativeAgentRequestRouter();
  assert.equal((await r.handle({action:'start',runId})).reason,'NATIVE_AGENT_RUNTIME_NOT_BOUND');
  assert.equal(r.status().workerExecutionReady,false);
});
test('private router refuses public-scope fields before native callbacks',async()=>{
  const h=harness();
  assert.equal((await h.router.handle({action:'start',runId,approved:true})).reason,
    'INVALID_NATIVE_AGENT_REQUEST');
  assert.deepEqual(h.calls(),{reads:0,authorizations:0});
});
test('legacy approved:true and invented sandbox completion never admit effects',async()=>{
  for(const patch of [
    {schemaVersion:2},{admitted:false},{osSandboxVerified:false},
    {reservationOwner:'SESSION_MEMORY'},{qa:'PASS'},{nextPromptAllowed:true},
    {scopeHash:H('f')},{sourceSha:'f'.repeat(40)},
    {executableSha256:H('f')},{permissionPolicySha256:H('f')},
    {sandboxPolicySha256:H('f')},{action:'cancel'}
  ]){
    const h=harness(patch);
    const result=await h.router.handle({action:'start',runId});
    assert.equal(result.reason,'NATIVE_AGENT_ACTION_NOT_AUTHORIZED',
      JSON.stringify(patch));
    assert.equal(result.qa,'NOT_EXECUTED');
    assert.equal(result.nextPromptAllowed,false);
    assert.deepEqual(h.calls(),{reads:1,authorizations:1});
  }
});
test('a native source revision change is denied before action authorization',async()=>{
  const h=harness();
  assert.equal((await h.router.handle({action:'observe',runId,extra:1})).reason,
    'INVALID_NATIVE_AGENT_REQUEST');
});
