import assert from 'node:assert/strict';
import {CapabilityRouter} from '../src/gateway/capability-router.mjs';
import {ChatFixtureHostBridge} from '../src/browser/chat-fixture-host-bridge.mjs';
import {listCapabilities} from '../src/gateway/capability-registry.mjs';

let checks=0;
const eq=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++};
const hostSession='trusted-fixture-host-2026-11';
const origin='http://127.0.0.1:38771/fixture-chat/index.html';
const args=(workspaceId='workspace-01',promptId='prompt-01',epoch=1,overrides={})=>
  ({workspaceId,promptId,epoch,origin,text:'Synthetic task: 1 + 1',...overrides});
let grantSequence=0,dispatchCount=0,admissionCount=0,verificationCount=0;
const verified=new Set();
const host=()=>{
  const bridge=new ChatFixtureHostBridge({
    hostSession,clock:()=>0,maxActive:2,
    admit:async({workspaceId,epoch,origin})=>{
      admissionCount++;
      return {source:'NATIVE_HOST',allowed:true,workspaceId,epoch,actualUrl:origin,
        viewLabel:'browser-'+workspaceId.slice(-2),grantId:'grant-'+(++grantSequence)};
    },
    dispatch:async({text})=>{dispatchCount++;eq(text,'Synthetic task: 1 + 1','host received exact prompt');return {nativeAccepted:true};},
    verify:async({workspaceId,promptId})=>{
      verificationCount++;
      return {source:'TRUSTED_SOURCE',verified:verified.has(workspaceId+':'+promptId)};
    }
  });
  return bridge;
};
const noHost=new CapabilityRouter();
eq(listCapabilities().length,11,'catalog includes two optional fixture capabilities');
eq(noHost.describe('workspace_chat.fixture_submit').structuredContent.readiness,'DISABLED','no default admission');
eq(noHost.status().structuredContent.backends.fixture,'DISABLED','no default fixture backend');
eq((await noHost.invoke('workspace_chat.fixture_submit',args())).code,'CAPABILITY_DISABLED','production-style router cannot send');
eq(noHost.search('fixture').structuredContent.results.length,0,'test surface hidden without host');
const bridge=host();
const router=new CapabilityRouter({fixtureBridge:bridge});
eq(router.describe('workspace_chat.fixture_submit').structuredContent.readiness,'AVAILABLE','only injected fixture host exposes capability');
eq(router.search('workspace_chat').structuredContent.results.length,2,'both scoped test-only capabilities discoverable');
eq(router.status().structuredContent.backends.fixture,'TEST_HOST_ONLY','explicit backend readiness');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-01','p',0))).code,
  'INVALID_ARGUMENTS','rejects invalid epoch before host');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-11'))).code,
  'FIXTURE_SCOPE_REQUIRED','unknown workspace rejected');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-01','p',1,{origin:'https://chatgpt.com/'}))).code,
  'FIXTURE_SCOPE_REQUIRED','no chatgpt.com origin');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-01','p',1,{origin:'http://127.0.0.1/other'}))).code,
  'FIXTURE_SCOPE_REQUIRED','no arbitrary local origin');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-01','p',1,{text:''}))).code,
  'INVALID_ARGUMENTS','empty text rejected');
eq(dispatchCount,0,'no side effects on invalid requests');
let first=await router.invoke('workspace_chat.fixture_submit',args());
eq(first.status,'OK','first MCP fixture submission admitted');
eq(first.structuredContent.hostActionAccepted,true,'native action accepted, not ChatGPT completion');
eq(first.structuredContent.cycle.phase,'SEND_ATTEMPTED','native action alone is not completion');
eq(dispatchCount,1,'exactly one native dispatch');
eq((await router.invoke('workspace_chat.fixture_submit',args())).code,
  'WORKSPACE_BUSY','duplicate blocked');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-01','prompt-02'))).code,
  'WORKSPACE_BUSY','second prompt held until verified');
eq((await router.invoke('workspace_chat.fixture_status',{workspaceId:'workspace-01'})).structuredContent.cycle.promptId,
  'prompt-01','status correlates prompt');
const status=JSON.stringify((await router.invoke('workspace_chat.fixture_status',{workspaceId:'workspace-01'})).structuredContent);
eq(status.includes('Synthetic task'),false,'no prompt text exposed in status');
eq(status.includes('assistant'),false,'no assistant output exposed');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-02','prompt-02'))).status,
  'OK','second workspace admitted');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-03','prompt-03'))).code,
  'FIXTURE_CONCURRENCY_LIMIT','third workspace bounded');
eq(dispatchCount,2,'two dispatches only');
const event=(workspaceId,kind,seq,at,epoch=1,extra={})=>
  ({hostSession,workspaceId,origin,epoch,seq,kind,at,...extra});
eq(bridge.observeFromHost(event('workspace-01','STOP_VISIBLE',1,100,1,{hostSession:'invalid'})).code,
  'UNTRUSTED_FIXTURE_EVENT','untrusted observer rejected');
eq(bridge.observeFromHost(event('workspace-01','STOP_VISIBLE',1,100,1,{origin:'http://127.0.0.1:38771/fixture-chat/other'})).code,
  'UNTRUSTED_FIXTURE_EVENT','wrong fixture URL rejected');
eq(bridge.observeFromHost(event('workspace-01','STOP_VISIBLE',1,100,2)).code,
  'SESSION_MISMATCH','wrong epoch rejected');
eq(bridge.observeFromHost(event('workspace-01','STOP_VISIBLE',1,100)).status,'OK','generation observed');
eq(bridge.observeFromHost(event('workspace-01','STOP_HIDDEN',2,200)).structuredContent.cycle.phase,
  'GENERATING','no assistant activity means not completed');
