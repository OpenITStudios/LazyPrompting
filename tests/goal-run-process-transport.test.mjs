import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runReadOnlyGoal} from '../src/transport/goal-codex-runner.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';

// Owned, synthetic Codex App Server process, driven over actual stdio.
// No account, network, model, browser, worktree or external commands.
// process.execPath executes <cwd>/app-server with the same argv shape that
// CodexAppServer's production transport uses for a real Codex CLI binary.
const fakeSource=mode=>String.raw`
import readline from 'node:readline';
const mode=${JSON.stringify(mode)};
let nextThread=0;
const turns=new Map();
const respond=(id,result)=>process.stdout.write(JSON.stringify({id,result})+'\n');
const notify=(threadId,turnId,status)=>process.stdout.write(JSON.stringify({
  method:'turn/completed',params:{threadId,turn:{id:turnId,status}}
})+'\n');
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
  let msg;try{msg=JSON.parse(line)}catch{process.exit(4)}
  const id=msg.id,method=msg.method,params=msg.params;
  if(method==='initialized')continue;
  if(method==='initialize'){respond(id,{serverInfo:'synthetic-only'});continue;}
  if(method==='thread/start'){
    if(params.sandbox!=='read-only'||params.approvalPolicy!=='never')process.exit(7);
    respond(id,{thread:{id:'thread-'+(++nextThread),status:{type:'idle'}}});continue;
  }
  if(method==='thread/resume'){
    respond(id,{thread:{id:params.threadId,status:{type:'idle'}}});continue;
  }
  if(method==='turn/start'){
    const turnId='turn-'+params.threadId;
    turns.set(params.threadId,turnId);
    if(mode==='disconnect')process.exit(9);
    if(mode==='early')notify(params.threadId,turnId,'completed');
    if(mode==='failed-event'){notify(params.threadId,turnId,'failed');notify(params.threadId,turnId,'completed');}
    if(mode==='unknown-event')notify(params.threadId,turnId,'inProgress');
    if(mode==='wrong-thread')notify('thread-other',turnId,'completed');
    respond(id,{turn:{id:turnId,status:'inProgress'}});continue;
  }
  if(method==='thread/turns/list'){
    const turnId=turns.get(params.threadId);
    if(mode==='late')notify(params.threadId,turnId,'completed');
    respond(id,{data:[{id:turnId,status:'completed'}]});continue;
  }
  if(method==='thread/items/list'){
    respond(id,{data:[{turnId:params.turnId,item:{type:'agentMessage',text:'Synthetic exact turn result'}}]});continue;
  }
  if(method==='turn/interrupt'){respond(id,{});continue;}
  respond(id,{});
}
`;

async function runFixture(mode,{concurrent=false,resume=false,dataDir=null,cwd=null}={}){
  const root=cwd??await mkdtemp(join(tmpdir(),'lp-codex-stdio-'));
  await writeFile(join(root,'app-server'),fakeSource(mode));
  const outputDir=dataDir??join(root,'run');
  const report=await runReadOnlyGoal({
    executable:process.execPath,cwd:root,dataDir:outputDir,
    stopFile:join(root,'STOP'),objective:'Review synthetic project',
    acceptance:concurrent?['Review UV','Review Rust']:['Review UV'],
    baseSha:'a'.repeat(40),
    limits:{maxActiveTasks:concurrent?2:1,maxTurnsPerTask:1,wallMinutes:1},
    resume,hostEpoch:resume?'host-restarted':'host-initial'
  },{resolveOptions:async()=>[]});
  return {report,root,outputDir,cleanup:()=>rm(root,{recursive:true,force:true})};
}

