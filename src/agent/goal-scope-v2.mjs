import {createHash} from 'node:crypto';
import {fingerprintGoalRunScope} from '../transport/goal-run-scope.mjs';
import {fingerprintAgentProfile,normalizeAgentProfile} from './agent-contract.mjs';

const SHA = /^[a-f0-9]{64}$/;
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  Object.getPrototypeOf(x) === Object.prototype;
const fields = ['workerProfile','permissionPolicySha256','sandboxPolicySha256',
  'executable','cwd','dataDir','stopFile','objective','acceptance','baseSha','limits','coding'];

// v2 is a new digest domain; NEVER rewrite, relabel or upgrade the v1 Codex
// report/checkpoint. The native host must select and approve workerProfile.
export function fingerprintAgentGoalScopeV2(input={}) {
  if (!record(input) || Object.keys(input).length !== fields.length ||
      !fields.every(key=>Object.hasOwn(input,key)) ||
      !SHA.test(input.permissionPolicySha256 ?? '') ||
      !SHA.test(input.sandboxPolicySha256 ?? ''))
    throw new Error('INVALID_AGENT_GOAL_SCOPE_V2');
  const profile = normalizeAgentProfile(input.workerProfile);
  const scopeV1 = fingerprintGoalRunScope(input);
  // The v1 digest binds immutable goal/worktree/STOP/QA/limits; the v2
  // domain additionally binds a host-approved worker identity and policies.
  return createHash('sha256').update(JSON.stringify([
    'LAZYPROMPTING_GOAL_SCOPE_V2',scopeV1,
    fingerprintAgentProfile(profile),
    input.permissionPolicySha256,input.sandboxPolicySha256
  ])).digest('hex');
}
