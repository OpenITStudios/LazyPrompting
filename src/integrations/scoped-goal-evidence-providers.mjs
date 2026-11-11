import {GitHubEvidence} from './github-evidence.mjs';
import {ReceiptReconciler} from './receipt-reconciler.mjs';

// Host-only composition: replaces three independently supplied GitHub
// callbacks with one explicitly approved project identity. This neither
// authenticates a Codex turn nor manufactures an independent QA receipt.
const WS=/^workspace-(0[1-9]|10)$/;
const locked=(input,scope)=>input?.repository===scope.repository &&
  input?.branch===scope.branch &&
  (input.workspaceId===undefined || WS.test(input.workspaceId));

export function createScopedGoalEvidenceProviders({scope,token,fetchImpl,verifyReceipt}={}){
  if(!scope||typeof scope!=='object'||Array.isArray(scope)||
     Object.keys(scope).length!==2||
     !Object.hasOwn(scope,'repository')||!Object.hasOwn(scope,'branch')||
     typeof verifyReceipt!=='function')
    throw Error('TRUSTED_PROJECT_EVIDENCE_CONFIG_REQUIRED');
  // GitHubEvidence independently validates the project scope. A caller must
  // supply a host-owned token and any injected HTTP client; no user/MCP args.
  const source=new GitHubEvidence({scope,token,fetchImpl});
  const project=Object.freeze({repository:scope.repository,branch:scope.branch});
  const receipts=new ReceiptReconciler({scope:project,sourceProvider:source,verifyReceipt});
  const requireScope=identity=>{
    if(!locked(identity,project))throw Error('GOAL_EVIDENCE_PROJECT_SCOPE_CHANGED');
  };
  return Object.freeze({
    sourceFactory:async identity=>{requireScope(identity);return source;},
    receiptFactory:async identity=>{
      requireScope(identity);
      if(identity?.source!==source)throw Error('GOAL_EVIDENCE_PROVIDER_CHANGED');
      return receipts;
    },
    readHead:async identity=>{
      requireScope(identity);
      return source.head(project.repository,project.branch);
    }
  });
}
