import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVerifiedGoalRuntimeWithGitHub} from '../src/prompt/verified-goal-runtime.mjs';

// This checks the new constructor/wiring and rejection gates, not a live
// native host, real storage reconciliation, or an authenticated Codex turn.
const baseDir=join(tmpdir(),'verified-runtime-github-factory');
const paths={registryPath:join(baseDir,'registry.json'),
  outboxPath:join(baseDir,'outbox.json'),
  checkpointPath:join(baseDir,'checkpoint.json'),
  schedulerLeasePath:join(baseDir,'lease')};
const ok=async()=>({});
const host={readGoal:ok,verifyTurn:ok,readIdentity:ok,readResult:ok,
  verifyResult:ok,authorize:ok,verifyReceipt:async()=>({trusted:false})};
const github={scope:{repository:'OpenITStudios/Example',branch:'Local'},token:'test-only-token',
  fetchImpl:async()=>{throw Error('NETWORK_CALL_FORBIDDEN_IN_CONSTRUCTION')}};
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
const runtime=createVerifiedGoalRuntimeWithGitHub({paths,host,github});
eq(Object.isFrozen(runtime),true,'host composition is immutable');
eq(typeof runtime.reconcile,'function','reconcile callable');
eq(typeof runtime.recover,'function','recover callable');
const invalid=await runtime.reconcile({workspaceId:'workspace-11'});
eq(invalid.status,'BLOCKED','wrong workspace never reaches any native host');
eq(invalid.reason,'INVALID_WORKSPACE_ID','wrong workspace reason explicit');
eq(invalid.nextPromptAllowed,false,'never grants dispatch');
const wrongRecovery=await runtime.recover({workspaceId:'workspace-11'});
eq(wrongRecovery.reason,'INVALID_WORKSPACE_ID','wrong recovery blocked');
for(const addition of [
 {sourceFactory:ok},{receiptFactory:ok},{readHead:ok},{verifyReceipt:'not a native callback'},
 {unknown:ok}
 ]){
 assert.throws(()=>createVerifiedGoalRuntimeWithGitHub({paths,host:{...host,...addition},github}),
 /TRUSTED_SCOPED_GOAL_HOST_REQUIRED/);checks++;
}
for(const addition of [{unexpected:ok},{verifyReceipt:ok}]){
 assert.throws(()=>createVerifiedGoalRuntimeWithGitHub({paths,host,github:{...github,...addition}}),
 /TRUSTED_SCOPED_GITHUB_CONFIG_REQUIRED/);checks++;
}
assert.throws(()=>createVerifiedGoalRuntimeWithGitHub({paths,host:{readGoal:ok},github}),
 /TRUSTED_SCOPED_GOAL_HOST_REQUIRED/);checks++;
assert.throws(()=>createVerifiedGoalRuntimeWithGitHub({paths,host,
 github:{scope:{repository:'Other',branch:'Local'},token:'token'}}));checks++;
assert.throws(()=>createVerifiedGoalRuntimeWithGitHub({paths:{...paths,registryPath:paths.outboxPath},host,github}),
 /GOAL_RUNTIME_STORAGE_COLLISION/);checks++;
console.log('Verified goal runtime GitHub wiring: PASS ('+checks+
 ' assertions; real constructor logic, test-only dependency stubs)');
