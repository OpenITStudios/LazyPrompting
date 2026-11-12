import {AgentRunControllerV2} from './agent-run-controller.mjs';
import {fingerprintAgentGoalScopeV2} from './goal-scope-v2.mjs';

// Private native-host routing boundary. A public MCP caller cannot attach
// a runtime, supply approved scope or choose executable arguments.
// This module owns NO authorization, worker process or durable state.
const RUN=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/i;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const ACTIONS=new Set(['start','observe','cancel','reconcileReserved']);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const hold=reason=>Object.freeze({status:'BLOCKED',reason,qa:'NOT_EXECUTED',nextPromptAllowed:false});

export class NativeAgentRequestRouter {
  #controller=null;
  #readApprovedRun;
  #authorizeAction;
  #inFlight=new Set();

  // Called only by a trusted host composition in the gateway child process.
  // No JSON-RPC method or public MCP tool may call bind().
  bind({controller,readApprovedRun,authorizeAction}={}) {
    if(this.#controller)throw Error('NATIVE_AGENT_RUNTIME_ALREADY_BOUND');
    if(!(controller instanceof AgentRunControllerV2)||
       typeof readApprovedRun!=='function'||typeof authorizeAction!=='function')
      throw Error('NATIVE_AGENT_TRUSTED_HOST_REQUIRED');
    this.#controller=controller;
    this.#readApprovedRun=readApprovedRun;
    this.#authorizeAction=authorizeAction;
  }

  status(){
    return Object.freeze({schemaVersion:2,source:'NATIVE_GATEWAY',
      configured:this.#controller!==null,readOnly:true,
      workerExecutionReady:false, // per-run admission and sandbox still required
      fourPublicMcpToolsUnchanged:true});
  }

  async handle(request){
    if(!record(request)||Object.keys(request).some(k=>!['action','runId'].includes(k))||
       typeof request.action!=='string')
      return hold('INVALID_NATIVE_AGENT_REQUEST');
    if(request.action==='status'&&Object.keys(request).length===1)
      return this.status();
    if(!ACTIONS.has(request.action)||Object.keys(request).length!==2||
       typeof request.runId!=='string'||!RUN.test(request.runId))
      return hold('INVALID_NATIVE_AGENT_REQUEST');
    if(!this.#controller)return hold('NATIVE_AGENT_RUNTIME_NOT_BOUND');
    const runId=request.runId.toLowerCase();
    if(this.#inFlight.has(runId))return hold('NATIVE_AGENT_RUN_BUSY');
    this.#inFlight.add(runId);
    try{
      // This callback reads the native host's *persisted, operator-approved*
      // versioned run, not caller-supplied scope/worker/profile/prompt fields.
      const bound=await this.#readApprovedRun({runId,action:request.action});
      if(!record(bound)||bound.source!=='TRUSTED_HOST'||bound.schemaVersion!==2||
         bound.approved!==true||bound.runId!==runId||
         ![bound.goalId,bound.workspaceId,bound.taskId].every(s=>
            typeof s==='string'&&ID.test(s))||
         !record(bound.scope)||bound.scope.coding!==null)
        return hold('NATIVE_AGENT_APPROVED_RUN_REQUIRED');
      let scopeHash;
      try{scopeHash=fingerprintAgentGoalScopeV2(bound.scope);}
      catch{return hold('NATIVE_AGENT_APPROVED_SCOPE_INVALID');}
      if(scopeHash!==bound.scopeHash)
        return hold('NATIVE_AGENT_APPROVED_SCOPE_CHANGED');
      // Native host must recheck STOP, client lease, operator grant and the
      // exact action on every request. A previously approved goal alone is not
      // sufficient authorization for later dispatch/cancellation.
      const authorization=await this.#authorizeAction({runId,
        action:request.action,scopeHash,goalId:bound.goalId,
        workspaceId:bound.workspaceId,taskId:bound.taskId,
        workerProfileId:bound.scope.workerProfile.profileId});
      if(authorization?.source!=='TRUSTED_HOST'||authorization.approved!==true||
         authorization.runId!==runId||authorization.action!==request.action||
         authorization.scopeHash!==scopeHash||authorization.goalId!==bound.goalId||
         authorization.taskId!==bound.taskId||
         authorization.workerProfileId!==bound.scope.workerProfile.profileId)
        return hold('NATIVE_AGENT_ACTION_NOT_AUTHORIZED');
      const input={goalId:bound.goalId,workspaceId:bound.workspaceId,
        taskId:bound.taskId,scope:bound.scope};
      if(request.action==='start'){
        if(typeof bound.prompt!=='string'||!bound.prompt.trim()||
           bound.prompt.length>12000)
          return hold('NATIVE_AGENT_APPROVED_PROMPT_REQUIRED');
        return this.#controller.start({...input,prompt:bound.prompt});
      }
      if(request.action==='observe')return this.#controller.observe(input);
      if(request.action==='cancel')return this.#controller.cancel(input);
      return this.#controller.reconcileReserved(input);
    }catch{
      // Never leak host paths/credentials or provider-specific stack traces
      // into an MCP result. Uncertain effects remain held in PromptOutbox.
      return hold('NATIVE_AGENT_OPERATION_RECONCILE_REQUIRED');
    }finally{this.#inFlight.delete(runId);}
  }
}
