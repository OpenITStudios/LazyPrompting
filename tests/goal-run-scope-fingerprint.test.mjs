import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runReadOnlyGoal} from '../src/transport/goal-codex-runner.mjs';
import {fingerprintGoalRunScope} from '../src/transport/goal-run-scope.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';

function config(root) {
 return {executable:join(root,'codex'),cwd:root,dataDir:join(root,'run'),
  objective:'Keep original authorized objective',acceptance:['Verify UV'],baseSha:'a'.repeat(40),
  limits:{maxActiveTasks:1,maxTurnsPerTask:2,wallMinutes:5},stopFile:join(root,'STOP')};
}
async function createUncertain(root) {
 const base=config(root);
 let sends=0;
 const fake={initialize:async()=>{},close:async()=>{},ensureThread:async()=>{},
  startThread:async()=>({thread:{id:'thread-01'}}),
  startTurn:async()=>{sends++;throw Error('DISCONNECTED_AFTER_SIDE_EFFECT');}};
 const result=await runReadOnlyGoal(base,{newServer:()=>fake,resolveOptions:async()=>[]});
 assert.equal(result.state,'NEEDS_ATTENTION');
 assert.equal(sends,1);
 assert.equal(result.scopeFingerprintVersion,1);
 assert.equal(result.scopeFingerprint,fingerprintGoalRunScope(base));
 const outbox=new PromptOutbox(join(base.dataDir,'task-1.json'));
 assert.equal((await outbox.pending('task-1')).length,1);
 return base;
}

test('immutable scope fingerprint determinism including coding and STOP',()=>{
 const c=config(join(tmpdir(),'lp-scope'));
 const h=fingerprintGoalRunScope(c);
 assert.match(h,/^[a-f0-9]{64}$/);
 assert.equal(fingerprintGoalRunScope({...c,limits:{wallMinutes:5,maxTurnsPerTask:2,maxActiveTasks:1}}),h);
 for(const change of [
  {objective:'different objective'}, {acceptance:['Change UV']},
  {stopFile:join(c.cwd,'OTHER_STOP')}, {executable:process.execPath},
  {cwd:join(c.cwd,'other')}, {dataDir:join(c.cwd,'another-run')},
  {baseSha:'b'.repeat(40)}, {limits:{...c.limits,wallMinutes:6}},
  {limits:{...c.limits,maxTurnsPerTask:3}},
 ]) assert.notEqual(fingerprintGoalRunScope({...c,...change}),h);
 const coding={git:join(c.cwd,'git.exe'),root:join(c.cwd,'worktrees'),
  tasks:[{files:['src/uv.mjs'],verify:[process.execPath,'--test','tests/uv.test.mjs']}]};
 const ch=fingerprintGoalRunScope({...c,coding});
 assert.notEqual(ch,h);
 assert.notEqual(fingerprintGoalRunScope({...c,coding:{...coding,root:join(c.cwd,'other')}}),ch);
 assert.notEqual(fingerprintGoalRunScope({...c,coding:{...coding,tasks:[{...coding.tasks[0],files:['src/unsafe.mjs']}]}}),ch);
 assert.notEqual(fingerprintGoalRunScope({...c,coding:{...coding,tasks:[{...coding.tasks[0],verify:[process.execPath,'--test','tests/unsafe.test.mjs']}]}}),ch);
 assert.throws(()=>fingerprintGoalRunScope({...c,coding:{...coding,unsafe:true}}),/INVALID_GOAL_RUN_SCOPE/);
});

