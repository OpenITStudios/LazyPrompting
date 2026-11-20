// Deterministic, bounded context projection; never imports another workspace's history.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const clean=(x,max)=>typeof x==="string"?x.replace(/[\x00-\x1f\x7f]/g," ").slice(0,max):"";
// Keep the most recent distinct context items, without weakening the existing
// cross-workspace identity check or silently removing unique evidence.
// Inspect only a bounded tail to avoid unbounded model-supplied arrays.
const recentUnique=(items,max,maxLength)=>{
 if(!Array.isArray(items))return [];
 const result=[],seen=new Set();
 for(let i=items.length-1;i>=Math.max(0,items.length-64)&&result.length<max;i--){
  const value=clean(items[i],maxLength).trim();
  if(value&&!seen.has(value)){seen.add(value);result.unshift(value);}
 }
 return result;
};
export function projectPromptContext({workspaceId,sessionId,taskId,goal,decisions=[],constraints=[],progress,nextAction,lastResponse}={}){
 if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||
    !goal||typeof goal!=="string"||!nextAction||typeof nextAction!=="string")
  return {valid:false,reason:"INVALID_CONTEXT"};
 if(lastResponse&&(lastResponse.workspaceId!==workspaceId||lastResponse.sessionId!==sessionId))
  return {valid:false,reason:"CROSS_WORKSPACE_CONTEXT"};
 const capsule={workspaceId,sessionId,taskId,goal:clean(goal,1000),
  decisions:recentUnique(decisions,8,240),
  constraints:recentUnique(constraints,12,240),
  progress:clean(progress,1200),nextAction:clean(nextAction,800),
  lastResponseSummary:clean(lastResponse?.summary,800)};
 return {valid:true,capsule};
}
