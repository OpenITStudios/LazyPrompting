import {CodexAppServer, isTransportFailure} from '../../transport/codex-app-server.mjs';
import {isAbsolute} from 'node:path';

// Existing Codex v1 runner is intentionally untouched. This adapter exposes
// official App Server semantics for a future, host-authorized v2 runner.
// A dedicated instance belongs to one goal; never reuse it between tenants.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{64}$/;
export class CodexAppServerBackend {
  #config;
  #host;
  #server;
  #sessionId;
  #scopeHash;
  #dispatches=new Set();
  #closed=false;
  constructor({executable,cwd,host,newServer=config=>new CodexAppServer(config)}={}) {
    if (typeof executable!=='string'||!isAbsolute(executable)||
        typeof cwd!=='string'||!isAbsolute(cwd)||
        !host||typeof host.attestCodexRuntime!=='function'||
        typeof host.authorizeReadOnly!=='function'||
        typeof newServer!=='function')
      throw Error('CODEX_ADAPTER_TRUSTED_HOST_REQUIRED');
    this.#config={executable,cwd,newServer};this.#host=host;
  }
  async probe(){
    const proof=await this.#host.attestCodexRuntime({
      executable:this.#config.executable,cwd:this.#config.cwd});
    if (proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
        !Array.isArray(proof.launchOptions)||proof.launchOptions.length>64||
        proof.launchOptions.some(x=>typeof x!=='string'||x.length>1024))
      return {ready:false,reason:'CODEX_RUNTIME_NOT_ATTESTED'};
    return {ready:true,launchOptions:proof.launchOptions};
  }
  async #ensure(scopeHash) {
    if (this.#closed)throw Error('CODEX_ADAPTER_CLOSED');
    if (!SHA.test(scopeHash??'') || (this.#scopeHash && this.#scopeHash!==scopeHash))
      throw Error('CODEX_ADAPTER_SCOPE_MISMATCH');
    if (this.#server)return;
    const check=await this.probe();
    if (!check.ready)throw Error(check.reason);
    const isolation=await this.#host.authorizeReadOnly({cwd:this.#config.cwd,scopeHash});
    if (isolation?.source!=='TRUSTED_HOST'||isolation?.verified!==true||
        isolation?.scopeHash!==scopeHash)
      throw Error('CODEX_READ_ONLY_UNVERIFIED');
    const server=this.#config.newServer({executable:this.#config.executable,
      cwd:this.#config.cwd,launchOptions:check.launchOptions,onEvent:()=>{}});
    try{await server.initialize();this.#server=server;this.#scopeHash=scopeHash;}
    catch(error){await server.close();throw error;}
  }
  async openSession({cwd,scopeHash,readOnly}={}) {
    if (readOnly!==true||cwd!==this.#config.cwd)
      throw Error('CODEX_ADAPTER_SCOPE_MISMATCH');
    await this.#ensure(scopeHash);
    if (this.#sessionId)throw Error('CODEX_ADAPTER_SESSION_ALREADY_BOUND');
    const response=await this.#server.startThread(cwd);
    const sessionId=response?.thread?.id;
    if (!ID.test(sessionId??''))throw Error('CODEX_ADAPTER_SESSION_UNCONFIRMED');
    this.#sessionId=sessionId;
    return {sessionId};
  }
  async resumeSession({sessionId,scopeHash,readOnly}={}) {
    if (readOnly!==true||!ID.test(sessionId??'')||
        (this.#sessionId && this.#sessionId!==sessionId))
      throw Error('CODEX_ADAPTER_SCOPE_MISMATCH');
    await this.#ensure(scopeHash);
    await this.#server.ensureThread(sessionId);
    this.#sessionId=sessionId;
    return {sessionId};
  }
  async submitTurn({sessionId,dispatchId,prompt,scopeHash,readOnly}={}) {
    if (readOnly!==true||sessionId!==this.#sessionId||
        scopeHash!==this.#scopeHash||!ID.test(dispatchId??'')||
        typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)
      throw Error('CODEX_ADAPTER_TURN_INVALID');
    // Reserve this dispatch identity before the external call. A lost
    // acknowledgment is uncertain, never permission to send a duplicate.
    if (this.#dispatches.has(dispatchId))
      throw Error('CODEX_ADAPTER_DISPATCH_ALREADY_USED');
    this.#dispatches.add(dispatchId);
    const response=await this.#server.startTurn(sessionId,prompt);
    const turnId=response?.turn?.id;
    if (!ID.test(turnId??''))throw Error('CODEX_ADAPTER_TURN_UNCONFIRMED');
    return {sessionId,turnId};
  }
  async observeTurn(receipt) {
    if (!receipt||receipt.sessionId!==this.#sessionId||
        receipt.scopeHash!==this.#scopeHash||!ID.test(receipt.dispatchId??'')||
        !ID.test(receipt.turnId??''))throw Error('CODEX_ADAPTER_RECEIPT_INVALID');
    let response;
    try{response=await this.#server.listRecentTurns(receipt.sessionId,20);}
    catch(error){if(isTransportFailure(error))return {state:'UNKNOWN',receipt};throw error;}
    const turn=response?.data?.find(x=>x.id===receipt.turnId);
    if(!turn)return {state:'UNKNOWN',receipt};
    if(turn.status==='inProgress')return {state:'RUNNING',receipt};
    if(turn.status!=='completed')return {state:'FAILED',receipt};
    const items=await this.#server.listRecentTurnItems(receipt.sessionId,receipt.turnId);
    const message=items?.data?.find(x=>x.turnId===receipt.turnId &&
      x.item?.type==='agentMessage'&&x.item?.phase!=='commentary')?.item;
    if(typeof message?.text!=='string')return {state:'UNKNOWN',receipt};
    return {state:'COMPLETED',receipt,resultRef:receipt.turnId};
  }
  async cancelTurn(receipt){
    if(!receipt||receipt.sessionId!==this.#sessionId||
       receipt.scopeHash!==this.#scopeHash||!ID.test(receipt.dispatchId??'')||
       !ID.test(receipt.turnId??''))
      throw Error('CODEX_ADAPTER_RECEIPT_INVALID');
    try{await this.#server.interruptTurn(receipt.sessionId,receipt.turnId);return 'CONFIRMED';}
    catch{return 'UNKNOWN';}
  }
  async close(){
    if(this.#closed)return;
    this.#closed=true;
    await this.#server?.close();
  }
}
