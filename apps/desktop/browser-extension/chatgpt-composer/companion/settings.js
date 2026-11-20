/* One local settings contract for Helium and native WebView2 Companion. */
(() => {
  "use strict";
  if(globalThis.__lpCompanionSettings)return;
  const KEY="lp-companion-settings-v2";
  const DEFAULTS=Object.freeze({compact:true,history:"10",custom:15,
    soon:3_600_000,switchAt:4_000_000});
  const CHOICES=["1","3","5","10","25","unlimited","custom"];
  function normalize(value){
    const v=value&&typeof value==="object"?value:{};
    const result={
      compact:typeof v.compact==="boolean"?v.compact:DEFAULTS.compact,
      history:CHOICES.includes(v.history)?v.history:DEFAULTS.history,
      custom:Number.isSafeInteger(v.custom)&&v.custom>=1&&v.custom<=1500?v.custom:DEFAULTS.custom,
      soon:Number.isSafeInteger(v.soon)&&v.soon>=100_000&&v.soon<=99_000_000?v.soon:DEFAULTS.soon,
      switchAt:Number.isSafeInteger(v.switchAt)&&v.switchAt>=200_000&&v.switchAt<=100_000_000?v.switchAt:DEFAULTS.switchAt
    };
    if(result.soon>=result.switchAt){
      result.soon=DEFAULTS.soon;result.switchAt=DEFAULTS.switchAt;
    }
    return result;
  }
  function visibleTurns(p){
    if(!p.compact||p.history==="unlimited")return Infinity;
    const exchanges=p.history==="custom"?p.custom:Number(p.history);
    return Math.min(3000,Math.max(2,exchanges*2));
  }
  function millionText(count){return (count/1_000_000).toFixed(2).replace(/0+$/,"").replace(/\.$/,"");}
  function fromMillions(input){
    const n=Number(input);
    return input!==""&&Number.isFinite(n)&&n>=0.1&&n<=100?
      Math.round(n*1_000_000):null;
  }
  globalThis.__lpCompanionSettings=Object.freeze({
    KEY,DEFAULTS,CHOICES,normalize,visibleTurns,millionText,fromMillions
  });
})();

