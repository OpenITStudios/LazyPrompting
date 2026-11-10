// Owned, synthetic chat fixture only. This does not control chatgpt.com.
// Production outbox/session authority remains in src/prompt and the native host.
import {createHash} from 'node:crypto';

const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const PROMPT=/^[a-zA-Z0-9:_-]{1,128}$/;
const KINDS=new Set(['GENERATION_STARTED','STOP_VISIBLE','ASSISTANT_ACTIVITY',
  'STOP_HIDDEN','ERROR','MANUAL_STOP','NAVIGATION','TICK']);
const ACTIVE=new Set(['SEND_ATTEMPTED','GENERATING','SETTLING']);
const digest=s=>createHash('sha256').update(s).digest('hex');

function fixtureUrl(input){
  try {
    const url=new URL(input);
    return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&
      url.username===''&&url.password===''&&url.pathname.startsWith('/fixture-chat/');
  } catch {return false;}
}

export class ChatFixtureCycle {
  constructor({workspaceId,settleMs=1200,timeoutMs=120000,clock=Date.now}={}){
    if(!WORKSPACE.test(workspaceId??'')||!Number.isSafeInteger(settleMs)||settleMs<100||settleMs>10000||
      !Number.isSafeInteger(timeoutMs)||timeoutMs<settleMs||timeoutMs>600000||typeof clock!=='function')
      throw Error('INVALID_FIXTURE_CYCLE');
    this.workspaceId=workspaceId;
    this.settleMs=settleMs;
    this.timeoutMs=timeoutMs;
    this.clock=clock;
    this.phase='IDLE';
    this.reason=null;
    this.active=null;
    this.used=new Set();
  }
  status(){
    const p=this.active;
    return Object.freeze({workspaceId:this.workspaceId,phase:this.phase,reason:this.reason,
      epoch:p?.epoch??null,promptId:p?.promptId??null,promptDigest:p?.promptDigest??null,
      lastSeq:p?.lastSeq??null,observedCompletion:this.phase==='UI_COMPLETED_OBSERVED'});
  }
  reserve({epoch,promptId,text,origin}={}){
    if(this.phase!=='IDLE')return {reserved:false,reason:'WORKSPACE_BUSY'};
    if(!Number.isSafeInteger(epoch)||epoch<1||!PROMPT.test(promptId??'')||
      typeof text!=='string'||!text.trim()||text.length>12000||!fixtureUrl(origin))
      return {reserved:false,reason:'FIXTURE_SCOPE_REQUIRED'};
    const key=`${epoch}:${promptId}`;
    if(this.used.has(key))return {reserved:false,reason:'DUPLICATE_PROMPT_ID'};
    this.used.add(key);
    this.active={epoch,promptId,promptDigest:digest(text),key,lastSeq:0,
      lastAt:this.clock(),reservedAt:this.clock(),seenStart:false,seenAssistant:false,
      stopVisible:false,settleAt:null};
    this.phase='RESERVED';this.reason=null;
    return {reserved:true,status:this.status()};
  }
  async submit(send){
    if(this.phase!=='RESERVED'||typeof send!=='function')
      return {attempted:false,reason:'NOT_RESERVED_OR_ALREADY_ATTEMPTED'};
    // Mark the potential side effect BEFORE awaiting its delivery outcome.
    this.phase='SEND_ATTEMPTED';
    try {
      const response=await send();
      if(response?.accepted===true)return {attempted:true,acknowledged:true,status:this.status()};
      if(ACTIVE.has(this.phase)){
        this.phase='SEND_OUTCOME_UNKNOWN';this.reason='NO_HOST_ACK';
      }
      return {attempted:true,acknowledged:false,status:this.status()};
    } catch {
      if(ACTIVE.has(this.phase)){
        this.phase='SEND_OUTCOME_UNKNOWN';this.reason='SEND_EXCEPTION';
      }
      return {attempted:true,acknowledged:false,status:this.status()};
    }
  }
  observe({workspaceId,epoch,seq,kind,at}={}){
    const p=this.active;
    if(!p||workspaceId!==this.workspaceId||epoch!==p.epoch)
      return {accepted:false,reason:'SESSION_MISMATCH'};
    if(!Number.isSafeInteger(seq)||seq<=p.lastSeq||!Number.isSafeInteger(at)||at<p.lastAt||!KINDS.has(kind))
      return {accepted:false,reason:'INVALID_OR_REPLAYED_EVENT'};
    p.lastSeq=seq;p.lastAt=at;
    const terminal=new Set(['UI_COMPLETED_OBSERVED','ERROR','INTERRUPTED','UNKNOWN','SEND_OUTCOME_UNKNOWN']);
    if(terminal.has(this.phase))return {accepted:false,reason:'CYCLE_TERMINAL',status:this.status()};
    if(this.phase==='RESERVED')return {accepted:false,reason:'SEND_NOT_ATTEMPTED',status:this.status()};
    if(kind==='ERROR'||kind==='MANUAL_STOP'||kind==='NAVIGATION'){
      this.phase=kind==='ERROR'?'ERROR':kind==='MANUAL_STOP'?'INTERRUPTED':'UNKNOWN';
      this.reason=kind;return {accepted:true,status:this.status()};
    }
    if(kind==='TICK'){
      if(at-p.reservedAt>=this.timeoutMs){this.phase='UNKNOWN';this.reason='TIMEOUT';}
      else if(this.phase==='SETTLING'&&p.seenStart&&p.seenAssistant&&!p.stopVisible&&
        at-p.settleAt>=this.settleMs){this.phase='UI_COMPLETED_OBSERVED';this.reason=null;}
      return {accepted:true,status:this.status()};
    }
    if(kind==='GENERATION_STARTED'||kind==='STOP_VISIBLE'){
      p.seenStart=true;
      if(kind==='STOP_VISIBLE')p.stopVisible=true;
      p.settleAt=null;this.phase='GENERATING';
    } else if(kind==='ASSISTANT_ACTIVITY'){
      p.seenAssistant=true;
      p.settleAt=null;this.phase='GENERATING';
    } else if(kind==='STOP_HIDDEN'){
      p.stopVisible=false;
      if(p.seenStart&&p.seenAssistant){p.settleAt=at;this.phase='SETTLING';}
    }
    return {accepted:true,status:this.status()};
  }
  releaseAfterVerifiedEvidence({epoch,promptId,verified}={}){
    if(verified!==true||this.phase!=='UI_COMPLETED_OBSERVED'||
      this.active?.epoch!==epoch||this.active?.promptId!==promptId)
      return {released:false,reason:'INDEPENDENT_EVIDENCE_REQUIRED'};
    this.active=null;this.phase='IDLE';this.reason=null;
    return {released:true,status:this.status()};
  }
}
