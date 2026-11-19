import {
  parseChatGoalInput, parseHostChatGoalReceipt, parseTrustedChatGoalPrincipal,
} from "./contract.mjs";
import {chatGoalOAuthChallenge} from "./oauth-authenticator.mjs";

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
// authenticate() must verify OAuth/connection identity; invoke() must call an
// authenticated native host which owns atomic reservations and STOP.
export function createChatGoalBridge({authenticate, invoke, resourceMetadataUrl} = {}) {
  if (typeof authenticate !== "function" || typeof invoke !== "function")
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
      let receipt;
      try {
        // Exactly one attempt. A lost response may follow a real side effect.
        receipt = parseHostChatGoalReceipt(tool, await invoke({tool, input, principal}));
      } catch {
        return errorResult("HOST_OUTCOME_UNCERTAIN");
      }
      if (!receipt) return errorResult("HOST_RECEIPT_INVALID");
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
