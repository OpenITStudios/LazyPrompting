// Deliberately synthetic site; no ChatGPT integration or output capture.
const root=document.querySelector('[data-lazy-fixture-root]');
const editor=root.querySelector('[data-lazy-fixture-editor]');
const send=root.querySelector('[data-lazy-fixture-send]');
const stop=root.querySelector('#stop');
const status=root.querySelector('#status');
const reply=root.querySelector('#reply');
let token=0;
function finish(state){status.textContent=state;stop.hidden=true;send.disabled=false;}
send.addEventListener('click',()=>{
  if(send.disabled||!editor.value.trim())return;
  const own=++token;
  send.disabled=true;stop.hidden=false;status.textContent='GENERATING';
  reply.textContent='';
  const prompt=editor.value;
  editor.value='';
  // Content is synthetic and intentionally unrelated to real ChatGPT output.
  setTimeout(()=>{if(token!==own)return;reply.textContent=`Fixture acknowledged ${prompt.length} characters`;},100);
  setTimeout(()=>{if(token!==own)return;finish('DONE');},250);
});
stop.addEventListener('click',()=>{token++;finish('MANUAL_STOP');});
root.querySelector('#fail').addEventListener('click',()=>{token++;finish('ERROR');});
root.querySelector('#halt').addEventListener('click',()=>{token++;finish('MANUAL_STOP');});
if(new URLSearchParams(location.search).has('smoke')) {
  editor.value='local fixture smoke';
  send.click();
}
