// Fixture-only DOM action. Never targets ChatGPT or claims host delivery.
export function attemptFixtureSubmit({document,location,text}={}) {
  if(!document||!location||location.protocol!=='http:'||location.hostname!=='127.0.0.1'||
    !location.pathname?.startsWith('/fixture-chat/'))
    return {attempted:false,reason:'FIXTURE_ORIGIN_REQUIRED'};
  if(typeof text!=='string'||!text.trim()||text.length>12000)
    return {attempted:false,reason:'INVALID_PROMPT'};
  const root=document.querySelector('[data-lazy-fixture-root]');
  const editor=root?.querySelector('[data-lazy-fixture-editor]');
  const send=root?.querySelector('[data-lazy-fixture-send]');
  if(!editor||!send||editor.disabled||editor.readOnly||send.disabled)
    return {attempted:false,reason:'FIXTURE_COMPOSER_UNAVAILABLE'};
  // Setting value is deliberately fixture-only. Real host/editors may require
  // different privileged, supported input paths and separate admission.
  editor.value=text;
  editor.dispatchEvent(new Event('input',{bubbles:true}));
  if(send.disabled)return {attempted:false,reason:'FIXTURE_COMPOSER_REJECTED'};
  send.click();
  return {attempted:true,acknowledged:false,reason:'UI_ACTION_ONLY'};
}
