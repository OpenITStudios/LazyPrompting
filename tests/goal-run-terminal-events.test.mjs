import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runReadOnlyGoal} from '../src/transport/goal-codex-runner.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';

// No CLI, model, browser, network or writable worktree is started.
// This tests the real read-only goal runner using an injected Codex App Server.
for (const [name,notifications,expected,taskState] of [
  ['matching completed event', ['completed'], 'EVENT_AND_QUERY_CORRELATED', 'REVIEWED'],
  ['no event / query-only recovery', [], 'TURN_STATUS_QUERY_ONLY', 'REVIEWED'],
  ['event from different thread', ['other-thread'], 'TURN_STATUS_QUERY_ONLY', 'REVIEWED'],
  ['conflicting terminal event', ['failed','completed'], null, 'RECONCILE_REQUIRED'],
  ['unexpected completion status', ['inProgress'], null, 'RECONCILE_REQUIRED'],
  ['failed completion event', ['failed'], null, 'RECONCILE_REQUIRED']
]) {
  test(name, async t => {
    const cwd=await mkdtemp(join(tmpdir(),'lp-goal-terminal-'));
    t.after(()=>rm(cwd,{recursive:true,force:true}));
    const dataDir=join(cwd,'goal');
    let onEvent;
    const server={
      async initialize(){},async close(){},async ensureThread(){},
      async startThread(){return {thread:{id:'thread-01'}};},
      async startTurn(){
        for(const notification of notifications) onEvent({method:'turn/completed',params:{
          threadId:notification==='other-thread'?'thread-other':'thread-01',
          turn:{id:'turn-01',status:notification==='other-thread'?'completed':notification}
        }});
        return {turn:{id:'turn-01'}};
      },
      async listRecentTurns(){return {data:[{id:'turn-01',status:'completed'}]};},
      async listRecentTurnItems(){return {data:[{turnId:'turn-01',item:{type:'agentMessage',text:'Evidence summary'}}]};}
    };
    const report=await runReadOnlyGoal({
      executable:join(cwd,'codex'),cwd,dataDir,stopFile:join(cwd,'STOP'),
      objective:'Inspect a module',acceptance:['Check UV'],baseSha:'a'.repeat(40),
      limits:{maxActiveTasks:1,maxTurnsPerTask:1,wallMinutes:1}
    },{resolveOptions:async()=>[],newServer:opts=>{onEvent=opts.onEvent;return server;}});
    assert.equal(report.tasks[0].state,taskState);
    assert.equal(report.tasks[0].turns.length,expected?1:0);
    if(expected){
      assert.equal(report.tasks[0].turns[0].terminalObservation.kind,expected);
      assert.equal(report.tasks[0].turns[0].terminalObservation.hostAttested,false);
    }else{
      assert.equal(report.state,'NEEDS_ATTENTION');
      assert.equal(report.tasks[0].reason,'GOAL_TURN_TERMINAL_EVENT_CONFLICT');
      const outbox=new PromptOutbox(join(dataDir,'task-1.json'));
      assert.equal((await outbox.pending('task-1')).length,1);
      // A persisted terminal conflict must not be downgraded to the
      // query-only fallback when the host restarts and loses events.
      let attempted=0;
      const recovered=await runReadOnlyGoal({
        executable:join(cwd,'codex'),cwd,dataDir,stopFile:join(cwd,'STOP'),
        objective:'Inspect a module',acceptance:['Check UV'],baseSha:'a'.repeat(40),
        limits:{maxActiveTasks:1,maxTurnsPerTask:1,wallMinutes:1},resume:true,
        hostEpoch:'recovered-host'
      },{resolveOptions:async()=>[],newServer:()=>({
        initialize:async()=>{},close:async()=>{},
        startTurn:async()=>{attempted++;throw Error('RETRY_FORBIDDEN');},
        listRecentTurns:async()=>{attempted++;return {data:[{id:'turn-01',status:'completed'}]};}
      })});
      assert.equal(recovered.state,'NEEDS_ATTENTION');
      assert.equal(recovered.tasks[0].state,'RECONCILE_REQUIRED');
      assert.equal(recovered.tasks[0].reason,'GOAL_TURN_TERMINAL_EVENT_CONFLICT');
      assert.equal(attempted,0);
      assert.equal((await outbox.pending('task-1')).length,1);
    }
  });
}

// Two simultaneous read-only Codex workspaces must retain thread/turn identity.
test('two concurrent tasks preserve terminal-event isolation', async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'lp-goal-parallel-'));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  let next=0,onEvent;
  const server={
    async initialize(){},async close(){},async ensureThread(){},
    async startThread(){return {thread:{id:'thread-'+(++next)}};},
    async startTurn(thread){
      const id='turn-'+thread;
      onEvent({method:'turn/completed',params:{threadId:thread,turn:{id,status:'completed'}}});
      return {turn:{id}};
    },
    async listRecentTurns(thread){return {data:[{id:'turn-'+thread,status:'completed'}]};},
    async listRecentTurnItems(thread){return {data:[{turnId:'turn-'+thread,item:{type:'agentMessage',text:'Result '+thread}}]};}
  };
  const report=await runReadOnlyGoal({
    executable:join(cwd,'codex'),cwd,dataDir:join(cwd,'goal'),stopFile:join(cwd,'STOP'),
    objective:'Inspect two files',acceptance:['Check UV','Check Rust'],baseSha:'a'.repeat(40),
    limits:{maxActiveTasks:2,maxTurnsPerTask:1,wallMinutes:1}
  },{resolveOptions:async()=>[],newServer:options=>{onEvent=options.onEvent;return server;}});
  assert.equal(report.state,'REVIEW_COMPLETE');
  assert.equal(report.tasks.length,2);
  const threadIds=report.tasks.map(task=>task.threadId);
  assert.equal(new Set(threadIds).size,2);
  for(const task of report.tasks){
    assert.equal(task.state,'REVIEWED');
    assert.equal(task.turns.length,1);
    assert.equal(task.turns[0].turnId,'turn-'+task.threadId);
    assert.equal(task.turns[0].terminalObservation.kind,'EVENT_AND_QUERY_CORRELATED');
    assert.equal(task.turns[0].terminalObservation.hostAttested,false);
    const outbox=new PromptOutbox(join(cwd,'goal',task.id+'.json'));
    assert.equal((await outbox.pending(task.id)).length,0);
  }
});
