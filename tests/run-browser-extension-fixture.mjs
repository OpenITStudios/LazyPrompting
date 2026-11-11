import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = path => readFileSync(resolve(here, '..', 'apps/desktop/browser-extension', path), 'utf8');
const manifest = JSON.parse(source('manifest.json'));
let assertions = 0;
const eq = (actual, expected, description) => {assert.deepEqual(actual, expected, description); assertions++;};
const yes = (value, description) => {assert.ok(value, description); assertions++;};

function makePage(url='http://127.0.0.1:38771/fixture-chat/index.html') {
  const listeners = [];
  const reports = [];
  let observer;
  const indicator = {textContent: 'IDLE'};
  const editor = {value: '', disabled: false, readOnly: false, focused: false,
    focus(){this.focused = true;}, dispatchEvent(){}};
  const send = {disabled:false, clicks:0, click(){this.clicks++; indicator.textContent='GENERATING'; observer?.();}};
  const root = {querySelector(q){return ({'[data-lazy-fixture-editor]':editor,
    '[data-lazy-fixture-send]':send, '#status':indicator})[q]??null;}};
  const document = {querySelector(q){return q==='[data-lazy-fixture-root]'?root:null;}};
  const chrome = {runtime:{id:'lp-fixture-extension', onMessage:{addListener(fn){listeners.push(fn);}},
    sendMessage(msg){reports.push(msg);return Promise.resolve();}}};
  const sandbox={location:new URL(url),document,chrome,Event:class Event {},
    MutationObserver:class MutationObserver {constructor(fn){observer=fn;} observe(){}},
    URL,Number,Object,Map,Set};
  runInNewContext(source('content-script.js'),sandbox);
  function command(overrides={}) {
    const input={type:'LP_FIXTURE_SEND',protocolVersion:1,workspaceId:'workspace-01',
      epoch:1,promptId:'prompt-1',text:'Hello from Codex\nsecond line',...overrides};
    let result;
    for(const fn of listeners)fn(input,{id:chrome.runtime.id},x=>result=x);
    return result;
  }
  function message(input, sender={id:chrome.runtime.id}) {
    let result;
    for(const fn of listeners)fn(input,sender,x=>result=x);
    return result;
  }
  return {editor,send,indicator,reports,listeners,command,message,
    change(next){indicator.textContent=next;observer?.();}};
}

