/* Reversible bounded visibility of old structural ChatGPT turns.
 * Only elements owned by ChatGPT's turn markup are styled. This does
 * not read chat content, remove nodes, or change the canonical history. */
(() => {
  "use strict";
  if(globalThis.__lpHistoryVisibility)return;
  const C=globalThis.__lpCompanionCore;
  if(!C)return;
  const CLASS="lp-history-hidden";
  const MAX=3000;
  let reveal=null;
  function reset(doc){
    for(const el of doc?.querySelectorAll?.("."+CLASS)??[])el.classList.remove(CLASS);
    if(reveal){reveal.remove();reveal=null;}
  }
  function apply(doc,{enabled=false,visibleTurns=Infinity,expanded=false,
    selection=null,activeElement=null,onReveal=null}={}){
    if(!enabled||expanded||!Number.isSafeInteger(visibleTurns)||visibleTurns<2){
      reset(doc);return {status:"ALL",hidden:0};
    }
    const all=C.turns(doc,MAX+1);
    if(all.length>MAX){reset(doc);return {status:"BOUNDED_HOLD",hidden:0};}
    const cutoff=Math.max(0,all.length-visibleTurns);
    if(cutoff===0){reset(doc);return {status:"ALL",hidden:0};}
    const focus=activeElement;
    const anchor=selection?.anchorNode??null;
    const end=selection?.focusNode??null;
    const isProtected=el=>
      (focus&&el.contains?.(focus))||
      (anchor&&el.contains?.(anchor))||
      (end&&el.contains?.(end))||
      Boolean(el.querySelector?.("[data-start]"));
    const target=new Set(all.slice(0,cutoff).filter(el=>!isProtected(el)));
    for(const el of doc.querySelectorAll("."+CLASS)){
      if(!target.has(el))el.classList.remove(CLASS);
    }
    for(const el of target)if(!el.classList.contains(CLASS))el.classList.add(CLASS);
    if(!target.size){if(reveal){reveal.remove();reveal=null;}return {status:"ALL",hidden:0};}
    const firstVisible=all.find(el=>!target.has(el));
    if(!firstVisible?.parentNode){reset(doc);return {status:"UNSUPPORTED",hidden:0};}
    if(!reveal){
      reveal=doc.createElement("div");
      reveal.id="lp-history-reveal";
      const button=doc.createElement("button");
      button.type="button";
      button.addEventListener("click",()=>onReveal?.());
      reveal.append(button);
    }
    const action=reveal.querySelector("button");
    const text="Show earlier messages ("+target.size+" hidden)";
    if(action.textContent!==text)action.textContent=text;
    if(reveal.nextSibling!==firstVisible||reveal.parentNode!==firstVisible.parentNode){
      firstVisible.parentNode.insertBefore(reveal,firstVisible);
    }
    return {status:"ACTIVE",hidden:target.size};
  }
  globalThis.__lpHistoryVisibility=Object.freeze({CLASS,MAX,apply,reset});
})();