test('no resumed turn may reinterpret original approved goal, STOP, paths or budget',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lp-scope-binding-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const base=await createUncertain(root),reportPath=join(base.dataDir,'report.json');
 const unchanged=await readFile(reportPath,'utf8');
 for(const change of [
  {objective:'New unauthorized goal'}, {acceptance:['Verify different code']},
  {stopFile:join(root,'BYPASS_STOP')}, {executable:join(root,'other-codex')},
  {cwd:join(root,'other-repository')}, {baseSha:'b'.repeat(40)},
  {limits:{...base.limits,maxActiveTasks:2}},
  {limits:{...base.limits,maxTurnsPerTask:1}},
  {limits:{...base.limits,wallMinutes:30}},
  {coding:{git:join(root,'git.exe'),root:join(root,'worktrees'),
    tasks:[{files:['src/uv.mjs'],verify:[process.execPath,'--test','tests/uv.test.mjs']}]}},
 ]){
  let invoked=false;
  await assert.rejects(runReadOnlyGoal({...base,...change,resume:true},
   {newServer:()=>{invoked=true;throw Error('SHOULD_NOT_START')},resolveOptions:async()=>[]}),
   /GOAL_SCOPE_RECONCILE_REQUIRED/);
  assert.equal(invoked,false);
  assert.equal(await readFile(reportPath,'utf8'),unchanged);
 }
 const outbox=new PromptOutbox(join(base.dataDir,'task-1.json'));
 const pending=await outbox.pending('task-1');
 assert.equal(pending.length,1);
 assert.equal(pending[0].state,'RESERVED');
});

test('legacy or copied checkpoints remain untouched and require operator review',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lp-legacy-scope-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const base=await createUncertain(root),path=join(base.dataDir,'report.json');
 const state=JSON.parse(await readFile(path,'utf8'));
 delete state.scopeFingerprintVersion;delete state.scopeFingerprint;
 const legacy=JSON.stringify(state);
 await writeFile(path,legacy);
 await assert.rejects(runReadOnlyGoal({...base,resume:true},
  {newServer:()=>{throw Error('SHOULD_NOT_START')},resolveOptions:async()=>[]}),
  /GOAL_SCOPE_RECONCILE_REQUIRED/);
 assert.equal(await readFile(path,'utf8'),legacy);
 const copied=join(root,'copied');await mkdir(copied);
 await copyFile(path,join(copied,'report.json'));
 await assert.rejects(runReadOnlyGoal({...base,dataDir:copied,resume:true},
  {newServer:()=>{throw Error('SHOULD_NOT_START')},resolveOptions:async()=>[]}),
  /GOAL_SCOPE_RECONCILE_REQUIRED/);
});

test('original authorized scope still holds uncertain delivery without a resend',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lp-same-scope-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const base=await createUncertain(root);
 let sent=0;
 const fake={initialize:async()=>{},close:async()=>{},ensureThread:async()=>{},
  startTurn:async()=>{sent++;throw Error('UNEXPECTED_REPLAY')},
  listRecentTurns:async()=>{sent++;return {data:[]}}};
 const resumed=await runReadOnlyGoal({...base,resume:true,hostEpoch:'restarted'},
  {newServer:()=>fake,resolveOptions:async()=>[]});
 assert.equal(resumed.state,'NEEDS_ATTENTION');
 assert.equal(resumed.tasks[0].state,'RECONCILE_REQUIRED');
 assert.equal(sent,0);
 assert.equal(resumed.scopeFingerprint,fingerprintGoalRunScope(base));
});


test('a valid checkpoint copied to a different data directory is not a valid replay',async t=>{
 const root=await mkdtemp(join(tmpdir(),'lp-relocated-scope-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const original=await createUncertain(root);
 const copied=join(root,'different-run');await mkdir(copied);
 const source=join(original.dataDir,'report.json');
 const before=await readFile(source,'utf8');
 await copyFile(source,join(copied,'report.json'));
 await assert.rejects(runReadOnlyGoal({...original,dataDir:copied,resume:true},
  {newServer:()=>{throw Error('SHOULD_NOT_START')},resolveOptions:async()=>[]}),
  /GOAL_SCOPE_RECONCILE_REQUIRED/);
 assert.equal(await readFile(join(copied,'report.json'),'utf8'),before);
});