eq(bridge.observeFromHost(event('workspace-01','ASSISTANT_ACTIVITY',3,300)).status,
  'OK','observed assistant activity');
eq(bridge.observeFromHost(event('workspace-01','STOP_VISIBLE',4,400)).status,
  'OK','stop visible');
eq(bridge.observeFromHost(event('workspace-01','STOP_HIDDEN',5,500)).structuredContent.cycle.phase,
  'SETTLING','start settling');
eq(bridge.observeFromHost(event('workspace-01','TICK',6,1600)).structuredContent.cycle.phase,
  'SETTLING','not yet stabilized');
eq(bridge.observeFromHost(event('workspace-01','TICK',7,1700)).structuredContent.cycle.phase,
  'UI_COMPLETED_OBSERVED','status observed after stabilization');
eq(bridge.observeFromHost(event('workspace-01','TICK',7,1800)).code,
  'INVALID_OR_REPLAYED_EVENT','no event replay');
eq((await bridge.reconcileFromHost({hostSession,workspaceId:'workspace-01',epoch:1,promptId:'prompt-01'})).code,
  'INDEPENDENT_EVIDENCE_REQUIRED','completion alone insufficient');
eq((await bridge.reconcileFromHost({hostSession,workspaceId:'workspace-01',epoch:1,promptId:'wrong'})).code,
  'PROMPT_IDENTITY_MISMATCH','wrong prompt cannot consume trusted evidence');
verified.add('workspace-01:prompt-01');
eq((await bridge.reconcileFromHost({hostSession,workspaceId:'workspace-01',epoch:1,promptId:'prompt-01'})).structuredContent.cycle.phase,
  'IDLE','verified release');
eq((await router.invoke('workspace_chat.fixture_submit',args())).code,
  'DUPLICATE_PROMPT_ID','idempotent even after release');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-03','prompt-03'))).status,
  'OK','released slot admitted');
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-04','prompt-04'))).code,
  'FIXTURE_CONCURRENCY_LIMIT','concurrency still bounded');
eq((await router.invoke('workspace_chat.fixture_status',{workspaceId:'workspace-03'})).status,
  'OK','third workspace has status');
eq((await router.invoke('workspace_chat.fixture_status',{workspaceId:'workspace-99'})).code,
  'INVALID_WORKSPACE','bad workspace status');
const failing=new ChatFixtureHostBridge({hostSession,clock:()=>0,
  admit:async({workspaceId,origin,epoch})=>({source:'NATIVE_HOST',allowed:true,workspaceId,actualUrl:origin,epoch,
    viewLabel:'browser-'+workspaceId.slice(-2),grantId:'fail-1'}),
  dispatch:async()=>{throw Error('connection lost');},
  verify:async()=>({source:'TRUSTED_SOURCE',verified:true})});
const failingRouter=new CapabilityRouter({fixtureBridge:failing});
eq((await failingRouter.invoke('workspace_chat.fixture_submit',args())).structuredContent.cycle.phase,
  'SEND_OUTCOME_UNKNOWN','uncertain dispatch held');
eq((await failingRouter.invoke('workspace_chat.fixture_submit',args('workspace-01','another'))).code,
  'WORKSPACE_BUSY','uncertain outcome never retried');
eq((await failing.reconcileFromHost({hostSession,workspaceId:'workspace-01',epoch:1,promptId:'prompt-01'})).code,
  'UI_NOT_COMPLETED','no fabricated success');
let authorize;
const held=new Promise(resolve=>{authorize=resolve;});
const raceBridge=new ChatFixtureHostBridge({hostSession,clock:()=>0,maxActive:1,
  admit:()=>held,dispatch:async()=>({nativeAccepted:true}),verify:async()=>({source:'TRUSTED_SOURCE',verified:false})});
const raceRouter=new CapabilityRouter({fixtureBridge:raceBridge});
const pending=raceRouter.invoke('workspace_chat.fixture_submit',args());
eq((await raceRouter.invoke('workspace_chat.fixture_submit',args())).code,'WORKSPACE_BUSY',
  'atomic workspace reservation before await');
eq((await raceRouter.invoke('workspace_chat.fixture_submit',args('workspace-02','two'))).code,
  'FIXTURE_CONCURRENCY_LIMIT','pending authorization consumes global slot');
authorize({source:'UNTRUSTED',allowed:true});
eq((await pending).code,'NATIVE_ADMISSION_REQUIRED','untrusted grant rejected');
const mismatchBridge=new ChatFixtureHostBridge({hostSession,clock:()=>0,
  admit:async({workspaceId,epoch,origin})=>({source:'NATIVE_HOST',allowed:true,workspaceId,epoch,
    actualUrl:origin,viewLabel:'browser-09',grantId:'wrong-view'}),
  dispatch:async()=>{throw Error('should not execute');},verify:async()=>({source:'TRUSTED_SOURCE',verified:false})});
eq((await new CapabilityRouter({fixtureBridge:mismatchBridge}).invoke('workspace_chat.fixture_submit',args())).code,
  'NATIVE_ADMISSION_REQUIRED','host view identity binding enforced');
await router.close();
eq((await router.invoke('workspace_chat.fixture_submit',args('workspace-05','five'))).code,
  'GATEWAY_CLOSED','closed router cannot send');
await noHost.close();await failingRouter.close();await raceRouter.close();
eq(verificationCount,2,'trusted verifier called exactly for eligible completed prompt');
console.log('Fixture MCP/native-host contract: PASS ('+checks+' assertions; synthetic host, no WebView2 or ChatGPT)');
