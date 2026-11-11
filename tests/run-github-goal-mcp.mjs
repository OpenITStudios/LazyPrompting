import assert from 'node:assert/strict';
import {CapabilityRouter} from '../src/gateway/capability-router.mjs';
import {getCapability,listCapabilities} from '../src/gateway/capability-registry.mjs';
let assertions=0,called=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const normal=new CapabilityRouter();
eq(listCapabilities().length,12,'catalog remains bounded');
eq(normal.describe('chat_goal.progress_review').structuredContent.readiness,'DISABLED',
  'unconfigured host cannot review');
eq((await normal.invoke('chat_goal.progress_review',{workspaceId:'workspace-01'})).code,
  'CAPABILITY_DISABLED','default tool refuses model-supplied review');
eq(normal.search('progress_review').structuredContent.results.length,0,'hidden from default search');
eq(normal.status().structuredContent.dispatch,'DISABLED','no implicit send');
const provider={inspect:async input=>{called++;return {status:'REVIEW_REQUIRED',
  reason:'TRUSTED_MILESTONE_RECEIPT_MISSING',nextPromptAllowed:false,
  workspaceId:input.workspaceId};}};
const injected=new CapabilityRouter({goalReview:provider});
eq(injected.describe('chat_goal.progress_review').structuredContent.readiness,'AVAILABLE',
  'explicit provider unlocks read-only review');
eq(getCapability('chat_goal.progress_review').effect,'READ','no mutation or send');
eq(injected.status().structuredContent.backends.goalReview,'HOST_INJECTED_READ_ONLY',
  'provider readiness labeled correctly');
eq(injected.status().structuredContent.dispatch,'DISABLED','review cannot activate dispatch');
eq(injected.search('progress_review').structuredContent.results.length,1,'review discoverable only with provider');
const result=await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-01'});
eq(result.status,'OK','read-only MCP provider responded');
eq(result.structuredContent.status,'REVIEW_REQUIRED','read-only result returned');
eq(result.structuredContent.nextPromptAllowed,false,'review never grants Send');
eq(called,1,'exactly one provider call');
eq((await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-110'})).code,
  'INVALID_ARGUMENTS','reject invalid workspace size by schema');
eq((await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-01',
  extra:'spoof'})).code,'INVALID_ARGUMENTS','no unexpected arguments');
eq((await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-01',
  proposal:{nextAction:{action:'Audit',owner:'repo',proof:'sha',invented:'grant'}}})).code,
  'INVALID_ARGUMENTS','nested tool schema rejects fake grant');
eq((await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-01',
  proposal:{outcome:'CONTINUE',nextAction:{action:'Audit',owner:'source',proof:'test'}},
  maxCommits:32,receipt:{userNote:'untrusted; verifier must reject'}})).status,'OK',
  'bounded proposal reaches injected reviewer');
eq(called,2,'only valid calls reach provider');
await injected.close();
eq((await injected.invoke('chat_goal.progress_review',{workspaceId:'workspace-01'})).code,
  'GATEWAY_CLOSED','shutdown revokes review');
eq(called,2,'no provider calls after shutdown');
await normal.close();
console.log('GitHub goal MCP capability: PASS ('+assertions+' assertions; injected test host only)');
