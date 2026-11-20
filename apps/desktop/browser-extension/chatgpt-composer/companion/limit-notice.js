/* UI-only advisory: inspect bounded service notices, never chat messages.
 * No request interception, cookies, transcript or native authority. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionLimit)return;
  const SELECTOR='[role="alert"],[role="alertdialog"],[data-sonner-toast]';
  const TURN='[data-testid^="conversation-turn-"],[data-testid="conversation-turn"],section[data-turn],article[data-turn]';
  function classify(value){
    if(typeof value!=="string"||value.length>360)return null;
    const t=value.replace(/\s+/g," ").trim();
    if(t.length<12)return null;
    if(/(?:maximum|max)\s+(?:conversation|chat|thread)\s+length|(?:conversation|chat|thread)\s+(?:has\s+)?(?:reached|hit|exceeded)\s+(?:its\s+)?(?:maximum|max)\s+length|(?:conversation|chat|thread)\s+(?:is\s+)?too\s+long/i.test(t))
      return "CHAT_LENGTH_POSSIBLE";
    if(/(?:usage|message|rate)\s+(?:cap|limit)\s+(?:reached|hit|exceeded)|(?:reached|hit|exceeded)\s+(?:your|the|our|a)\s+(?:(?:usage|message|rate|model)\s+)?(?:cap|limit)|too\s+many\s+(?:messages|requests)|limit\s+(?:reached|hit)/i.test(t))
      return "USAGE_CAP_POSSIBLE";
    return null;
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
  globalThis.__lpCompanionLimit=Object.freeze({classify,observe});
})();

