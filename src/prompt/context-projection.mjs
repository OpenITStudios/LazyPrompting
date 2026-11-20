// Deterministic, bounded context projection; never imports another workspace's history.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const clean=(x,max)=>typeof x==="string"?x.replace(/[\x00-\x1f\x7f]/g," ").slice(0,max):"";
// Keep the most recent distinct context items, without weakening the existing
// cross-workspace identity check or silently removing unique evidence.
// Inspect only a bounded tail to avoid unbounded model-supplied arrays.
const recentUnique=(items,max,maxLength)=>{
 // Check at most the last 64 entries. Unknown earlier entries may carry
 // material decisions, so a skipped prefix still requires full review.
 if(!Array.isArray(items))return {values:[],limited:true};
 const values=[],seen=new Set(),from=Math.max(0,items.length-64);
 let limited=from>0;
 for(let i=items.length-1;i>=from;i--){
  const raw=items[i];
  if(typeof raw!=="string"){limited=true;continue;}
  const value=clean(raw,maxLength).trim();
  if(raw.length>maxLength)limited=true;
  if(!value||seen.has(value))continue;
  seen.add(value);
  if(values.length<max)values.unshift(value);
  else limited=true;
 }
 return {values,limited};
};
export function projectPromptContext({workspaceId,sessionId,taskId,goal,
 decisions=[],supersededDecisions=[],constraints=[],progressNotes=[],
 progress,nextAction,lastResponse}={}){
 if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||
    !goal||typeof goal!=="string"||!nextAction||typeof nextAction!=="string")
  return {valid:false,reason:"INVALID_CONTEXT"};
 if(lastResponse&&(lastResponse.workspaceId!==workspaceId||lastResponse.sessionId!==sessionId))
  return {valid:false,reason:"CROSS_WORKSPACE_CONTEXT"};
 const active=recentUnique(decisions,8,240);
 const superseded=recentUnique(supersededDecisions,8,240);
 const constraintsProjection=recentUnique(constraints,12,240);
 const reported=recentUnique(progressNotes,8,240);
 const capsule={workspaceId,sessionId,taskId,goal:clean(goal,1000),
  decisions:active.values,
  supersededDecisions:superseded.values,
  constraints:constraintsProjection.values,
  // Reported progress is not independent source/QA evidence.
  progressNotes:reported.values,
  progress:clean(progress,1200),nextAction:clean(nextAction,800),
  lastResponseSummary:clean(lastResponse?.summary,800),
  // Bounded context must never be represented as complete evidence.
  contextLimited:{
   goal:goal.length>1000,
   decisions:active.limited,
   supersededDecisions:superseded.limited,
   constraints:constraintsProjection.limited,
   progressNotes:reported.limited,
   progress:typeof progress==="string"&&progress.length>1200,
   nextAction:nextAction.length>800,
   lastResponseSummary:typeof lastResponse?.summary==="string"&&
    lastResponse.summary.length>800
  }};
 return {valid:true,capsule};
}
