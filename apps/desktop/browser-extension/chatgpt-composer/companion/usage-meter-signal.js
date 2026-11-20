/* Scalar UI interop with a separately installed ChatGPT Usage Meter.
 * No private ChatGPT endpoints, model text, cookies, interception or storage.
 * The same source runs in Helium and native WebView2; if the meter is
 * absent, Context remains unavailable instead of fabricated. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionUsageSignal)return;
  const LONG="#chatgpt-usage-overlay .cgum-tokens";
  const SHORT='#chatgpt-usage-overlay .cgum-summary .cgum-mini[title^="This chat:"]';
  function parse(value){
    if(typeof value!=="string"||value.length>400)return null;
    const t=value.trim();
    const full=/^This chat is about\s+([\d,]+)\s+tokens?\b/i.exec(t);
    let n;
    if(full){
      if(!/^(?:\d{1,9}|\d{1,3}(?:,\d{3})+)$/.test(full[1]))return null;
      n=Number(full[1].replace(/,/g,""));
    }else{
      const short=/^(?:This chat:\s*)?~?\s*(\d{1,3}(?:\.\d{1,3})?)\s*([kKmM])(?:\s+tokens?)?$/i.exec(t);
      if(!short)return null;
      n=Math.round(Number(short[1])*(short[2].toLowerCase()==="m"?1_000_000:1_000));
    }
    return Number.isSafeInteger(n)&&n>0&&n<=100_000_000?n:null;
  }
  function observe(doc){
    const overlay=doc?.querySelector?.("#chatgpt-usage-overlay");
    if(!overlay)return null;
    const tokens=overlay.querySelector?.(".cgum-tokens")??
      overlay.querySelector?.('.cgum-summary .cgum-mini[title^="This chat:"]');
    const count=tokens?
      parse(tokens.getAttribute?.("title"))??parse(tokens.querySelector?.(".cgum-val")?.textContent):
      null;
    const hit=overlay.querySelector?.(".cgum-hit");
    const limit=hit&&/limit hit/i.test(hit.textContent??"")?true:false;
    return {tokens:count,limit,source:"USAGE_METER_RENDERED_SCALAR"};
  }
  function format(n){
    if(!Number.isSafeInteger(n)||n<1)return "—";
    if(n>=1_000_000)return "~"+(n/1_000_000).toFixed(2).replace(/0+$/,"").replace(/\.$/,"")+"M";
    if(n>=1_000)return "~"+(n/1_000).toFixed(1).replace(/\.0$/,"")+"K";
    return "~"+n.toLocaleString("en-US");
  }
  globalThis.__lpCompanionUsageSignal=Object.freeze({LONG,SHORT,parse,observe,format});
})();

