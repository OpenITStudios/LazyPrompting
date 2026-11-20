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
  const turns=(root)=>{
    if(!root?.querySelectorAll)return [];
    // A virtualized thread only exposes a subset. Never count as all messages.
    for(const selector of [
      'main [data-testid^="conversation-turn-"]',
      'main [data-testid="conversation-turn"]',
      'main section[data-turn]',
      'main article[data-turn]'
    ]){
      const items=Array.from(root.querySelectorAll(selector)).slice(0,500);
      if(items.length)return items;
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
  const storageKey=id=>"lp-companion-notes:"+id;
  globalThis.__lpCompanionCore=Object.freeze({
    safeChatId,turns,turnMarker,normalizeNotes,normalizeNote,safeReviewUrl,
    storageKey,MAX_NOTES
  });
})();
