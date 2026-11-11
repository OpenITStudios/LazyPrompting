import assert from 'node:assert/strict';
import {CodexTerminalEvents} from '../src/transport/codex-terminal-events.mjs';
let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++;};
const event=(threadId='thread-01',turnId='turn-01',status='completed')=>({
  method:'turn/completed',params:{threadId,turn:{id:turnId,status}}});
const ledger=new CodexTerminalEvents();
eq(ledger.observe({method:'turn/started',params:{}}),false,'start is not completion');
eq(ledger.observe({method:'item/completed',params:{}}),false,'item is not turn');
eq(ledger.observe(event()),true,'first matching terminal notification');
const r=ledger.correlate({threadId:'thread-01',turnId:'turn-01',queriedStatus:'completed'});
eq(r.status,'CORRELATED','matching status and notification');
eq(r.hostAttested,false,'process observation not native attestation');
eq(r.qa,'NOT_EXECUTED','not QA receipt');
eq(r.nextPromptAllowed,false,'not dispatch');
eq(ledger.observe(event()),false,'idempotent duplicates');
eq(ledger.correlate({threadId:'thread-02',turnId:'turn-01',queriedStatus:'completed'}).status,'NOT_OBSERVED','cross thread denied');
eq(ledger.correlate({threadId:'thread-01',turnId:'turn-02',queriedStatus:'completed'}).status,'NOT_OBSERVED','cross turn denied');
eq(ledger.correlate({threadId:'thread-01',turnId:'turn-01',queriedStatus:'interrupted'}).status,'CONFLICT','query contradicts event');
eq(ledger.observe(event('thread-01','turn-01','failed')),false,'contradiction is not silently accepted');
eq(ledger.correlate({threadId:'thread-01',turnId:'turn-01',queriedStatus:'completed'}).status,'CONFLICT','conflicting notification poisons evidence');
for(const [name,bad] of [
 ['missing thread',{method:'turn/completed',params:{turn:{id:'x',status:'completed'}}}],
 ['wrong status',event('thread-02','turn-02','inProgress')],
 ['bad ID',event('../secret','x')],
 ['missing turn',{method:'turn/completed',params:{threadId:'thread-03'}}],
 ['untrusted shape',{method:'turn/completed',params:{threadId:'thread-03',turn:{id:3,status:'completed'}}}]
])eq(ledger.observe(bad),false,name+' rejected');
const f=new CodexTerminalEvents();
eq(f.observe(event('thread-04','turn-04','failed')),true,'failure recorded');
eq(f.correlate({threadId:'thread-04',turnId:'turn-04',queriedStatus:'failed'}).status,'NON_SUCCESS','failure not a successful result');
eq(f.observe(event('thread-05','turn-05','interrupted')),true,'interrupt recorded');
eq(f.correlate({threadId:'thread-05',turnId:'turn-05',queriedStatus:'interrupted'}).status,'NON_SUCCESS','interrupt blocked');
const cap=new CodexTerminalEvents({limit:1});
eq(cap.observe(event('t-1','u-1')),true,'first of capacity');
eq(cap.observe(event('t-2','u-2')),false,'cap rejects overflow');
eq(cap.correlate({threadId:'t-2',turnId:'u-2',queriedStatus:'completed'}).status,'CONFLICT','capacity loss fails closed');
eq(cap.correlate({threadId:'t-1',turnId:'u-1',queriedStatus:'completed'}).status,'CORRELATED','previously observed event remains valid');
assert.throws(()=>new CodexTerminalEvents({limit:0}),/INVALID_TERMINAL_EVENT_LIMIT/);assertions++;
assert.throws(()=>new CodexTerminalEvents({limit:2048}),/INVALID_TERMINAL_EVENT_LIMIT/);assertions++;
const malformed=new CodexTerminalEvents();
eq(malformed.observe(event('thread-bad','turn-bad','inProgress')),false,'unexpected terminal status not accepted');
eq(malformed.correlate({threadId:'thread-bad',turnId:'turn-bad',queriedStatus:'completed'}).status,'CONFLICT','unrecognized terminal status cannot masquerade as absent event');
eq(malformed.observe(event('thread-bad','turn-bad','completed')),false,'later valid event cannot repair poisoned turn');
eq(malformed.correlate({threadId:'thread-bad',turnId:'turn-bad',queriedStatus:'completed'}).status,'CONFLICT','poisoned turn stays blocked');
const early=new CodexTerminalEvents();
eq(early.observe(event('thread-06','turn-06')),true,'early terminal event recorded');
eq(early.correlate({threadId:'thread-06',turnId:'turn-06',queriedStatus:'completed'}).status,'CORRELATED','early event is matched later');
console.log('Codex terminal event evidence: PASS ('+assertions+' assertions; synthetic notifications)');
