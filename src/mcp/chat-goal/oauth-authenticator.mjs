// Source-only OAuth *resource-server* boundary, not an issuer or JWT parser.
// An injected verifier must check the bearer signature or perform trusted
// opaque-token introspection before a verified grant can be returned.
const IDENT = /^[A-Za-z0-9:_-]{1,128}$/;
const SCOPE = "chat_goal:operate";
const validIdentity = value => typeof value === "string" &&
  IDENT.exec(value)?.[0] === value;

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname &&
      !u.username && !u.password && !u.search && !u.hash;
  } catch {
    return false;
  }
}

function safePrincipal(grant, issuer, audience, now) {
  if (!grant || typeof grant !== "object" || Array.isArray(grant) ||
    grant.verified !== true || grant.tokenType !== "Bearer" ||
    grant.issuer !== issuer || grant.audience !== audience ||
    !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= now ||
    (grant.notBefore !== undefined &&
      (!Number.isSafeInteger(grant.notBefore) || grant.notBefore > now)) ||
    !Array.isArray(grant.scopes) ||
    !grant.scopes.every(s => typeof s === "string" && s.length > 0) ||
    !grant.scopes.includes(SCOPE) ||
    !validIdentity(grant.subjectId) ||
    !validIdentity(grant.connectionId) ||
    (grant.chatSessionHint != null && !validIdentity(grant.chatSessionHint))) return null;
  return Object.freeze({
    subjectId: grant.subjectId,
    connectionId: grant.connectionId,
    // This is only a host correlation hint, not verified ChatGPT /c/ identity.
    chatSessionHint: grant.chatSessionHint ?? null,
  });
}

export function createChatGoalOAuthAuthenticator({
  verifyAccessToken, issuer, audience,
  nowSeconds = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof verifyAccessToken !== "function" ||
    typeof nowSeconds !== "function" ||
    !isHttpsUrl(issuer) || !isHttpsUrl(audience))
    throw Error("CHAT_GOAL_VERIFIED_OAUTH_RESOURCE_REQUIRED");
  return async function authenticate(requestContext) {
    // Verification MUST be enforced by the injected trusted resource server.
    // Never trust decoded JWT payloads, caller-provided "verified" flags,
    // or requestContext.authInfo without a real token verifier.
    let grant;
    try {
      grant = await verifyAccessToken(requestContext, {
        issuer, audience, requiredScope: SCOPE,
      });
    } catch {
      return null; // No bearer token, user data or backend error leakage.
    }
    const now = nowSeconds();
    if (!Number.isSafeInteger(now) || now < 0) return null;
    return safePrincipal(grant, issuer, audience, now);
  };
}

export function chatGoalOAuthChallenge(resourceMetadataUrl) {
  if (!isHttpsUrl(resourceMetadataUrl) ||
      !new URL(resourceMetadataUrl).pathname.endsWith(
        "/.well-known/oauth-protected-resource"))
    throw Error("CHAT_GOAL_RESOURCE_METADATA_REQUIRED");
  const url = new URL(resourceMetadataUrl);
  return Object.freeze({
    "mcp/www_authenticate": [
      'Bearer resource_metadata="' + url.href +
      '", error="invalid_token", error_description="Authentication required for this plugin"',
    ],
  });
}
