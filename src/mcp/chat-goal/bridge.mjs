import {
  parseChatGoalInput, parseHostChatGoalReceipt, parseTrustedChatGoalPrincipal,
} from "./contract.mjs";
import {chatGoalOAuthChallenge} from "./oauth-authenticator.mjs";
import {parseNativeChatGoalAdmission} from "./host-admission.mjs";

const statusText = Object.freeze({
  BOUND: "Chat goal bound. Waiting for a host-approved next turn.",
  NEXT_TURN_READY: "One host-approved follow-up is ready for this app.",
  CLAIMED: "One follow-up reserved for the hosting ChatGPT conversation.",
  DELIVERY_RECORDED: "Host send-request outcome noted; final delivery is unverified.",
  REVIEW_REQUIRED: "Goal held for operator or evidence review.",
  RECONCILE_REQUIRED: "Outcome uncertain. Do not retry or resend.",
  STOPPED: "Goal stopped by the native host.",
});
const errorResult = (code, authMeta = null) => ({
  isError: true,
  content: [{type: "text", text: "Chat goal held: " + code + "."}],
  structuredContent: {status: ["HOST_OUTCOME_UNCERTAIN", "HOST_RECEIPT_INVALID"].includes(code)
    ? "RECONCILE_REQUIRED" : "REVIEW_REQUIRED", code},
  ...(code === "AUTHENTICATION_REQUIRED" && authMeta ? {_meta: authMeta} : {}),
});

// This bridge has no store, scheduler, network client or write authority.
// authenticate() verifies OAuth; authorize() checks existing native
// operator approval, STOP, workspace and chat identity on EACH tool call.
// invoke() may mutate only through the separately authenticated Rust host.
export function createChatGoalBridge({
  authenticate, authorize, invoke, resourceMetadataUrl,
} = {}) {
  if (typeof authenticate !== "function" ||
    typeof authorize !== "function" || typeof invoke !== "function")
    throw Error("CHAT_GOAL_TRUSTED_HOST_REQUIRED");
  const authMeta = resourceMetadataUrl === undefined
    ? null : chatGoalOAuthChallenge(resourceMetadataUrl);
  return Object.freeze({
    async call(tool, rawInput, requestContext) {
      const input = parseChatGoalInput(tool, rawInput);
      if (!input) return errorResult("INVALID_INPUT");
      let principal;
      try {
        principal = parseTrustedChatGoalPrincipal(await authenticate(requestContext));
      } catch {
        return errorResult("AUTHENTICATION_REQUIRED", authMeta);
      }
      if (!principal) return errorResult("AUTHENTICATION_REQUIRED", authMeta);
      let admission;
      try {
        // No state mutation is allowed here. The actual host must re-check
        // scope, STOP and principal even if the previous call succeeded.
        admission = parseNativeChatGoalAdmission(
          await authorize({tool, input, principal}), principal, tool);
      } catch {
        return errorResult("NATIVE_ADMISSION_UNAVAILABLE");
      }
      if (!admission) return errorResult("NATIVE_SCOPE_UNVERIFIED");
      let receipt;
      try {
        // Exactly one native attempt. Never replay after an uncertain effect.
        receipt = parseHostChatGoalReceipt(tool,
          await invoke({tool, input, principal, admission}));
      } catch {
        return errorResult("HOST_OUTCOME_UNCERTAIN");
      }
      if (!receipt || (tool==="goal.bind" && !admission.chatBound &&
          receipt.state==="NEXT_TURN_READY"))
        return errorResult("HOST_RECEIPT_INVALID");
      const result = {
        content: [{type: "text", text: statusText[receipt.state]}],
        // Never imply that a model report or UI send request is verified QA.
        structuredContent: {status: receipt.state, qa: "NOT_VERIFIED"},
      };
      if (receipt.nextClaim) result._meta = {nextClaim: receipt.nextClaim};
      if (receipt.state === "CLAIMED")
        result._meta = {prompt: receipt.prompt, delivery: receipt.delivery};
      return result;
    },
  });
}
