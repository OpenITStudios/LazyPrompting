// Test-only Codex/MCP -> trusted host -> synthetic browser adapter.
// This class does NOT install an extension or automate a ChatGPT session.
// Production outbox, native IPC credentials and permission grants remain
// separate owners; the ephemeral state here must never be used as durable proof.
import {ChatFixtureCycle} from './chat-fixture-cycle.mjs';

const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const ok=data=>({status:'OK',structuredContent:data});
const fail=code=>({status:'ERROR',code});
const label=id=>'browser-'+id.slice(-2);
function fixtureUrl(value){
  try{
    const u=new URL(value);
    return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&!u.username&&!u.password&&
      u.pathname.startsWith('/fixture-chat/')&&!u.hash;
  }catch{return false;}
}
export class ChatFixtureHostBridge {
  #admit;#dispatch;#verify;#clock;#max;#session;
  #cycles=new Map();#origins=new Map();#pending=new Set();#grants=new Set();#closed=false;

  constructor({admit,dispatch,verify,hostSession,clock=()=>Date.now(),maxActive=2}={}){
    if([admit,dispatch,verify,clock].some(fn=>typeof fn!=='function')||
      typeof hostSession!=='string'||hostSession.length<16||hostSession.length>128||
      !Number.isSafeInteger(maxActive)||maxActive<1||maxActive>10)
      throw Error('TRUSTED_FIXTURE_HOST_REQUIRED');
    this.#admit=admit;this.#dispatch=dispatch;this.#verify=verify;
    this.#session=hostSession;this.#clock=clock;this.#max=maxActive;
  }
  status({workspaceId}={}){
    if(!WORKSPACE.test(workspaceId??''))return fail('INVALID_WORKSPACE');
    const cycle=this.#cycles.get(workspaceId);
    return ok({fixtureOnly:true,workspaceId,phase:cycle?.status().phase??'IDLE',
      ...(cycle?{cycle:cycle.status()}:{})});
  }
  async submit({workspaceId,epoch,promptId,origin,text}={}){
    if(this.#closed)return fail('FIXTURE_BRIDGE_CLOSED');
    if(!WORKSPACE.test(workspaceId??'')||!Number.isSafeInteger(epoch)||epoch<1||
       !ID.test(promptId??'')||!fixtureUrl(origin)||
       typeof text!=='string'||!text.trim()||text.length>12000)
      return fail('FIXTURE_SCOPE_REQUIRED');
    if(this.#pending.has(workspaceId))return fail('WORKSPACE_BUSY');
    const cycle=this.#cycles.get(workspaceId);
    if(cycle&&cycle.status().phase!=='IDLE')return fail('WORKSPACE_BUSY');
    const active=new Set([...this.#cycles].filter(([,c])=>c.status().phase!=='IDLE').map(([id])=>id));
    for(const id of this.#pending)active.add(id);
    if(active.size>=this.#max)return fail('FIXTURE_CONCURRENCY_LIMIT');
    // Acquire synchronously before awaiting host admission to prevent parallel
    // submit calls crossing authorization or global-capacity checks.
    this.#pending.add(workspaceId);
    try{
      let grant;
      try{grant=await this.#admit({workspaceId,epoch,promptId,origin});}
      catch{return fail('NATIVE_ADMISSION_UNAVAILABLE');}
      if(this.#closed)return fail('FIXTURE_BRIDGE_CLOSED');
      if(grant?.source!=='NATIVE_HOST'||grant.allowed!==true||
         grant.workspaceId!==workspaceId||grant.epoch!==epoch||
         grant.viewLabel!==label(workspaceId)||grant.actualUrl!==origin||
         !ID.test(grant.grantId??'')||this.#grants.has(grant.grantId))
        return fail('NATIVE_ADMISSION_REQUIRED');
      if(this.#grants.size>=1000)return fail('FIXTURE_GRANT_LIMIT');
      // Consumed before the first possible browser side effect.
      this.#grants.add(grant.grantId);
      const instance=cycle??new ChatFixtureCycle({workspaceId,clock:this.#clock});
      if(!cycle)this.#cycles.set(workspaceId,instance);
      const reservation=instance.reserve({epoch,promptId,text,origin});
      if(!reservation.reserved)return fail(reservation.reason);
      this.#origins.set(workspaceId,origin);
      const response=await instance.submit(async()=>{
        const executed=await this.#dispatch({workspaceId,epoch,promptId,origin,text,
          viewLabel:label(workspaceId),grantId:grant.grantId});
        // This means only that the trusted fixture host accepted a UI action;
        // NOT that ChatGPT accepted or completed a turn.
        return {accepted:executed?.nativeAccepted===true};
      });
      return ok({fixtureOnly:true,workspaceId,promptId,
        hostActionAccepted:response.acknowledged===true,cycle:instance.status()});
    }finally{this.#pending.delete(workspaceId);}
  }
  // Native-only callback. Intentionally NOT registered as an MCP capability.
  observeFromHost({hostSession,workspaceId,origin,epoch,seq,kind,at}={}){
    if(hostSession!==this.#session||this.#closed||!fixtureUrl(origin)||
      this.#origins.get(workspaceId)!==origin)
      return fail('UNTRUSTED_FIXTURE_EVENT');
    const cycle=this.#cycles.get(workspaceId);
    if(!cycle)return fail('WORKSPACE_NOT_ACTIVE');
    if(cycle.status().epoch!==epoch)return fail('SESSION_MISMATCH');
    // The host must verify the actual origin and view before invoking this.
    const result=cycle.observe({workspaceId,epoch,seq,kind,at});
    return result.accepted?ok({fixtureOnly:true,cycle:cycle.status()}):fail(result.reason);
  }
  // Native-only receipt reconciliation. A model must not supply "verified".
  async reconcileFromHost({hostSession,workspaceId,epoch,promptId}={}){
    if(hostSession!==this.#session||this.#closed)return fail('UNTRUSTED_FIXTURE_EVENT');
    const cycle=this.#cycles.get(workspaceId);
    if(!cycle)return fail('WORKSPACE_NOT_ACTIVE');
    if(cycle.status().phase!=='UI_COMPLETED_OBSERVED')return fail('UI_NOT_COMPLETED');
    if(cycle.status().epoch!==epoch||cycle.status().promptId!==promptId)
      return fail('PROMPT_IDENTITY_MISMATCH');
    let verified=false;
    try{
      const proof=await this.#verify({workspaceId,epoch,promptId});
      verified=proof?.source==='TRUSTED_SOURCE'&&proof.verified===true;
    }catch{return fail('EVIDENCE_UNAVAILABLE');}
    const outcome=cycle.releaseAfterVerifiedEvidence({epoch,promptId,verified});
    if(outcome.released)this.#origins.delete(workspaceId);
    return outcome.released?ok({fixtureOnly:true,cycle:cycle.status()}):fail(outcome.reason);
  }
  close(){this.#closed=true;}
}
