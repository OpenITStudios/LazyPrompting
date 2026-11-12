import {createHash} from 'node:crypto';

// Pure provider contract. Not an authentication protocol or an MCP endpoint.
// The native host, not agent/model content, must supply and attest profiles.
export const AGENT_CONTRACT_VERSION = 1;
export const AGENT_CAPABILITIES = Object.freeze([
  'openSession', 'resumeSession', 'submitTurn', 'observeTurn',
  'cancelTurn', 'streamEvents', 'toolPermissionCallback',
  'readOnlyIsolation', 'workspaceWriteIsolation', 'trustedToolExecution',
  'tokenUsage', 'contextCompaction'
]);
export const CAPABILITY_STATES = Object.freeze([
  'SUPPORTED_VERIFIED', 'SUPPORTED_UNVERIFIED', 'UNSUPPORTED', 'UNKNOWN'
]);
const ID = /^[a-z][a-z0-9._-]{1,63}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,79}$/;
const SHA = /^[a-f0-9]{64}$/;
const PLATFORMS = new Set(['win32', 'linux', 'darwin']);
const PROFILE_FIELDS = Object.freeze([
  'profileId', 'adapterId', 'adapterContractVersion', 'runtimeVersion',
  'executableSha256', 'platform', 'capabilities'
]);

const record = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) => record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

export function normalizeAgentProfile(profile) {
  if (!exact(profile, PROFILE_FIELDS) || !ID.test(profile.profileId ?? '') ||
      !ID.test(profile.adapterId ?? '') ||
      profile.adapterContractVersion !== AGENT_CONTRACT_VERSION ||
      !VERSION.test(profile.runtimeVersion ?? '') ||
      !SHA.test(profile.executableSha256 ?? '') ||
      !PLATFORMS.has(profile.platform) ||
      !exact(profile.capabilities, AGENT_CAPABILITIES))
    throw new Error('INVALID_AGENT_PROFILE');
  for (const key of AGENT_CAPABILITIES) {
    if (!CAPABILITY_STATES.includes(profile.capabilities[key]))
      throw new Error('INVALID_AGENT_PROFILE');
  }
  // Fixed field/key order for consistent profile fingerprints across clients.
  const caps = Object.fromEntries(AGENT_CAPABILITIES.map(key =>
    [key, profile.capabilities[key]]));
  return Object.freeze({
    profileId: profile.profileId, adapterId: profile.adapterId,
    adapterContractVersion: AGENT_CONTRACT_VERSION,
    runtimeVersion: profile.runtimeVersion,
    executableSha256: profile.executableSha256, platform: profile.platform,
    capabilities: Object.freeze(caps)
  });
}

export function fingerprintAgentProfile(profile) {
  const normalized = normalizeAgentProfile(profile);
  return sha256(JSON.stringify(['LAZYPROMPTING_AGENT_PROFILE_V1', normalized]));
}

export function assertAgentBackendInterface(backend) {
  for (const name of ['probe', 'openSession', 'resumeSession', 'submitTurn',
    'observeTurn', 'cancelTurn', 'close']) {
    if (!backend || typeof backend[name] !== 'function')
      throw new Error(`AGENT_BACKEND_METHOD_MISSING:${name}`);
  }
  return backend;
}

// A provider-reported capability is never permission. Call this only after
// an independently verified registration and native host admission.
export function requireAgentCapability(profile, capability) {
  const normalized = normalizeAgentProfile(profile);
  if (!AGENT_CAPABILITIES.includes(capability))
    throw new Error('UNKNOWN_AGENT_CAPABILITY');
  if (normalized.capabilities[capability] !== 'SUPPORTED_VERIFIED')
    throw new Error('AGENT_CAPABILITY_NOT_VERIFIED');
  return normalized;
}
