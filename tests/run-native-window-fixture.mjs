import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(resolve(root, 'apps/desktop/src-tauri/src/chat_fixture_send.js'), 'utf8');
let checks = 0;
const eq = (actual, expected, reason) => {assert.deepEqual(actual, expected, reason); checks++;};
const yes = (value, reason) => {assert.ok(value, reason); checks++;};
const origin = 'http://127.0.0.1:38771';
const href = origin + '/fixture-chat/index.html';
const prompt = {protocolVersion:1,epoch:1,promptId:'prompt-001',
  expectedOrigin:origin,expectedHref:href,text:'First line\nSecond line'};
function page({url=href, draft='', disabled=false, missing=false, onClick=null}={}) {
  const events=[];
  const editor = {value:draft,disabled:false,readOnly:false,focused:false,
    focus(){this.focused=true},dispatchEvent(e){events.push(e.type)}};
  const status={textContent:'IDLE'};
  const send={clicks:0,disabled,click(){this.clicks++; status.textContent='GENERATING';onClick?.();}};
  const rootElement={dataset:{},querySelector(sel){
    return ({'[data-lazy-fixture-editor]':editor,
      '[data-lazy-fixture-send]':missing?null:send})[sel]??null;}};
  const document={querySelector(sel){return sel==='[data-lazy-fixture-root]'?rootElement:null;}};
  const context={document,location:new URL(url),URL,Number,Event:class Event{constructor(type){this.type=type;}}};
  const fn=vm.runInNewContext('('+script+')',context);
  return {fn,editor,send,status,rootElement,events,context};
}
const p=page();
eq(p.fn(prompt).reason,'UI_ACTION_ONLY','one synthetic click requested');
eq(p.editor.value,prompt.text,'multiline preserved');
eq(p.send.clicks,1,'exactly one Send click');
eq(p.events,['input'],'input event sent to fixture');
yes(p.editor.focused,'editor focused');
eq(p.rootElement.dataset.lpFixtureLastPrompt,'1:prompt-001','fixture local duplicate marker');
eq(p.fn(prompt).reason,'DUPLICATE_PROMPT_ID','same prompt cannot click twice');
eq(p.send.clicks,1,'still only one click');
const after=p.fn({...prompt,promptId:'prompt-002'});
eq(after.reason,'COMPOSER_NOT_READY','does not overwrite pending draft');
eq(p.send.clicks,1,'next prompt blocked without reset');
const manual=page({draft:'human writing'});
eq(manual.fn(prompt).reason,'COMPOSER_NOT_READY','human draft preserved');
eq(manual.editor.value,'human writing','manual text unchanged');
eq(manual.send.clicks,0,'no Send while human draft');
const off=page({disabled:true});
eq(off.fn(prompt).reason,'COMPOSER_NOT_READY','disabled Send rejected');
eq(off.send.clicks,0,'disabled Send not clicked');
const hidden=page({missing:true});
eq(hidden.fn(prompt).reason,'COMPOSER_NOT_READY','missing Send rejected');
for (const bad of [
  {epoch:0}, {promptId:'bad/id'}, {text:''},{text:' '.repeat(3)},
  {text:'a'.repeat(12001)}, {expectedHref:origin+'/fixture-chat/different.html'},
  {expectedOrigin:'http://evil.example'}, {protocolVersion:2},
]) {
  const f=page();
  eq(f.fn({...prompt,...bad}).attempted,false,'bad fixture command denied');
  eq(f.send.clicks,0,'invalid command has no side effect');
}
for (const badUrl of ['https://chatgpt.com/','http://localhost:38771/fixture-chat/index.html',
  'http://127.0.0.1:38771/other','http://127.0.0.1:38771/fixture-chat/moved']) {
  const f=page({url:badUrl});
  eq(f.fn(prompt).reason,'FIXTURE_ORIGIN_MISMATCH','wrong URL rejected');
  eq(f.send.clicks,0,'wrong URL has no click');
}
const fail=page({onClick:()=>{throw Error('site JS rejected click')}});
eq(fail.fn(prompt).reason,'SEND_OUTCOME_UNKNOWN','click error uncertain');
eq(fail.fn(prompt).reason,'DUPLICATE_PROMPT_ID','uncertain send is never retried');
const jsonPrompt={...prompt,text:'"});evil();/*'};
const injected=page();
eq(injected.fn(JSON.parse(JSON.stringify(jsonPrompt))).reason,'UI_ACTION_ONLY','quoted prompt treated as data');
eq(injected.editor.value,jsonPrompt.text,'literal injection markers preserved');
eq(Object.hasOwn(injected.context,'evil'),false,'no constructed code invoked');
const result=page().fn(prompt);
eq(Object.hasOwn(result,'response'),false,'no assistant response');
eq(Object.hasOwn(result,'text'),false,'no user text echoed');
yes(!script.includes('window.postMessage'),'no page-visible native request');
yes(!script.includes('chrome.webview'),'no webpage privileged callback');
console.log('Native direct-send fixture: PASS ('+checks+' assertions; VM only, no WebView2)');
