import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runReadOnlyGoal} from '../src/transport/goal-codex-runner.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';
const params=root=>({executable:join(root,'codex'),cwd:root,dataDir:join(root,'run'),
  stopFile:join(root,'STOP'),objective:'Review source',acceptance:['UV analysis'],
  baseSha:'a'.repeat(40),limits:{maxActiveTasks:1,maxTurnsPerTask:2,wallMinutes:1}});
const mock=({onResponse=null,interrupts=[],starts=[]}={})=>({
  async initialize(){},async close(){},async ensureThread(id){assert.equal(id,'thread-01')},
  async startThread(){return {thread:{id:'thread-01'}}},
  async startTurn(id,prompt){const turn='turn-'+(starts.length+1); starts.push({id,prompt,turn});return {turn:{id:turn}}},
  async listRecentTurns(id){return {data:starts.map(s=>({id:s.turn,status:'completed'}))}},
  async listRecentTurnItems(id,turn){await onResponse?.(turn);return {data:[{turnId:turn,item:{type:'agentMessage',text:'Verified text '+turn}}]}},
  async interruptTurn(id,turn){interrupts.push({id,turn})}
});

test('requested pause permits ACKed turn to complete but blocks follow-up; authorized resume does not replay',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp-pause-complete-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=params(root),pauseFile=input.stopFile+'.pause',starts=[];
  const first=await runReadOnlyGoal(input,{resolveOptions:async()=>[],newServer:()=>mock({starts,
    onResponse:async turn=>{if(turn==='turn-1')await writeFile(pauseFile,'paused')}})});
  assert.equal(first.state,'PAUSED');assert.equal(first.tasks[0].state,'PAUSED');
  assert.deepEqual(first.tasks[0].turns.map(x=>x.turnId),['turn-1']);
  assert.equal(starts.length,1);
  const outbox=new PromptOutbox(join(input.dataDir,'task-1.json'));
  assert.equal((await outbox.pending('task-1')).length,0);
  await rm(pauseFile);
  const second=await runReadOnlyGoal({...input,resume:true,hostEpoch:'resumed'},
    {resolveOptions:async()=>[],newServer:()=>mock({starts})});
  assert.equal(second.state,'REVIEW_COMPLETE');
  assert.equal(starts.length,2);
  assert.deepEqual(second.tasks[0].turns.map(x=>x.turnId),['turn-1','turn-2']);
  assert.equal((await outbox.read()).items.length,2);
  assert.deepEqual(await outbox.pending('task-1'),[]);
});

test('pause flag before startup creates no Codex process or turn',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp-pause-start-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=params(root);await writeFile(input.stopFile+'.pause','paused');let servers=0;
  const first=await runReadOnlyGoal(input,{resolveOptions:async()=>[],newServer:()=>{servers++;throw Error('SHOULD_NOT_START')}});
  assert.equal(first.state,'PAUSED');assert.equal(servers,0);
  assert.equal(first.tasks[0].state,'QUEUED');
  await rm(input.stopFile+'.pause');const starts=[];
  const second=await runReadOnlyGoal({...input,resume:true},{resolveOptions:async()=>[],newServer:()=>mock({starts})});
  assert.equal(second.state,'REVIEW_COMPLETE');assert.equal(starts.length,2);
});

test('STOP is authoritative when both STOP and pause are present',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp-pause-stop-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=params(root);await writeFile(input.stopFile,'stopped');await writeFile(input.stopFile+'.pause','paused');
  let started=false;const result=await runReadOnlyGoal(input,{resolveOptions:async()=>[],newServer:()=>{started=true;throw Error('SHOULD_NOT_START')}});
  assert.equal(result.state,'STOPPED');assert.equal(started,false);
  await assert.rejects(()=>runReadOnlyGoal({...input,resume:true},{resolveOptions:async()=>[],newServer:()=>mock()}),/GOAL_ALREADY_TERMINAL/);
});

test('pause requested while response streaming is reconciled, not interrupted or blindly sent again',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp-pause-stream-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=params(root),pauseFile=input.stopFile+'.pause',starts=[],interrupts=[];let polls=0;
  const server=mock({starts,interrupts});
  server.listRecentTurns=async()=>{polls++;
    if(polls===1){await writeFile(pauseFile,'paused');return {data:[{id:'turn-1',status:'inProgress'}]}}
    return {data:[{id:'turn-1',status:'completed'}]};
  };
  const result=await runReadOnlyGoal(input,{resolveOptions:async()=>[],newServer:()=>server});
  assert.equal(result.state,'PAUSED');assert.equal(result.tasks[0].turns.length,1);
  assert.equal(starts.length,1);assert.deepEqual(interrupts,[]);
  const outbox=new PromptOutbox(join(input.dataDir,'task-1.json'));
  assert.deepEqual(await outbox.pending('task-1'),[]);
});

test('STOP during in-flight turn overrides pause and requests interruption',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp-pause-stop-stream-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=params(root),starts=[],interrupts=[];let polls=0;
  const server=mock({starts,interrupts});
  server.listRecentTurns=async()=>{polls++;
    if(polls===1){await writeFile(input.stopFile+'.pause','paused');await writeFile(input.stopFile,'stopped');
      return {data:[{id:'turn-1',status:'inProgress'}]}}
    return {data:[{id:'turn-1',status:'completed'}]};
  };
  const result=await runReadOnlyGoal(input,{resolveOptions:async()=>[],newServer:()=>server});
  assert.equal(result.state,'STOPPED');assert.equal(result.tasks[0].state,'STOPPED');
  assert.equal(starts.length,1);
  assert.deepEqual(interrupts,[{id:'thread-01',turn:'turn-1'}]);
  const outbox=new PromptOutbox(join(input.dataDir,'task-1.json'));
  assert.equal((await outbox.pending('task-1')).length,1);
});
