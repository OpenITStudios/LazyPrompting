import assert from 'node:assert/strict';
import {createChatGptSendCandidate} from '../src/browser/chatgpt-send-candidate.mjs';
let count=0;
const eq=(a,b,msg)=>{assert.equal(a,b,msg);count++;};
function fixture({contenteditable=false, existing='', disabled=false, authorized=true}={}){
  const button={disabled,clicks:0,click(){this.clicks++;}};
  const editor=contenteditable
    ? {textContent:existing, focus(){},getAttribute(k){return k==='contenteditable'?'true':null;}, dispatchEvent(){},closest(){return root;}}
    : {value:existing,focus(){},dispatchEvent(){},closest(){return root;}};
  const root={querySelector(selector){if(selector.includes('send-button'))return button;return null;}};
  const document={querySelector(selector){
    if(selector==='#prompt-textarea')return editor;
    if(selector.includes('send-button'))return button;
    return null;
  },execCommand(command,_show,text){if(contenteditable&&command==='insertText'){editor.textContent+=text;return true;}return false;}};
  let grants=0;
  const api=createChatGptSendCandidate({document,pageUrl:'https://chatgpt.com/',
    authorize:async()=>{grants++;return authorized;},verifyCompletion:async()=>authorized});
  return {api,editor,button,get grants(){return grants;}};
}
const args={workspaceId:'workspace-01',epoch:1,promptId:'turn-1',text:'One\ntwo'};
const a=fixture();
eq((await a.api.submit(args)).reason,'UI_ACTION_ONLY','textarea action');
eq(a.button.clicks,1,'one send click');
eq(a.editor.value,'One\ntwo','multiline preserved');
eq((await a.api.submit(args)).reason,'PROMPT_ALREADY_ATTEMPTED','duplicate denied');
eq(a.button.clicks,1,'no duplicate click');
eq((await a.api.submit({...args,promptId:'turn-2'})).reason,'WORKSPACE_PROMPT_PENDING','one active prompt per workspace');
eq((await a.api.release({workspaceId:'workspace-01',epoch:1,promptId:'wrong'})).released,false,'wrong receipt cannot release');
eq((await a.api.release({workspaceId:'workspace-01',epoch:1,promptId:'turn-1'})).released,true,'verified release');
a.editor.value='';
eq((await a.api.submit({...args,promptId:'turn-2'})).reason,'UI_ACTION_ONLY','new prompt after verification');
eq(a.grants,2,'two admitted sequential sends');
const b=fixture({existing:'user draft'});
eq((await b.api.submit(args)).reason,'COMPOSER_NOT_READY','preserve human draft');
eq(b.editor.value,'user draft','human text not overwritten');
eq(b.button.clicks,0,'no click with human draft');
const c=fixture({disabled:true});
eq((await c.api.submit(args)).reason,'COMPOSER_NOT_READY','disabled send');
const d=fixture({authorized:false});
eq((await d.api.submit(args)).reason,'NATIVE_HOST_ADMISSION_REQUIRED','native authority denied');
eq(d.button.clicks,0,'no click without grant');
const e=fixture({contenteditable:true});
eq((await e.api.submit(args)).reason,'UI_ACTION_ONLY','contenteditable candidate');
eq(e.editor.textContent,'One\ntwo','contenteditable insert');
const f=fixture();
eq((await f.api.submit({...args,workspaceId:'workspace-99'})).reason,'INVALID_PROMPT_SCOPE','workspace bound');
eq((await f.api.submit({...args,text:''})).reason,'INVALID_PROMPT_SCOPE','empty input rejected');
eq((await f.api.submit({...args,epoch:0})).reason,'INVALID_PROMPT_SCOPE','epoch required');
eq(f.grants,0,'no grants on invalid input');
assert.throws(()=>createChatGptSendCandidate({document:f.editor,pageUrl:'https://evil.example/',authorize:async()=>true,verifyCompletion:async()=>true}),/UNAVAILABLE/);count++;
assert.throws(()=>createChatGptSendCandidate({document:f.editor,pageUrl:'https://chatgpt.com.evil/',authorize:async()=>true,verifyCompletion:async()=>true}),/UNAVAILABLE/);count++;
assert.throws(()=>createChatGptSendCandidate({document:f.editor,pageUrl:'https://chatgpt.com/',authorize:true}),/UNAVAILABLE/);count++;
for(const tempUrl of [
  'https://chatgpt.com/?temporary-chat=true',
  'https://chatgpt.com/?x=1&Temporary-Chat=false',
  'https://chatgpt.com/?temporary_chat=1',
  'https://chatgpt.com/?temporary%2Dchat=1',
]){
  assert.throws(()=>createChatGptSendCandidate({document:f.editor,pageUrl:tempUrl,
    authorize:async()=>true,verifyCompletion:async()=>true}),/UNAVAILABLE/);
  count++;
}
let completeAuthorization;
const deferredAuth=new Promise(resolve=>{completeAuthorization=resolve;});
const r=fixture();
const race=createChatGptSendCandidate({document:{querySelector:()=>r.editor},pageUrl:'https://chatgpt.com/',
  authorize:()=>deferredAuth,verifyCompletion:async()=>true});
const first=race.submit(args);
eq((await race.submit({...args,promptId:'turn-2'})).reason,'WORKSPACE_PROMPT_PENDING','concurrent authorization locked');
completeAuthorization(false);
eq((await first).reason,'NATIVE_HOST_ADMISSION_REQUIRED','deferred denial');
console.log(`ChatGPT send candidate: PASS (${count} source-contract assertions; no live site connected)`);
