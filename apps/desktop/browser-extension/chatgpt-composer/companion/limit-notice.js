/* UI-only advisory: inspect bounded service notices, never chat messages.
 * No request interception, cookies, transcript or native authority. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionLimit)return;
  const SELECTOR='[role="alert"],[role="alertdialog"],[data-sonner-toast]';
  const ERROR_MARKER='[data-testid="conversation-turn-error"],[data-testid="response-error"]';
  const RETRY_CONTROLS='button[data-testid="regenerate-button"],button[data-testid="retry-button"],button[data-testid="regenerate-response-button"],button[aria-label="Regenerate"],button[aria-label="Regenerate response"],button[aria-label="Retry"],button[aria-label="Try again"],button[aria-label="Coba lagi"],button[aria-label="Buat ulang"]';
  const STOP_CONTROLS='button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Stop response"],button[aria-label="Stop"]';
  const visible=el=>Boolean(el&&el.disabled!==true&&
    (typeof el.getClientRects!=="function"||el.getClientRects().length>0));
  const TURN='[data-testid^="conversation-turn-"],[data-testid="conversation-turn"],section[data-turn],article[data-turn]';
  function classify(value){
    if(typeof value!=="string"||value.length>360)return null;
    const t=value.replace(/\s+/g," ").trim();
    if(t.length<12)return null;
    if(/(?:maximum|max)\s+(?:conversation|chat|thread)\s+length|(?:maximum|max)\s+length\s+for\s+(?:this|the)\s+(?:conversation|chat|thread)|(?:conversation|chat|thread)\s+(?:has\s+)?(?:reached|hit|exceeded)\s+(?:its\s+)?(?:maximum|max)\s+length|(?:conversation|chat|thread)\s+(?:is\s+)?too\s+long/i.test(t))
      return "CHAT_LENGTH_POSSIBLE";
    if(/(?:usage|message|rate)\s+(?:cap|limit)\s+(?:reached|hit|exceeded)|(?:reached|hit|exceeded)\s+(?:your|the|our|a)\s+(?:(?:usage|message|rate|model|thinking|gpt-[a-z0-9.-]+)\s+){0,3}(?:cap|limit)|too\s+many\s+(?:messages|requests)|limit\s+(?:reached|hit)/i.test(t))
      return "USAGE_CAP_POSSIBLE";
    if(/something went wrong|there was an error generating (?:a|the) response|(?:an? |there was an? )?error (?:occurred |in )?(?:generating|message stream|response|network|connecting)|network error|failed to (?:generate|send|load|connect)|connection (?:lost|interrupted)|terjadi kesalahan|kesalahan jaringan|gagal (?:membuat|menghasilkan|mengirim|memuat)|koneksi terputus/i.test(t))
      return "RESPONSE_ERROR_POSSIBLE";
    return null;
  }
  // A prior failed response must not trigger a retry after a later turn.
  function observeLatestError(root){
    const last=globalThis.__lpCompanionCore?.turns(root,1)?.[0];
    if(!last?.querySelectorAll)return false;
    for(const node of last.querySelectorAll(ERROR_MARKER)){
      if(visible(node))return true;
    }
    for(const node of last.querySelectorAll('[role="alert"],[data-sonner-toast]')){
      if(visible(node)&&classify(node.textContent)==="RESPONSE_ERROR_POSSIBLE")return true;
    }
    return false;
  }
  function isGenerating(root){
    return Array.from(root?.querySelectorAll?.(STOP_CONTROLS)??[]).some(visible);
  }
  // Only a single enabled site-owned Regenerate/Retry control qualifies.
  // Send, Continue and old error cards are not substitute actions.
  function retryControl(root){
    if(!root?.querySelectorAll||isGenerating(root))return null;
    let buttons=Array.from(root.querySelectorAll(RETRY_CONTROLS)).filter(b=>
      visible(b)&&!b.closest?.("#lp-companion,#lp-companion-settings"));
    if(!buttons.length){
      const latest=globalThis.__lpCompanionCore?.turns(root,1)?.[0];
      buttons=Array.from(latest?.querySelectorAll?.("button")??[]).filter(b=>
        visible(b)&&/^(?:retry|try again|regenerate(?: response)?|coba lagi|buat ulang)$/i.test(
          (b.textContent??"").trim()));
    }
    return buttons.length===1?buttons[0]:null;
  }
  function observe(root){
    if(!root?.querySelectorAll)return null;
    let inspected=0;
    for(const el of root.querySelectorAll(SELECTOR)){
      if(++inspected>24)break;
      if(!el?.closest||el.closest(TURN)||el.closest("#lp-companion"))continue;
      const status=classify(el.textContent);
      if(status)return {status,source:"UNVERIFIED_PAGE_UI_ALERT"};
    }
    return null;
  }
  globalThis.__lpCompanionLimit=Object.freeze({classify,observe,observeLatestError,isGenerating,retryControl});
})();

