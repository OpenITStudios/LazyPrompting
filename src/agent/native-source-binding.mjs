import {createHash} from 'node:crypto';
import {fingerprintAgentGoalScopeV2} from './goal-scope-v2.mjs';

// A host-owned immutable source record is not a permission grant. Normalizing
// this message never registers an executable, runs a worker or verifies an OS
// sandbox. Keep the entire source scope private to the authenticated gateway.
const RUN=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/i;
const SHA=/^[a-f0-9]{64}$/;
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
// These two constants explicitly mean source-only and NO OS isolation.
// Any future runnable policy MUST use a separately approved digest/version.
const PERMISSION_SOURCE_ONLY=hash(
  'lazyprompting/agent-v2/source-only/read-only/no-execution/v1'
);
const SANDBOX_NOT_VERIFIED=hash(
  'lazyprompting/agent-v2/native-sandbox-not-yet-verified/v1'
);
const SHA_COMMIT=/^[a-f0-9]{40,64}$/;
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const LIMITS=['maxActiveTasks','maxTurnsPerTask','wallMinutes'];
const CAPABILITIES=[
  'openSession','resumeSession','submitTurn','observeTurn',
  'cancelTurn','streamEvents','toolPermissionCallback',
  'readOnlyIsolation','workspaceWriteIsolation','trustedToolExecution',
  'tokenUsage','contextCompaction'
];
const REQUIRED=['source','schemaVersion','bindingVersion','runId','goalId',
  'workspaceId','taskId','sourceApprovalSha256','sourceApproved',
  'executionAuthorized','executionReady','qa','scope'];
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,fields)=>record(x)&&Object.keys(x).length===fields.length&&
  fields.every(k=>Object.hasOwn(x,k));

// The canonical native scope is host-derived over the authenticated pipe.
// No model-supplied object can be used as a substitute for this transport.
export function normalizeNativeAgentSourceBinding(raw,runId) {
  if(!exact(raw,REQUIRED)||raw.source!=='NATIVE_HOST_READ_ONLY'||
     raw.schemaVersion!==2||raw.bindingVersion!==1||
     typeof runId!=='string'||!RUN.test(runId)||
     raw.runId!==runId.toLowerCase()||raw.sourceApproved!==true||
     raw.executionAuthorized!==false||raw.executionReady!==false||
     raw.qa!=='NOT_EXECUTED'||!SHA.test(raw.sourceApprovalSha256??'')||
     !RUN.test(raw.runId??'')||!WORKSPACE.test(raw.workspaceId??'')||
     raw.taskId!=='task-1'||raw.goalId!==raw.runId.split('.')[0])
    throw Error('INVALID_NATIVE_SOURCE_BINDING');
  const scope=raw.scope;
  if(!record(scope)||scope.coding!==null||
     !SHA_COMMIT.test(scope.baseSha??'')||
     !Array.isArray(scope.acceptance)||scope.acceptance.length!==1||
     !exact(scope.limits,LIMITS)||
     scope.limits.maxActiveTasks!==1||
     ![1,2].includes(scope.limits.maxTurnsPerTask)||
     !Number.isInteger(scope.limits.wallMinutes)||
     scope.limits.wallMinutes<1||scope.limits.wallMinutes>30)
    throw Error('INVALID_NATIVE_SOURCE_SCOPE');
  const profile=scope.workerProfile;
  if(!record(profile)||!['codex-local','opencode-local'].includes(profile.profileId)||
     profile.adapterId!==(profile.profileId==='codex-local'?'codex-app-server':'opencode-v2')||
     profile.adapterContractVersion!==1||profile.runtimeVersion!=='unverified'||
     profile.platform!=='win32'||!SHA.test(profile.executableSha256??'')||
     !exact(profile.capabilities,CAPABILITIES)||
     CAPABILITIES.some(name=>profile.capabilities[name]!==(
       ['workspaceWriteIsolation','trustedToolExecution'].includes(name)
         ?'UNSUPPORTED':'UNKNOWN')))
    throw Error('NATIVE_SOURCE_CAPABILITY_CLAIM');
  // These fixed-domain SHA-256 fingerprints are *source intent*, not evidence
  // of actual permission or isolation. Gate all dispatch separately.
  if(scope.permissionPolicySha256!==PERMISSION_SOURCE_ONLY||
     scope.sandboxPolicySha256!==SANDBOX_NOT_VERIFIED||
     scope.dataDir===scope.stopFile||
     scope.executable===scope.cwd)
    throw Error('INVALID_NATIVE_SOURCE_POLICIES');
  const scopeHash=fingerprintAgentGoalScopeV2(scope);
  return Object.freeze({
    status:'SOURCE_BOUND_NO_EXECUTION',schemaVersion:2,
    source:'NATIVE_HOST_READ_ONLY',runId:raw.runId,
    goalId:raw.goalId,workspaceId:raw.workspaceId,taskId:raw.taskId,
    workerProfileId:profile.profileId,adapterId:profile.adapterId,
    baseSha:scope.baseSha,executableSha256:profile.executableSha256,
    scopeHash,sourceApprovalSha256:raw.sourceApprovalSha256,
    executionReady:false,nextPromptAllowed:false,qa:'NOT_EXECUTED'
  });
}
