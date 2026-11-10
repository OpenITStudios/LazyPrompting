// Deterministic, bounded context projection; never imports another workspace's history.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const clean=(x,max)=>typeof x==="string"?x.replace(/[\x00-\x1f\x7f]/g," ").slice(0,max):"";
export function projectPromptContext({workspaceId,sessionId,taskId,goal,decisions=[],constraints=[],progress,nextAction,lastResponse}={}){
 if(![workspaceId,sessionId,taskId].every(x=>ID.test(x??""))||
    !goal||typeof goal!=="string"||!nextAction||typeof nextAction!=="string")
  return {valid:false,reason:"INVALID_CONTEXT"};
 if(lastResponse&&(lastResponse.workspaceId!==workspaceId||lastResponse.sessionId!==sessionId))
  return {valid:false,reason:"CROSS_WORKSPACE_CONTEXT"};
 const capsule={workspaceId,sessionId,taskId,goal:clean(goal,1000),
  decisions:Array.isArray(decisions)?decisions.slice(-8).map(x=>clean(x,240)):[],
  constraints:Array.isArray(constraints)?constraints.slice(-12).map(x=>clean(x,240)):[],
  progress:clean(progress,1200),nextAction:clean(nextAction,800),
  lastResponseSummary:clean(lastResponse?.summary,800)};
 return {valid:true,capsule};
}
