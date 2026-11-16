import {createHash} from "node:crypto";
import {PromptOutbox} from "../prompt/prompt-outbox.mjs";

// OFF BY DEFAULT. This is a separate, explicitly selected, billed
// OpenAI Platform API conversation: NEVER consumer chatgpt.com/c/<id>.
// No native/UI/MCP/Code Mode route is registered for this module.
// The installed host must inject an approved SDK client, its canonical
// PromptOutbox and a real native per-turn authorization callback.
const API_WORKSPACE=/^api-workspace-(0[1-9]|10)$/;
const CONVERSATION=/^conv_[A-Za-z0-9_-]{1,128}$/;
const RESPONSE=/^resp_[A-Za-z0-9_-]{1,128}$/;
const TURN=/^api-turn-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MODEL=/^[a-zA-Z][a-zA-Z0-9_.-]{1,79}$/;
const MAX_TEXT=16000;
const digest=s=>createHash("sha256").update(s).digest("hex");
const matchesResponseModel=(actual,requested)=>
 typeof actual==="string"&&(actual===requested||actual.startsWith(requested+"-"));

function extractCompletedText(response){
 if(!Array.isArray(response.output)||response.output.length>128)
  throw Error("API_RESPONSE_OUTPUT_UNVERIFIED");
 const texts=[];
 for(const item of response.output){
  if(item?.type!=="message")continue;
  if(item.role!=="assistant"||item.status!=="completed"||
     !Array.isArray(item.content))throw Error("API_RESPONSE_OUTPUT_UNVERIFIED");
  for(const part of item.content){
   if(part?.type==="refusal")throw Error("API_RESPONSE_REFUSAL_REQUIRES_REVIEW");
   if(part?.type==="output_text"){
    if(typeof part.text!=="string")throw Error("API_RESPONSE_OUTPUT_UNVERIFIED");
    texts.push(part.text);
   }
  }
 }
 const text=texts.join("\n").trim();
 if(!text||text.length>MAX_TEXT)throw Error("API_RESPONSE_OUTPUT_UNVERIFIED");
 return text;
}

// Pure, no side effect. The ordinary ChatGPT transport gate deliberately
// continues to reject all Responses API manifests.
export function assessOptionalResponsesTurn(request={}){
 if(!request||typeof request!=="object"||Array.isArray(request)||
    Object.keys(request).sort().join(",")!==
    "apiConversationId,contextRevision,maxOutputTokens,mode,model,prompt,turnId,workspaceId")
  return {ready:false,reason:"API_TURN_SCOPE_INVALID"};
 const {apiConversationId,contextRevision,maxOutputTokens,mode,model,
  prompt,turnId,workspaceId}=request;
 if(mode!=="EXPLICIT_OPENAI_API"||
    !API_WORKSPACE.test(workspaceId??"")||
    !CONVERSATION.test(apiConversationId??"")||
    !TURN.test(turnId??"")||!MODEL.test(model??"")||
    typeof prompt!=="string"||!prompt.trim()||prompt.length>12000||
    !Number.isSafeInteger(contextRevision)||contextRevision<0||
    contextRevision>999||
    !Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||
    maxOutputTokens>2048)
  return {ready:false,reason:"API_TURN_SCOPE_INVALID"};
 return {ready:true,product:"RESPONSES_API",consumerChat:false,
  promptDigest:digest(prompt),nextPromptAllowed:false};
}

export class OptionalOpenAIResponsesTurn {
 constructor({client,outbox,authorizeTurn,maxTurns=8}={}){
  if(!(outbox instanceof PromptOutbox)||
     typeof client?.responses?.create!=="function"||
     typeof authorizeTurn!=="function"||
     !Number.isSafeInteger(maxTurns)||maxTurns<1||maxTurns>32)
   throw Error("API_HOST_NOT_CONFIGURED");
  this.client=client;
  this.outbox=outbox;
  this.authorizeTurn=authorizeTurn;
  this.maxTurns=maxTurns;
 }
 async submitOne(request={}){
  const admission=assessOptionalResponsesTurn(request);
  if(!admission.ready)throw Error(admission.reason);
  const {workspaceId,apiConversationId,model,prompt,turnId,
   maxOutputTokens,contextRevision}=request;
  // This callback is supplied exclusively by a verified installed
  // native host. Caller-provided approved:true flags are NOT accepted.
  const permit=await this.authorizeTurn({
   product:"RESPONSES_API",workspaceId,apiConversationId,model,turnId,
   maxOutputTokens,contextRevision,promptDigest:admission.promptDigest
  });
  if(!permit||permit.source!=="TRUSTED_NATIVE_API_APPROVAL"||
     permit.approved!==true||permit.product!=="RESPONSES_API"||
     permit.workspaceId!==workspaceId||
     permit.apiConversationId!==apiConversationId||
     permit.model!==model||permit.turnId!==turnId||
     permit.maxOutputTokens!==maxOutputTokens||
     permit.contextRevision!==contextRevision||
     permit.promptDigest!==admission.promptDigest)
   throw Error("API_TURN_NATIVE_APPROVAL_REQUIRED");

  // The original source-owned PromptOutbox has the only durable
  // reservation. There is no automatic retry after any uncertain
  // network outcome. Pending rows must be reconciled by the host.
  const reserved=await this.outbox.reserve({
   workspaceId,sessionId:apiConversationId,taskId:turnId,
   contextRevision,prompt,promptLimit:this.maxTurns,maxConcurrent:1,
   singleDispatchPerTask:true
  });
  if(!reserved.reserved)throw Error(reserved.reason??"API_TURN_RESERVATION_HELD");

  // EXACTLY ONE request to the official Responses API. Do not create
  // arbitrary ChatGPT browser sessions or send a model-selected followup.
  const response=await this.client.responses.create({
   model,conversation:apiConversationId,
   input:[{role:"user",content:prompt}],
   max_output_tokens:maxOutputTokens,
   background:false,stream:false,tools:[]
  });
  const responseId=response?.id;
  const associated=typeof response?.conversation==="string"
   ?response.conversation:response?.conversation?.id;
  if(!RESPONSE.test(responseId??"")||
     associated!==apiConversationId||
     !matchesResponseModel(response.model,model))
   throw Error("API_RESPONSE_IDENTITY_UNVERIFIED");

  await this.outbox.ack({workspaceId,promptId:reserved.promptId,
   hostReceipt:{responseHandle:responseId}});
  if(response.status!=="completed")
   throw Error("API_RESPONSE_NOT_COMPLETED");
  const outputText=extractCompletedText(response);
  const usage=response.usage;
  if(!usage||!["input_tokens","output_tokens","total_tokens"].every(k=>
     Number.isSafeInteger(usage[k])&&usage[k]>=0)||
     usage.total_tokens<usage.input_tokens||
     usage.total_tokens<usage.output_tokens)
   throw Error("API_RESPONSE_USAGE_UNVERIFIED");

  await this.outbox.reconcile({workspaceId,promptId:reserved.promptId,
   responseId,verified:true});
  // API provider-completed output != independent acceptance or ChatGPT
  // consumer answer. The output is returned only to the trusted caller,
  // never stored in PromptOutbox, public MCP, Code Mode or UI by default.
  return {source:"OPENAI_RESPONSES_API_ONLY",apiConversationId,responseId,
   outputText,usage:{inputTokens:usage.input_tokens,
    outputTokens:usage.output_tokens,totalTokens:usage.total_tokens},
   state:"API_RESPONSE_COMPLETED",consumerChat:false,
   qa:"NOT_VERIFIED",nextPromptAllowed:false};
 }
}
