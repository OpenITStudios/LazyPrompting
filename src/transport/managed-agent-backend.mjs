import {BackendLifecycle} from "../runtime/backend-lifecycle.mjs";

// Adapter for a trusted official-agent host. It does not guess an OpenAI/Codex wire protocol.
// The host provides documented probe/connect/disconnect callbacks and authenticated operations.
export class ManagedAgentBackend {
 constructor({probe,connect,disconnect,clock}={}){
  if(typeof probe!=="function"||typeof connect!=="function"||typeof disconnect!=="function")
   throw new Error("TRUSTED_AGENT_HOST_REQUIRED");
  this.lifecycle=new BackendLifecycle({probe,connect,close:disconnect,clock});
 }
 status(){return this.lifecycle.status();}
 async observe(taskId){
  if(typeof taskId!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(taskId))throw new Error("INVALID_TASK_ID");
  const connection=await this.lifecycle.ensure();
  if(!connection.ready)return {status:"UNAVAILABLE",reason:connection.reason,retryAt:connection.retryAt};
  if(typeof connection.backend.observe!=="function")throw new Error("OBSERVE_UNSUPPORTED");
  return connection.backend.observe(taskId);
 }
 async dispatch(request){
  // Never retry dispatch automatically after a timeout or lost response.
  if(!request||typeof request!=="object"||!request.authorizationReceipt)
   throw new Error("TRUSTED_AUTHORIZATION_RECEIPT_REQUIRED");
  const connection=await this.lifecycle.ensure();
  if(!connection.ready)throw new Error("AGENT_BACKEND_UNAVAILABLE");
  if(typeof connection.backend.dispatch!=="function")throw new Error("DISPATCH_UNSUPPORTED");
  return connection.backend.dispatch(request);
 }
 async close(){await this.lifecycle.invalidate();}
}
