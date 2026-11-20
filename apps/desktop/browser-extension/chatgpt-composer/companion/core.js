/* Original LazyPrompting Companion utilities. Structural navigation only.
 * No ChatGPT API, fetch interception, response text, cookies, or credentials. */
(() => {
  "use strict";
  if (globalThis.__lpCompanionCore) return;
  const CHAT=/^\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  const MAX_NOTES=32;
  const MAX_NOTE_LENGTH=160;
  const safeChatId=(url)=>{
    try{
      const u=new URL(url);
      if(u.protocol!=="https:"||u.hostname!=="chatgpt.com"||u.username||
         u.password||u.port||[...u.searchParams.keys()].some(k=>
          /^temporary[-_]?chat$/i.test(k)))return null;
      return CHAT.exec(u.pathname)?.[1]?.toLowerCase()??null;
    }catch{return null;}
  };
  const turns=(root,max=500)=>{
    if(!root?.querySelectorAll)return [];
    // Only mounted DOM, NOT the entire chat. Choose the newest loaded
    // turns so navigation and compact mode never mistake the first 500
    // for the latest 500 in a very long conversation.
    const limit=Number.isSafeInteger(max)?Math.max(1,Math.min(3001,max)):500;
    for(const selector of [
      'main [data-testid^="conversation-turn-"]',
      'main [data-testid="conversation-turn"]',
      'main section[data-turn]',
      'main article[data-turn]'
    ]){
      const nodes=root.querySelectorAll(selector);
      if(nodes.length)return Array.from(nodes).slice(-limit);
    }
    return [];
  };
  const turnMarker=(el)=>el?.getAttribute?.("data-testid")||
    el?.getAttribute?.("data-turn")||null;
  const normalizeNotes=(input)=>{
    if(!Array.isArray(input))return [];
    const found=new Set();
    return input.filter(row=>{
      if(!row||typeof row!=="object"||typeof row.id!=="string"||
         !/^[a-z0-9-]{1,64}$/i.test(row.id)||
         typeof row.note!=="string"||!row.note.trim()||
         row.note.length>MAX_NOTE_LENGTH||
         !(row.marker===null||(typeof row.marker==="string"&&row.marker.length<=128))||
         !Number.isSafeInteger(row.at)||row.at<0||
         found.has(row.id))return false;
      found.add(row.id);return true;
    }).slice(-MAX_NOTES).map(({id,note,marker,at})=>({id,note:note.trim(),marker,at}));
  };
  const normalizeNote=(text)=>typeof text==="string"?
    text.trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,MAX_NOTE_LENGTH):"";
  const safeReviewUrl=(value)=>{
    try{
      const u=new URL(String(value??"").trim());
      if(u.protocol!=="https:"||u.username||u.password||u.href.length>2048||
        !u.hostname||u.hostname==="localhost"||
        /^(127\.|10\.|192\.168\.)/.test(u.hostname))return null;
      return u.href;
    }catch{return null;}
  };
  // Ignore text-stream and Companion-owned DOM churn. Trigger only when
  // structural page UI can affect the loaded turn list, visible meter,
  // bounded service alerts, or the pending rollover's target menu.
  // This is read-only structural inspection, never conversation text.
  const OWNED="#lp-companion,#lp-companion-settings,#lp-history-reveal";
  const TURN='[data-testid^="conversation-turn-"],[data-testid="conversation-turn"],section[data-turn],article[data-turn]';
  const SIGNAL='#chatgpt-usage-overlay,[role="alert"],[role="alertdialog"],[data-sonner-toast]';
  const NAV='nav,aside,[role="navigation"],[role="menu"],[role="dialog"]';
  function mutationNeedsRefresh(records,mode="monitor"){
    if(!Array.isArray(records)||!records.length)return false;
    const inspected=Math.min(records.length,32);
    for(let i=0;i<inspected;i++){
      const record=records[i];
      if(record?.type!=="childList")continue;
      const target=record.target?.nodeType===1?record.target:
        record.target?.parentElement;
      if(!target?.closest)return true; // unknown structure: fail to refresh
      if(target.closest(OWNED))continue;
      // When we mount or remove our own strip, the mutation target is
      // ChatGPT's parent. That is not a real conversation update.
      const nodes=[...(record.addedNodes??[]),...(record.removedNodes??[])];
      if(nodes.length&&nodes.every(node=>{
        const element=node?.nodeType===1?node:node?.parentElement;
        return element?.matches?.(OWNED)||element?.closest?.(OWNED);
      }))continue;
      if(target.closest(SIGNAL))return true;
      if(mode==="rollover"&&target.closest(NAV))return true;
      if(target.closest(TURN))continue; // streaming body text, not a new turn
      if(target.closest("main,body,html"))return true;
    }
    return records.length>inspected; // large batches stay bounded/fail-open
  }
  const storageKey=id=>"lp-companion-notes:"+id;
  globalThis.__lpCompanionCore=Object.freeze({
    safeChatId,turns,turnMarker,normalizeNotes,normalizeNote,safeReviewUrl,
    mutationNeedsRefresh,storageKey,MAX_NOTES
  });
})();