for(const [mode,expected] of [
  ['early','EVENT_AND_QUERY_CORRELATED'],
  ['late','EVENT_AND_QUERY_CORRELATED'],
  ['none','TURN_STATUS_QUERY_ONLY'],
  ['wrong-thread','TURN_STATUS_QUERY_ONLY']
]){
 test('real stdio transport '+mode,async()=>{
   const result=await runFixture(mode);
   try{
     assert.equal(result.report.state,'REVIEW_COMPLETE');
     assert.equal(result.report.tasks[0].state,'REVIEWED');
     const [turn]=result.report.tasks[0].turns;
     assert.equal(turn.terminalObservation.kind,expected);
     assert.equal(turn.terminalObservation.hostAttested,false);
     const outbox=new PromptOutbox(join(result.outputDir,'task-1.json'));
     assert.equal((await outbox.pending('task-1')).length,0);
     assert.equal((await outbox.read()).items[0].responseHandle,turn.turnId);
   }finally{await result.cleanup()}
 });
}
for(const mode of ['failed-event','unknown-event']){
 test('real stdio transport conflict '+mode+' survives restart',async()=>{
   const r=await runFixture(mode);
   try{
     assert.equal(r.report.state,'NEEDS_ATTENTION');
     assert.equal(r.report.tasks[0].state,'RECONCILE_REQUIRED');
     assert.equal(r.report.tasks[0].reason,'GOAL_TURN_TERMINAL_EVENT_CONFLICT');
     const prior=JSON.parse(await readFile(join(r.outputDir,'report.json'),'utf8'));
     const recovered=await runFixture('none',{resume:true,cwd:r.root,dataDir:r.outputDir});
     assert.equal(recovered.report.tasks[0].state,'RECONCILE_REQUIRED');
     assert.equal(recovered.report.tasks[0].reason,'GOAL_TURN_TERMINAL_EVENT_CONFLICT');
     assert.equal(recovered.report.tasks[0].turns.length,0);
     assert.ok(recovered.report.revision>prior.revision);
     const outbox=new PromptOutbox(join(r.outputDir,'task-1.json'));
     assert.equal((await outbox.pending('task-1')).length,1);
   }finally{await r.cleanup()}
 });
}
test('real stdio transport task isolation',async()=>{
  const r=await runFixture('early',{concurrent:true});
  try{
    assert.equal(r.report.state,'REVIEW_COMPLETE');
    assert.equal(new Set(r.report.tasks.map(t=>t.threadId)).size,2);
    for(const task of r.report.tasks){
      assert.equal(task.turns[0].terminalObservation.kind,'EVENT_AND_QUERY_CORRELATED');
      assert.equal(task.turns[0].terminalObservation.threadId,task.threadId);
      assert.equal(task.turns[0].turnId,'turn-'+task.threadId);
    }
  }finally{await r.cleanup()}
});
test('real stdio transport disconnect after turn/start fails closed',async()=>{
  const r=await runFixture('disconnect');
  try{
    assert.equal(r.report.state,'NEEDS_ATTENTION');
    assert.equal(r.report.tasks[0].state,'RECONCILE_REQUIRED');
    const outbox=new PromptOutbox(join(r.outputDir,'task-1.json'));
    assert.equal((await outbox.pending('task-1')).length,1);
    assert.equal(r.report.tasks[0].turns.length,0);
  }finally{await r.cleanup()}
});

test('unknown turn-start delivery is never blindly resent on process restart',async()=>{
  const r=await runFixture('disconnect');
  try{
    const outbox=new PromptOutbox(join(r.outputDir,'task-1.json'));
    const before=await outbox.pending('task-1');
    assert.equal(before.length,1);
    assert.equal(before[0].state,'RESERVED');
    const restarted=await runFixture('early',{resume:true,cwd:r.root,dataDir:r.outputDir});
    assert.equal(restarted.report.state,'NEEDS_ATTENTION');
    assert.equal(restarted.report.tasks[0].state,'RECONCILE_REQUIRED');
    assert.equal(restarted.report.tasks[0].turns.length,0);
    const after=await outbox.pending('task-1');
    assert.deepEqual(after,before);
  }finally{await r.cleanup()}
});
