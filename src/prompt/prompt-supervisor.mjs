// Prompt-only control plane: never performs repository writes or browser scraping.
// ChatGPT is the worker; responses are untrusted observations, not execution proof.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const allowed=new Set(["READY","PAUSED","WAITING","BLOCKED","STOPPED"]);
export function planNextPrompt({workspace,observation}={}){
 const deny=(status,reason)=>({status,reason,prompt:null});
 if(!workspace||!ID.test(workspace.workspaceId??"")||!ID.test(workspace.sessionId??"")||
    !ID.test(workspace.taskId??"")||!allowed.has(workspace.status)||
    !Number.isSafeInteger(workspace.contextRevision)||workspace.contextRevision<0)
   return deny("BLOCKED","INVALID_WORKSPACE_CONTEXT");
 if(workspace.status!=="READY")return deny(workspace.status,"WORKSPACE_NOT_READY");
 if(!workspace.transportApproved)return deny("BLOCKED","CHAT_TRANSPORT_UNVERIFIED");
 if(!Number.isSafeInteger(workspace.remainingPrompts)||workspace.remainingPrompts<1)
   return deny("STOPPED","PROMPT_BUDGET_EXHAUSTED");
 if(workspace.pendingPromptId)return deny("WAITING","PROMPT_ALREADY_PENDING");
 if(!observation||observation.complete!==true||!ID.test(observation.responseId??"")||
    observation.sessionId!==workspace.sessionId||observation.workspaceId!==workspace.workspaceId||
    observation.contextRevision!==workspace.contextRevision)
   return deny("WAITING","RESPONSE_NOT_VERIFIED_FOR_WORKSPACE");
 if(observation.requiresApproval===true)return deny("PAUSED","CHATGPT_REQUESTED_APPROVAL");
 if(observation.blocked===true)return deny("BLOCKED","CHATGPT_BLOCKED");
 if(observation.goalComplete===true)return deny("DONE","GOAL_REPORTED_COMPLETE_REQUIRES_HOST_CONFIRMATION");
 if(observation.responseId===workspace.lastResponseId)return deny("WAITING","DUPLICATE_RESPONSE");
 const next=workspace.nextAction;
 if(!next||typeof next!=="string"||!next.trim()||next.length>1200||
    /[\x00-\x08\x0b-\x1f\x7f]/.test(next))
   return deny("BLOCKED","NEXT_ACTION_NOT_DEFINED");
 const constraints=Array.isArray(workspace.constraints)?workspace.constraints.filter(x=>typeof x==="string"&&x.length<=300).slice(0,12):[];
 const prompt=[
  workspace.kind==="localCodex"?"Continue only the work in this managed Codex thread.":"Continue only the work in this ChatGPT conversation.",
  "Workspace: "+workspace.workspaceId+". Task: "+workspace.taskId+".",
  "Goal: "+String(workspace.goal??"").slice(0,1200)+".",
  "Next priority: "+next+".",
  "Preserve prior approved decisions and repository-specific rules.",
  ...constraints.map(x=>"Constraint: "+x),
  "First inspect current evidence; do not infer success from earlier claims.",
  workspace.kind==="localCodex"?"Perform the approved read-only step within the workspace.":"Perform the next bounded useful step using ChatGPT's available tools and permissions.",
  "Do not treat this prompt as authorization for GitHub writes, deployments, or other material actions.",
  "If blocked, report the exact blocker. Stop when approval or new information is required."
 ].join("\n");
 return {status:"READY_TO_SEND",reason:"CONTEXT_BOUND_PROMPT",workspaceId:workspace.workspaceId,
  sessionId:workspace.sessionId,taskId:workspace.taskId,contextRevision:workspace.contextRevision,prompt};
}
