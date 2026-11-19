// Source-only, per-call native authorization receipt. The injected
// authorize() provider MUST be the authenticated Rust host, not an MCP
// request, an OAuth token, model text, widget state or a browser URL.
// It must verify the existing operator scope, STOP, one goal identity,
// workspace ownership and exact hosting conversation before returning data.
// This module has no persistent state or permission to issue a grant.
const DIGEST=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const SOURCE="NATIVE_APPROVED_CHAT_GOAL";
const validId=value=>typeof value==="string"&&ID.exec(value)?.[0]===value;
const validDigest=value=>typeof value==="string"&&value.length===64&&
  DIGEST.test(value)&&value!=="0".repeat(64);
const KEYS=[
  "schemaVersion","source","subjectId","connectionId","workspaceId",
  "goalDigest","conversationDigest","principalTag","epoch",
  "operatorApproved","stopped","chatBound",
];
const exact = x => x !== null && typeof x === "object" &&
  !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype &&
  Object.keys(x).sort().join(",") === [...KEYS].sort().join(",");

// This is *not* a token verifier or a ChatGPT identity proof. It only
// rejects malformed / mismatched native-issued authorization projections.
export function parseNativeChatGoalAdmission(raw, principal, tool) {
  if (!exact(raw) || !principal || typeof principal !== "object" ||
    raw.schemaVersion!==1 || raw.source!==SOURCE ||
    raw.subjectId!==principal.subjectId ||
    raw.connectionId!==principal.connectionId ||
    !validId(raw.subjectId) || !validId(raw.connectionId) ||
    !WORKSPACE.test(raw.workspaceId??"") ||
    ![raw.goalDigest,raw.conversationDigest,raw.principalTag].every(x=>
      validDigest(x)) ||
    !Number.isSafeInteger(raw.epoch) || raw.epoch < 1 ||
    raw.operatorApproved!==true || raw.stopped!==false ||
    typeof raw.chatBound!=="boolean" ||
    (tool!=="goal.bind" && raw.chatBound!==true)) return null;
  // Merely matching an OAuth subject or chat URL cannot set chatBound.
  // Only a host-attested, operator-approved correlation may set it true.
  return Object.freeze({
    workspaceId:raw.workspaceId,
    goalDigest:raw.goalDigest,
    conversationDigest:raw.conversationDigest,
    principalTag:raw.principalTag,
    epoch:raw.epoch,
    chatBound:raw.chatBound,
  });
}
