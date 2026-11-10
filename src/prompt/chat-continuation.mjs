// ChatGPT owns task context and optional repository work. LazyPrompting only carries chat routing.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const safe=(x,max)=>typeof x==="string"&&x.trim()&&x.length<=max&&!/[\x00-\x1f\x7f]/.test(x);
export function prepareChatContinuation({workspaceId,oldSessionId,taskId,goal,nextAction,projectHint="",pendingPrompt=false}={}){
 if(![workspaceId,oldSessionId,taskId].every(x=>ID.test(x??""))||
    !safe(goal,1200)||!safe(nextAction,800)||pendingPrompt===true||
    (projectHint!==""&&!safe(projectHint,300)))
  return {ready:false,reason:"CHAT_CONTINUATION_CONTEXT_UNSAFE"};
 const prompt=[
  "Continue the same work from the previous ChatGPT conversation.",
  "Workspace: "+workspaceId,
  "Previous chat: "+oldSessionId,
  "Task: "+taskId,
  "Goal: "+goal,
  ...(projectHint?["Project reference (not proof): "+projectHint]:[]),
  "Next requested step: "+nextAction,
  "Use ChatGPT's available context and connected sources to recover prior decisions, rules, progress and unfinished tasks.",
  "Do not assume the previous chat is fully accessible. If context is incomplete, verify with available sources or request the missing information.",
  "Do not repeat completed work, fabricate progress, or change the user's approvals.",
  "ChatGPT owns any GitHub work, repository reading and commits if needed; LazyPrompting does not.",
  "Preserve the previous chat. Continue only after identity, permissions and progress are sufficiently verified."
 ].join("\n");
 return {ready:true,workspaceId,oldSessionId,taskId,prompt};
}
