import {
  assertAgentBackendInterface, fingerprintAgentProfile,
  normalizeAgentProfile, requireAgentCapability
} from './agent-contract.mjs';

// Only the trusted host composition may instantiate and populate this
// registry. It is deliberately NOT wired to model-visible MCP tool arguments.
export class AgentBackendRegistry {
  #profiles = new Map();
  #pending = new Set();
  #closed = false;
  #verifyRegistration;
  constructor({verifyRegistration} = {}) {
    if (typeof verifyRegistration !== 'function')
      throw new Error('TRUSTED_AGENT_REGISTRATION_REQUIRED');
    this.#verifyRegistration = verifyRegistration;
  }
  async register({profile, backend} = {}) {
    const normalized = normalizeAgentProfile(profile);
    assertAgentBackendInterface(backend);
    if (this.#closed) throw new Error('AGENT_REGISTRY_CLOSED');
    if (this.#profiles.has(normalized.profileId) || this.#pending.has(normalized.profileId))
      throw new Error('AGENT_PROFILE_ALREADY_REGISTERED');
    this.#pending.add(normalized.profileId);
    try {
      const digest = fingerprintAgentProfile(normalized);
      // This callback must check the locally installed binary identity,
      // adapter version, native host process and operator-approved capabilities.
      // A string or model-supplied {trusted:true} is never accepted here.
      const proof = await this.#verifyRegistration({profile: normalized, fingerprint: digest});
      if (proof?.source !== 'TRUSTED_HOST' || proof?.verified !== true ||
          proof?.fingerprint !== digest || proof?.profileId !== normalized.profileId)
        throw new Error('AGENT_PROFILE_NOT_ATTESTED');
      if (this.#closed) throw new Error('AGENT_REGISTRY_CLOSED');
      this.#profiles.set(normalized.profileId, {profile: normalized, backend, fingerprint: digest});
      return Object.freeze({profileId: normalized.profileId, fingerprint: digest});
    } finally {
      this.#pending.delete(normalized.profileId);
    }
  }
  // Metadata only. A client cannot receive native backend methods or host keys.
  list() {
    return [...this.#profiles.values()].map(({profile, fingerprint}) =>
      Object.freeze({profile, fingerprint}));
  }
  // Invoked only from the native-host-trusted goal runner, never from MCP.
  resolve(profileId, capability) {
    if (this.#closed) throw new Error('AGENT_REGISTRY_CLOSED');
    const result = this.#profiles.get(profileId);
    if (!result) throw new Error('AGENT_PROFILE_UNAVAILABLE');
    requireAgentCapability(result.profile, capability);
    return Object.freeze({profile: result.profile, backend: result.backend,
      fingerprint: result.fingerprint});
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    const entries = [...this.#profiles.values()];
    this.#profiles.clear();
    const results = await Promise.allSettled(entries.map(entry => entry.backend.close()));
    if (results.some(result => result.status === 'rejected'))
      throw new Error('AGENT_BACKEND_CLOSE_FAILED');
  }
}