eq(manifest.manifest_version,3,'Manifest V3');
eq(manifest.host_permissions,['http://127.0.0.1/*'],'fixture-only origin');
eq(manifest.content_scripts[0].matches,['http://127.0.0.1/*'],'fixture-only content script');
yes(!JSON.stringify(manifest).includes('chatgpt.com'),'real ChatGPT not targeted');
const a=makePage();
eq(a.listeners.length,1,'listener registered on fixture');
eq(a.command().attempted,true,'send attempted once');
eq(a.editor.value,'Hello from Codex\nsecond line','preserve multiline content');
eq(a.send.clicks,1,'click Send exactly once');
yes(a.editor.focused,'focus editor');
eq(a.command().reason,'ACTIVE_PROMPT_UNRESOLVED','no repeat while outstanding');
eq(a.reports.map(x=>x.state),['INPUT_ATTEMPTED','GENERATING'],'status-only events');
yes(a.reports.every(x=>!('text' in x)&&!('answer' in x)&&!('response' in x)),'no message output data');
eq(a.message({type:'LP_FIXTURE_STATUS'}).state,'GENERATING','status inspect');
a.change('DONE');
eq(a.message({type:'LP_FIXTURE_STATUS'}).state,'UI_COMPLETED_OBSERVED','completed after start');
eq(a.message({type:'LP_FIXTURE_RESET',verified:false,epoch:1,promptId:'prompt-1'}).reset,false,'reset requires verification');
eq(a.message({type:'LP_FIXTURE_RESET',verified:true,epoch:1,promptId:'prompt-1'}).reset,true,'verified fixture reset');
eq(a.command().reason,'DUPLICATE_PROMPT_ID','no repeat after reset');
eq(a.command({epoch:2,promptId:'prompt-2'}).attempted,false,'user composer still occupied');
eq(a.send.clicks,1,'no extra click on occupied composer');
const wrongOrigin=makePage('https://chatgpt.com/');
eq(wrongOrigin.listeners.length,0,'ChatGPT not loaded');
const wrongPath=makePage('http://127.0.0.1:38771/other');
eq(wrongPath.listeners.length,0,'unapproved localhost path not loaded');
const b=makePage();
eq(b.command({workspaceId:'workspace-11'}).reason,'INVALID_FIXTURE_COMMAND','bad workspace');
eq(b.command({epoch:0}).reason,'INVALID_FIXTURE_COMMAND','bad epoch');
eq(b.command({text:''}).reason,'INVALID_FIXTURE_COMMAND','empty text');
eq(b.command({text:'a'.repeat(12001)}).reason,'INVALID_FIXTURE_COMMAND','large text');
eq(b.send.clicks,0,'nothing sent for invalid commands');
let unauthorized;
for(const fn of b.listeners)fn({type:'LP_FIXTURE_SEND'}, {id:'other'},x=>unauthorized=x);
eq(unauthorized,undefined,'untrusted extension sender rejected');
const c=makePage();c.editor.value='manual user text';
eq(c.command().reason,'COMPOSER_NOT_READY','does not overwrite manual text');
eq(c.editor.value,'manual user text','manual text preserved');
const d=makePage();d.send.disabled=true;
eq(d.command().reason,'COMPOSER_NOT_READY','disabled send rejected');
const e=makePage();e.command();e.change('ERROR');
eq(e.message({type:'LP_FIXTURE_STATUS'}).state,'ERROR','error reporting');
const f=makePage();f.command();f.change('MANUAL_STOP');
eq(f.message({type:'LP_FIXTURE_STATUS'}).state,'INTERRUPTED','manual stop');
const g=makePage();g.indicator.textContent='DONE';
// No submitted prompt, so completion isn't reported.
g.change('DONE');
eq(g.reports.length,0,'no completion without sent prompt');
const h=makePage();h.command();h.change('DONE');
eq(h.reports.at(-1).promptId,'prompt-1','correlated promptId');
eq(h.reports.at(-1).epoch,1,'correlated epoch');
yes(h.reports[1].seq>h.reports[0].seq,'monotonic event sequence');

// Background cache: metadata only, rejects stale/out-of-order status.
const bgListeners=[];const bgStore=[];const bgChrome={runtime:{id:'lp-fixture-extension',onMessage:{addListener(fn){bgListeners.push(fn);}}},
  tabs:{onRemoved:{addListener(){}}}, storage:{session:{set(x){bgStore.push(x);return Promise.resolve();}}}};
runInNewContext(source('background.js'),{chrome:bgChrome,Map,Date,Number});
eq(bgListeners.length,1,'background listener');
const sent={...a.reports[0], type:'LP_FIXTURE_OBSERVATION'};
let acknowledged;
bgListeners[0](sent,{id:bgChrome.runtime.id,tab:{id:7}},v=>acknowledged=v);
eq(acknowledged.accepted,true,'background status acknowledgement');
eq(bgStore.length,1,'background stored status');
bgListeners[0](sent,{id:bgChrome.runtime.id,tab:{id:7}},()=>{});
eq(bgStore.length,1,'background deduplicates old status');
bgListeners[0]({...sent,epoch:-1},{id:bgChrome.runtime.id,tab:{id:7}},()=>{});
eq(bgStore.length,1,'background rejects older epoch');
bgListeners[0]({...sent,state:'REPLY_TEXT',seq:2},{id:bgChrome.runtime.id,tab:{id:7}},()=>{});
eq(bgStore.length,1,'background rejects unknown status');
yes(bgStore.every(entry=>!JSON.stringify(entry).includes('Hello from Codex')),'no user text in cache');

console.log(`Browser extension fixture: PASS (${assertions} assertions; local synthetic DOM only)`);
