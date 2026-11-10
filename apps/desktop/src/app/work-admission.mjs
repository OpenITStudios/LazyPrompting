// Deterministic, fail-closed admission gate. No model, browser or network calls.
export const DEFAULT_LIMITS=Object.freeze({maxAttempts:2,maxSteps:12,maxTokens:12000,maxElapsedMs:120000});
const validInteger=(n,min)=>Number.isSafeInteger(n)&&n>=min;
export function admitWork(request,limits=DEFAULT_LIMITS){
 const deny=(reason)=>({allowed:false,reason});
 if(!request||typeof request!=="object"||Array.isArray(request))return deny("INVALID_REQUEST");
 if(typeof request.id!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(request.id))return deny("INVALID_ID");
 if(!/^workspace-(0[1-9]|10)$/.test(request.workspaceId??""))return deny("INVALID_WORKSPACE");
 if(request.authorized!==true)return deny("NOT_AUTHORIZED");
 if(request.transportVerified!==true)return deny("TRANSPORT_UNVERIFIED");
 if(request.paused===true||request.blocked===true)return deny("STOPPED");
 if(!limits||!validInteger(limits.maxAttempts,1)||!validInteger(limits.maxSteps,1)||!validInteger(limits.maxTokens,1)||!validInteger(limits.maxElapsedMs,1))return deny("INVALID_LIMITS");
 const {attempts,steps,tokens,elapsedMs}=request;
 if(![attempts,steps,tokens,elapsedMs].every(v=>validInteger(v,0)))return deny("INVALID_USAGE");
 if(attempts>=limits.maxAttempts)return deny("ATTEMPT_BUDGET");
 if(steps>=limits.maxSteps)return deny("STEP_BUDGET");
 if(tokens>=limits.maxTokens)return deny("TOKEN_BUDGET");
 if(elapsedMs>=limits.maxElapsedMs)return deny("TIME_BUDGET");
 return {allowed:true,reason:null};
}
export function classifyNextStep({changed=false,requiresReasoning=false,knownAction=false}={}){
 if(changed!==true)return "SKIP_UNCHANGED";
 if(knownAction===true)return "DETERMINISTIC";
 if(requiresReasoning===true)return "CODEX_HANDOFF";
 return "REVIEW_REQUIRED";
}
