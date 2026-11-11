import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'apps/desktop/browser-extension/content-script.js'),'utf8');
let count=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);count++;}
function fixture(href='http://127.0.0.1:38771/fixture-chat/index.html'){
  const handlers=[];let observeCallback,posts=[];
  const indicator={textContent:'IDLE'};
  const editor={value:'',disabled:false,readOnly:false,focus(){},dispatchEvent(){}};
  const button={disabled:false,clicks:0,click(){this.clicks++;indicator.textContent='GENERATING';observeCallback?.();}};
  const rootNode={querySelector(k){return ({'[data-lazy-fixture-editor]':editor,'[data-lazy-fixture-send]':button,'#status':indicator})[k]??null;}};
  const document={querySelector:k=>k==='[data-lazy-fixture-root]'?rootNode:null};
  const chrome={runtime:{id:'extension-fixture-id',onMessage:{addListener(){}},sendMessage(x){return Promise.resolve(x);}}};
  const location=new URL(href);
  const window={addEventListener(_type,fn){handlers.push(fn);},postMessage(msg,origin){posts.push({msg,origin});}};
  const ctx={chrome,window,location,document,Event:class Event {}, URL,Number,Map,Set,
    MutationObserver:class MutationObserver{constructor(cb){observeCallback=cb;}observe(){}}};
  runInNewContext(source,ctx);
  function emit(command={}, extra={}){
    const request={type:'LP_FIXTURE_NATIVE_REQUEST',protocolVersion:1,requestId:'req-001',
      command:{type:'LP_FIXTURE_SEND',protocolVersion:1,workspaceId:'workspace-01',
        epoch:1,promptId:'task-1',text:'Fixture prompt\nsecond line',...command}};
    const event={source:window,origin:location.origin,data:request,...extra};
    for(const fn of handlers)fn(event);
    return posts.at(-1)?.msg;
  }
  return {editor,button,indicator,window,posts,handlers,emit};
}
const a=fixture();
eq(a.handlers.length,1,'native fixture window listener registered');
const accepted=a.emit();
eq(accepted.type,'LP_FIXTURE_NATIVE_ACK','mock page receives bounded ack');
eq(accepted.protocolVersion,1,'protocol version');
eq(accepted.attempted,true,'one send attempted');
eq(accepted.requestId,'req-001','request correlation');
eq(accepted.promptId,'task-1','prompt correlation');
eq(accepted.epoch,1,'epoch correlation');
eq(accepted.workspaceId,'workspace-01','workspace correlation');
eq(accepted.reason,'UI_ACTION_ONLY','UI click is not host acceptance');
eq(a.editor.value,'Fixture prompt\nsecond line','multiline text entered');
eq(a.button.clicks,1,'exactly one click');
eq(a.posts.length,1,'one acknowledgement');
eq(a.posts[0].origin,'http://127.0.0.1:38771','responds only to exact origin');
eq(Object.hasOwn(accepted,'text'),false,'no prompt echoed');
eq(Object.hasOwn(accepted,'answer'),false,'no assistant output field');
eq(Object.hasOwn(accepted,'response'),false,'no transcript field');
const refused=a.emit({promptId:'task-2'});
eq(refused.attempted,false,'second send refused');
eq(refused.reason,'ACTIVE_PROMPT_UNRESOLVED','first prompt remains pending');
eq(a.button.clicks,1,'no repeat click');
const b=fixture();
for(const malicious of [
  {source:{},origin:'http://127.0.0.1:38771'},
  {source:b.window,origin:'https://evil.example'},
]){b.emit({},malicious);}
eq(b.posts.length,0,'forged source or origin rejected');
const c=fixture('https://chatgpt.com/');
eq(c.handlers.length,0,'not installed on real ChatGPT origin');
eq(c.posts.length,0,'no output on real ChatGPT origin');
const d=fixture();d.editor.value='human draft';
eq(d.emit().reason,'COMPOSER_NOT_READY','does not overwrite human draft');
eq(d.editor.value,'human draft','draft unchanged');
eq(d.button.clicks,0,'no click with human draft');
const e=fixture();
const invalid=e.emit({workspaceId:'workspace-33'});
eq(invalid.reason,'INVALID_FIXTURE_COMMAND','invalid workspace rejected');
eq(invalid.attempted,false,'invalid workspace not attempted');
eq(e.button.clicks,0,'invalid workspace cannot click');
console.log(`Native-window fixture bridge: PASS (${count} assertions, VM simulation, no WebView2)`);
