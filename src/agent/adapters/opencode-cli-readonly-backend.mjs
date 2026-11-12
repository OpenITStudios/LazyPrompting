import {parseOpenCodeJsonl} from './opencode-jsonl.mjs';
import {normalizeNativeIoCandidate,fingerprintNativeIoCandidate}
  from '../native-io-candidate.mjs';
import {isAbsolute} from 'node:path';

// OpenCode v2 worker adapter. No automatic CLI launch, implicit user login, or
// code-writing authority. The native host supplies an independently sandboxed
// executor and a session authority (e.g. its official SDK). Agent permissions
// alone are not an OS write boundary.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export class OpenCodeCliReadOnlyBackend {
  #host;
  #executable;
  #cwd;
  #scopeHash;
  #sessionId;
  #last=new Map();
  #dispatches=new Set();
  #nativeRunId;
  #closed=false;
  constructor({executable,cwd,runId=null,host}={}) {
    if(typeof executable!=='string'||!isAbsolute(executable)||typeof cwd!=='string'||!isAbsolute(cwd)||
      !host||['attestReadOnlyHost','createSession','resumeSession',
        'runIsolated','reconcileTurn','interrupt','close'].some(name=>
        typeof host[name]!=='function'))
      throw Error('OPENCODE_TRUSTED_HOST_REQUIRED');
    if(runId!==null&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/.test(runId))
      throw Error('OPENCODE_NATIVE_RUN_ID_INVALID');
    this.#nativeRunId=runId;
    this.#host=host;this.#executable=executable;this.#cwd=cwd;
  }
  async probe(scopeHash=this.#scopeHash){
    if(typeof scopeHash!=='string'||!/^[a-f0-9]{64}$/.test(scopeHash))
      return {ready:false,reason:'OPENCODE_SCOPE_NOT_BOUND'};
    const proof=await this.#host.attestReadOnlyHost({executable:this.#executable,
      cwd:this.#cwd,scopeHash});
    return {ready:proof?.source==='TRUSTED_HOST'&&proof?.verified===true&&
      proof?.sandboxVerified===true&&proof?.scopeHash===scopeHash,
      ...(proof?.runtimeVersion?{runtimeVersion:proof.runtimeVersion}:{})};
  }
  async openSession({cwd,scopeHash,readOnly}={}) {
    if(this.#closed||readOnly!==true||cwd!==this.#cwd||
       typeof scopeHash!=='string'||!/^[a-f0-9]{64}$/.test(scopeHash))
      throw Error('OPENCODE_READ_ONLY_SCOPE_REQUIRED');
    if(this.#sessionId)throw Error('OPENCODE_SESSION_ALREADY_BOUND');
    const checked=await this.probe(scopeHash);
    if(!checked.ready)throw Error('OPENCODE_NATIVE_SANDBOX_UNVERIFIED');
    const result=await this.#host.createSession({cwd,scopeHash});
    if(!ID.test(result?.sessionId??''))throw Error('OPENCODE_SESSION_UNVERIFIED');
    this.#sessionId=result.sessionId;this.#scopeHash=scopeHash;
    return {sessionId:result.sessionId};
  }
  async resumeSession({sessionId,scopeHash,readOnly}={}) {
    if(this.#closed||readOnly!==true||!ID.test(sessionId??'')||
        (this.#sessionId&&this.#sessionId!==sessionId)||
        (this.#scopeHash&&this.#scopeHash!==scopeHash))
      throw Error('OPENCODE_RESUME_SCOPE_MISMATCH');
    if(!(await this.probe(scopeHash)).ready)
      throw Error('OPENCODE_NATIVE_SANDBOX_UNVERIFIED');
    const proof=await this.#host.resumeSession({sessionId,scopeHash,cwd:this.#cwd});
    if(proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
        proof?.sessionId!==sessionId)throw Error('OPENCODE_RESUME_UNVERIFIED');
    this.#sessionId=sessionId;this.#scopeHash=scopeHash;
    return {sessionId};
  }
  async submitTurn({sessionId,dispatchId,prompt,scopeHash,readOnly}={}) {
    if(this.#closed||sessionId!==this.#sessionId||scopeHash!==this.#scopeHash||
       readOnly!==true||!ID.test(dispatchId??'')||
       typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)
      throw Error('OPENCODE_TURN_SCOPE_MISMATCH');
    if(this.#dispatches.has(dispatchId))
      throw Error('OPENCODE_DISPATCH_ALREADY_USED');
    this.#dispatches.add(dispatchId);
    // No --auto, --agent build, shell or generic flags. Even the explore agent
    // permits shell; the native host's tested OS sandbox is mandatory.
    // The host sets the working directory in the isolated process launch.
    // Do not invent a --dir flag: current official `opencode run` docs do
    // not advertise it as a supported run option.
    const args=['run','--standalone','--format','json','--agent','explore',
      '--session',sessionId,prompt];
    const result=await this.#host.runIsolated({executable:this.#executable,
      cwd:this.#cwd,scopeHash,sessionId,dispatchId,args,stdin:'null'});
    // New native capture path does not return raw transcripts. It returns
    // bounded host-process output metadata only. The host must independently
    // attest OS process ownership before querying the provider's persisted
    // session. A clean CLI event stream is never sufficient by itself.
    if(result?.ioCandidate!==undefined) {
      if(typeof this.#host.attestCapturedOutput!=='function'||!this.#nativeRunId||
         result.stdout!==undefined||result.stderr!==undefined)
        throw Error('OPENCODE_NATIVE_CAPTURE_HOST_REQUIRED');
      const expected={runId:this.#nativeRunId,dispatchId,sessionId,
        scopeHash,profileId:'opencode-local'};
      const candidate=normalizeNativeIoCandidate(result.ioCandidate,expected);
      if(result.exitCode!==undefined&&result.exitCode!==candidate.exitCode)
        throw Error('OPENCODE_NATIVE_CAPTURE_EXIT_CONFLICT');
      const candidateDigest=fingerprintNativeIoCandidate(candidate,expected);
      const nativeProof=await this.#host.attestCapturedOutput({
        runId:this.#nativeRunId,dispatchId,sessionId,scopeHash,
        processId:candidate.processId,candidateDigest
      });
      if(nativeProof?.source!=='TRUSTED_HOST'||
         nativeProof?.verified!==true||
         nativeProof?.runId!==this.#nativeRunId||
         nativeProof?.dispatchId!==dispatchId||
         nativeProof?.sessionId!==sessionId||
         nativeProof?.scopeHash!==scopeHash||
         nativeProof?.processId!==candidate.processId||
         nativeProof?.candidateDigest!==candidateDigest)
        throw Error('OPENCODE_NATIVE_CAPTURE_NOT_ATTESTED');
      const recoverable=candidate.disposition==='TERMINAL_CANDIDATE'||
        (candidate.disposition==='RECONCILE_REQUIRED'&&
         candidate.reason==='AGENT_IO_TERMINAL_MISSING'&&
         candidate.exitCode===0&&candidate.candidateTurnId!==null);
      if(!recoverable)
        throw Error('OPENCODE_NATIVE_CAPTURE_RECONCILE_REQUIRED');
      const turnId=candidate.candidateTurnId;
      const proof=await this.#host.reconcileTurn({
        sessionId,turnId,dispatchId,scopeHash
      });
      if(proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
         proof?.sessionId!==sessionId||proof?.turnId!==turnId||
         proof?.dispatchId!==dispatchId||proof?.scopeHash!==scopeHash||
         proof?.state!=='COMPLETED'||proof?.resultRef!==turnId)
        throw Error('OPENCODE_PROVIDER_RECONCILE_REQUIRED');
      this.#last.set(turnId,{state:'COMPLETED',resultRef:turnId});
      return {sessionId,turnId};
    }
    // Legacy host-injected CLI fixture mode remains versioned and separate.
    // This fallback is not an OS sandbox or production attestation.
    if(typeof result?.stdout!=='string'||!Number.isInteger(result?.exitCode))
      throw Error('OPENCODE_DISPATCH_OUTCOME_UNKNOWN');
    const parsed=parseOpenCodeJsonl(result.stdout,{sessionId,exitCode:result.exitCode});
    if(parsed.state==='COMPLETED') {
      this.#last.set(parsed.turnId,parsed);
      return {sessionId,turnId:parsed.turnId};
    }
    // OpenCode v2 can lose the final step_finish event on an otherwise
    // completed CLI run. A text message is *not* terminal evidence. Only a
    // separately verified native host correlation of the exact reserved
    // dispatchId to the provider's persisted session may recover it.
    if(parsed.state==='UNKNOWN' && parsed.candidateTurnId && result.exitCode===0) {
      let proof;
      try { proof=await this.#host.reconcileTurn({sessionId,
        turnId:parsed.candidateTurnId,dispatchId,scopeHash}); }
      catch { /* uncertain result must not be re-sent */ }
      if(proof?.source==='TRUSTED_HOST' && proof?.verified===true &&
          proof?.sessionId===sessionId && proof?.turnId===parsed.candidateTurnId &&
          proof?.dispatchId===dispatchId && proof?.scopeHash===scopeHash &&
          proof?.state==='COMPLETED' && proof?.resultRef===parsed.candidateTurnId) {
        const verified={state:'COMPLETED',resultRef:proof.resultRef,
          turnId:parsed.candidateTurnId};
        this.#last.set(parsed.candidateTurnId,verified);
        return {sessionId,turnId:parsed.candidateTurnId};
      }
    }
    throw Error(parsed.reason);
  }
  async observeTurn(receipt) {
    if(!receipt||receipt.sessionId!==this.#sessionId||
       receipt.scopeHash!==this.#scopeHash||!ID.test(receipt.dispatchId??'')||
       !ID.test(receipt.turnId??''))
      throw Error('OPENCODE_RECEIPT_SCOPE_MISMATCH');
    const cached=this.#last.get(receipt.turnId);
    if(cached)return {state:'COMPLETED',receipt,resultRef:cached.resultRef};
    // Never infer success from exit code or the last JSONL record on restart.
    // Reconcile against the provider's OWN persisted session via trusted host.
    const proof=await this.#host.reconcileTurn({sessionId:receipt.sessionId,
      turnId:receipt.turnId,scopeHash:receipt.scopeHash});
    if(proof?.source!=='TRUSTED_HOST'||proof?.verified!==true||
       proof?.sessionId!==receipt.sessionId||proof?.turnId!==receipt.turnId||
       proof?.scopeHash!==receipt.scopeHash)
      return {state:'UNKNOWN',receipt};
    if(proof.state==='COMPLETED'&&proof.resultRef===receipt.turnId)
      return {state:'COMPLETED',receipt,resultRef:proof.resultRef};
    if(proof.state==='RUNNING')return {state:'RUNNING',receipt};
    if(proof.state==='CANCELLED')return {state:'CANCELLED',receipt};
    return {state:'UNKNOWN',receipt};
  }
  async cancelTurn(receipt) {
    if(!receipt||receipt.sessionId!==this.#sessionId||
       receipt.scopeHash!==this.#scopeHash||!ID.test(receipt.dispatchId??'')||
       !ID.test(receipt.turnId??''))
      throw Error('OPENCODE_RECEIPT_SCOPE_MISMATCH');
    try {
      const result=await this.#host.interrupt({sessionId:receipt.sessionId,
        turnId:receipt.turnId,scopeHash:receipt.scopeHash});
      return result?.source==='TRUSTED_HOST'&&result?.confirmed===true?'CONFIRMED':'UNKNOWN';
    }catch{return 'UNKNOWN';}
  }
  async close(){
    if(this.#closed)return;
    this.#closed=true;this.#last.clear();this.#dispatches.clear();
    await this.#host.close({sessionId:this.#sessionId});
  }
}
