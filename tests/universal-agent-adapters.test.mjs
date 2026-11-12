import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {parseOpenCodeJsonl} from '../src/agent/adapters/opencode-jsonl.mjs';
import {OpenCodeCliReadOnlyBackend} from '../src/agent/adapters/opencode-cli-readonly-backend.mjs';
import {CodexAppServerBackend} from '../src/agent/adapters/codex-app-server-backend.mjs';
const H=c=>c.repeat(64),cwd=resolve('repo'),executable=resolve('test.exe');
const sessionId='ses_abcdef123';
const jsonl=(events)=>events.map(x=>JSON.stringify({sessionID:sessionId,...x})).join('\n')+'\n';
const completed=()=>jsonl([
 {type:'step_start',part:{type:'step-start'}},
 {type:'tool_use',part:{tool:'read',state:{status:'completed'}}},
 {type:'text',part:{messageID:'msg_123456',type:'text',text:'Source reviewed'}},
 {type:'step_finish',part:{reason:'stop'}}
]);
const opencodeHost=(options={})=>({
 async attestReadOnlyHost({scopeHash}){return {source:'TRUSTED_HOST',verified:true,
   sandboxVerified:options.sandbox!==false,scopeHash,runtimeVersion:'2.2.3'}},
 async createSession(){return {sessionId}},
 async resumeSession(){return {source:'TRUSTED_HOST',verified:true,sessionId}},
 async runIsolated(request){options.calls?.push(request);return {exitCode:0,stdout:options.stdout??completed()}},
 async reconcileTurn(request){return {source:'TRUSTED_HOST',verified:true,
   sessionId:request.sessionId,turnId:request.turnId,scopeHash:request.scopeHash,
   state:'COMPLETED',resultRef:request.turnId}},
 async interrupt(){return {source:'TRUSTED_HOST',confirmed:true}},
 async close(){}
});
const opencode=host=>new OpenCodeCliReadOnlyBackend({executable,cwd,host});
const receipt=(turnId='msg_123456')=>({sessionId,turnId,scopeHash:H('a')});
test('OpenCode JSONL requires a terminal stop event and text on exact session',()=>{
 const result=parseOpenCodeJsonl(completed(),{sessionId,exitCode:0});
 assert.equal(result.state,'COMPLETED');assert.equal(result.turnId,'msg_123456');
 assert.equal(parseOpenCodeJsonl(jsonl([
  {type:'step_start'},{type:'text',part:{messageID:'msg_x',text:'ok'}}]),
  {sessionId,exitCode:0}).state,'UNKNOWN');
});
test('OpenCode JSONL rejects unapproved tools, foreign session and malformed frames',()=>{
 const evil=completed().replace('"tool":"read"','"tool":"shell"');
 assert.equal(parseOpenCodeJsonl(evil,{sessionId,exitCode:0}).reason,'OPENCODE_UNVERIFIED_TOOL_USE');
 assert.equal(parseOpenCodeJsonl(completed().replaceAll(sessionId,'ses_foreign'),
  {sessionId,exitCode:0}).reason,'OPENCODE_JSONL_SESSION_CONFLICT');
 assert.equal(parseOpenCodeJsonl('{broken', {sessionId,exitCode:0}).reason,'OPENCODE_JSONL_MALFORMED');
 assert.equal(parseOpenCodeJsonl(completed(),{sessionId,exitCode:1}).state,'FAILED');
});
test('OpenCode adapter refuses unverified OS sandbox before creating session',async()=>{
 const a=opencode(opencodeHost({sandbox:false}));
 await assert.rejects(a.openSession({cwd,scopeHash:H('a'),readOnly:true}),
   /OPENCODE_NATIVE_SANDBOX_UNVERIFIED/);
 await a.close();
});
test('OpenCode adapter constructs fixed noninteractive argv under host isolation',async()=>{
 const calls=[],a=opencode(opencodeHost({calls}));
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 const turn=await a.submitTurn({sessionId,prompt:'Review source',scopeHash:H('a'),readOnly:true});
 assert.equal(turn.turnId,'msg_123456');
 assert.deepEqual(calls[0].args,['run','--standalone','--format','json','--agent','explore',
   '--dir',cwd,'--session',sessionId,'Review source']);
 assert.ok(!calls[0].args.includes('--auto'));
 assert.equal((await a.observeTurn(receipt())).state,'COMPLETED');
 assert.equal(await a.cancelTurn(receipt()),'CONFIRMED');
 await a.close();
});
test('missing OpenCode terminal event keeps submission unknown, never fabricates turn',async()=>{
 const a=opencode(opencodeHost({stdout:jsonl([{type:'step_start'}])}));
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 await assert.rejects(a.submitTurn({sessionId,prompt:'Review',scopeHash:H('a'),readOnly:true}),
  /OPENCODE_TERMINAL_EVENT_MISSING/);
 assert.equal((await a.observeTurn(receipt('msg_no_result'))).state,'COMPLETED');
 await a.close();
});
test('OpenCode adapter rejects session or write scope mismatches',async()=>{
 const a=opencode(opencodeHost());
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 await assert.rejects(a.submitTurn({sessionId:'foreign',prompt:'Review',scopeHash:H('a'),readOnly:true}),
  /OPENCODE_TURN_SCOPE_MISMATCH/);
 await assert.rejects(a.submitTurn({sessionId,prompt:'Edit files',scopeHash:H('a'),readOnly:false}),
  /OPENCODE_TURN_SCOPE_MISMATCH/);
 await a.close();
});
function fakeCodex(options={}){
 const history=[];
 const server={
 async initialize(){history.push('init')},
 async startThread(){return {thread:{id:'thread-1'}}},
 async ensureThread(){history.push('resume')},
 async startTurn(){return {turn:{id:'turn-1'}}},
 async listRecentTurns(){
  if(options.error)throw Error('CODEX_RPC_TIMEOUT');
  return {data:[{id:'turn-1',status:options.status??'completed'}]};
 },
 async listRecentTurnItems(){return {data:[{turnId:'turn-1',item:{type:'agentMessage',text:'review'}}]}},
 async interruptTurn(){history.push('interrupt')},
 async close(){history.push('close')}
 };return {server,history};
}
const codexHost=()=>({
 async attestCodexRuntime(){return {source:'TRUSTED_HOST',verified:true,launchOptions:['--disable','plugins']}},
 async authorizeReadOnly({scopeHash}){return {source:'TRUSTED_HOST',verified:true,scopeHash}}
});
const codex=({server})=>new CodexAppServerBackend({executable,cwd,host:codexHost(),newServer:()=>server});
test('Codex adapter follows official App Server thread/turn statuses without QA claims',async()=>{
 const f=fakeCodex(),a=codex(f);
 assert.equal((await a.openSession({cwd,scopeHash:H('a'),readOnly:true})).sessionId,'thread-1');
 const started=await a.submitTurn({sessionId:'thread-1',prompt:'Review',readOnly:true});
 assert.equal(started.turnId,'turn-1');
 const obs=await a.observeTurn({sessionId:'thread-1',turnId:'turn-1'});
 assert.equal(obs.state,'COMPLETED');assert.equal(obs.resultRef,'turn-1');
 assert.equal(await a.cancelTurn({sessionId:'thread-1',turnId:'turn-1'}),'CONFIRMED');
 await a.close();assert.ok(f.history.includes('close'));
});
test('Codex transient read failure remains unknown instead of fake completed',async()=>{
 const f=fakeCodex({error:true}),a=codex(f);
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 assert.equal((await a.observeTurn({sessionId:'thread-1',turnId:'turn-1'})).state,'UNKNOWN');
 await a.close();
});
test('Codex adapter rejects another session and writable mode',async()=>{
 const f=fakeCodex(),a=codex(f);
 await assert.rejects(a.openSession({cwd,scopeHash:H('a'),readOnly:false}),/CODEX_ADAPTER_SCOPE_MISMATCH/);
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 await assert.rejects(a.submitTurn({sessionId:'wrong',prompt:'Test',readOnly:true}),
  /CODEX_ADAPTER_TURN_INVALID/);
 await a.close();
});

test('Codex adapter treats a missing recorded turn as unknown, not running',async()=>{
 const f=fakeCodex(),a=codex(f);
 f.server.listRecentTurns=async()=>({data:[]});
 await a.openSession({cwd,scopeHash:H('a'),readOnly:true});
 const status=await a.observeTurn({sessionId:'thread-1',turnId:'lost-turn'});
 assert.equal(status.state,'UNKNOWN');await a.close();
});
