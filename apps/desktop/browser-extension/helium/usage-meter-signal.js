/* Interop with the separately installed Usage Meter's visible UI only.
 * Never read ChatGPT replies, cookies, session tokens or private APIs. */
(() => {
  "use strict";
  if(globalThis.__lpHeliumUsageSignal)return;
  const MAX=100_000_000;
  const LONG="#chatgpt-usage-overlay .cgum-tokens";
  const SHORT='#chatgpt-usage-overlay .cgum-summary .cgum-mini[title^="This chat:"]';
  function parse(value){
    if(typeof value!=="string"||value.length>400)return null;
    const t=value.trim();
    const full=/^This chat is about\s+([\d,]+)\s+tokens?\b/i.exec(t);
    let count;
    if(full){
      if(!/^(?:\d{1,9}|\d{1,3}(?:,\d{3})+)$/.test(full[1]))return null;
      count=Number(full[1].replace(/,/g,""));
    }else{
      const compact=/^(?:This chat:\s*)?~?\s*(\d{1,3}(?:\.\d{1,3})?)\s*([kKmM])(?:\s+tokens?)?$/i.exec(t);
      if(!compact)return null;
      count=Math.round(Number(compact[1])*(compact[2].toLowerCase()==="m"?1_000_000:1_000));
    }
    return Number.isSafeInteger(count)&&count>0&&count<=MAX?count:null;
  }
  function segment(doc){
    return doc?.querySelector?.(LONG)??doc?.querySelector?.(SHORT)??null;
  }
  function observe(doc){
    const owner=segment(doc);
    if(!owner)return null;
    const tokens=parse(owner.getAttribute?.("title"))??
      parse(owner.querySelector?.(".cgum-val")?.textContent);
    if(tokens===null)return null;
    return {tokens,source:"THIRD_PARTY_USAGE_METER_VISIBLE_ESTIMATE",verified:false};
  }
  function decorate(doc,loaded){
    if(!Number.isSafeInteger(loaded)||loaded<0)return false;
    const owner=segment(doc);
    if(!owner)return false;
    let badge=owner.querySelector?.(".lp-helium-turn-count");
    if(!badge){
      badge=doc.createElement?.("span");
      if(!badge)return false;
      badge.className="lp-helium-turn-count";
      owner.append(badge);
    }
    const label=loaded>=3001?"3000+ pesan termuat":loaded+" pesan termuat";
    if(badge.textContent!==label)badge.textContent=label;
    badge.title="Jumlah pesan yang termuat saat ini, bukan total riwayat percakapan.";
    return true;
  }
  function stage(value){
    if(!Number.isSafeInteger(value)||value<=0||value>MAX)return "UNKNOWN";
    return value>=4_000_000?"STOP":value>=3_600_000?"PREPARE":
      value>=3_200_000?"CHECKPOINT":"NORMAL";
  }
  globalThis.__lpHeliumUsageSignal=Object.freeze({parse,segment,observe,decorate,stage});
})();

