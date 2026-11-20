/* Original LazyPrompting conservative rendering hint.
 * Applies CSS content-visibility only to existing, older structural turns.
 * Never detaches/reparents ChatGPT DOM or reads messages/API data. */
(() => {
  "use strict";
  if (globalThis.__lpCompactHistory) return;
  const C=globalThis.__lpCompanionCore;
  if (!C) return;
  const CLASS="lp-compact-history-turn";
  const PROPERTY="--lp-compact-turn-height";
  const KEEP_RECENT=8;
  const MAX_LOADED=3000;
  const MAX_BATCH=48; // bounded layout measurement per user-opted-in pass
  let invalid=new WeakSet();
  const key=id=>"lp-companion-compact-v1:"+id;
  const known=(node)=>node?.classList?.contains?.(CLASS)===true;
  const reset=(root)=>{
    if(!root?.querySelectorAll)return 0;
    let count=0;
    for(const el of root.querySelectorAll("."+CLASS)){
      el.classList.remove(CLASS);
      el.style?.removeProperty(PROPERTY);
      count++;
    }
    invalid=new WeakSet();
    return count;
  };
  function apply(root,{enabled=false,activeElement=null,selection=null}={}){
    if(!enabled){reset(root);return {status:"OFF",optimized:0,loaded:0};}
    if(!root?.querySelectorAll ||
       !globalThis.CSS?.supports?.("content-visibility","auto")){
      reset(root);return {status:"UNSUPPORTED",optimized:0,loaded:0};
    }
    // A temporary/incomplete page structure should never be treated as
    // a transcript, and must not preserve stale styles after navigation.
    const all=C.turns(root,MAX_LOADED+1);
    if(all.length>MAX_LOADED){
      reset(root);return {status:"BOUNDED_HOLD",optimized:0,loaded:all.length};
    }
    if(all.length<=KEEP_RECENT){
      reset(root);return {status:"NO_OLD_TURNS",optimized:0,loaded:all.length};
    }
    const protectedTurns=new Set(all.slice(-KEEP_RECENT));
    const focused=activeElement;
    const selAnchor=selection?.anchorNode??null;
    const selFocus=selection?.focusNode??null;
    let count=0;
    // Remove only our own styles and variables. No ChatGPT nodes are moved.
    // Existing text selection, active controls, and recent/streaming turns stay normal.
    const eligible=(el)=>!protectedTurns.has(el) &&
      !el.classList?.contains?.("lp-history-hidden") &&
      !(focused&&el.contains?.(focused)) &&
      !(selAnchor&&el.contains?.(selAnchor)) &&
      !(selFocus&&el.contains?.(selFocus)) &&
      !el.querySelector?.("[data-start]");
    const candidates=new Set(all.filter(eligible));
    for(const el of root.querySelectorAll("."+CLASS)){
      if(!candidates.has(el)){
        el.classList.remove(CLASS);
        el.style?.removeProperty(PROPERTY);
      }
    }
    // A fixed-size batch prevents thousands of forced layout reads in
    // one event. Collect every size before writing any containment style.
    const measurements=[];
    let pending=0;
    for(const el of candidates){
      if(known(el)){count++;continue;}
      if(invalid.has(el))continue;
      if(measurements.length>=MAX_BATCH){pending++;continue;}
      const height=el.getBoundingClientRect?.().height;
      if(typeof height!=="number"||!Number.isFinite(height)||
         height<24||height>200000){
        invalid.add(el); // Weak reference: cannot pin removed ChatGPT DOM.
        continue;
      }
      measurements.push({el,height:Math.ceil(height)});
    }
    for(const {el,height} of measurements){
      el.style?.setProperty(PROPERTY,height+"px");
      el.classList?.add(CLASS);
      count++;
    }
    return {status:count?"ACTIVE":pending?"IN_PROGRESS":"NO_MEASURABLE_TURNS",
      optimized:count,loaded:all.length,pending};
  }
  globalThis.__lpCompactHistory=Object.freeze({
    apply,reset,key,CLASS,KEEP_RECENT,MAX_LOADED,MAX_BATCH
  });
})();
