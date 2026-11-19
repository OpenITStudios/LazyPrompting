import {
  parseChatGoalInput, parseHostChatGoalReceipt, parseHostChatGoalStatus,
  parseTrustedChatGoalPrincipal,
} from "./contract.mjs";
import {chatGoalOAuthChallenge} from "./oauth-authenticator.mjs";
import {parseNativeChatGoalAdmission} from "./host-admission.mjs";
import {buildChatGoalCodexReviewBrief} from "./codex-review-brief.mjs";

const statusText = Object.freeze({
  BOUND: "Chat goal bound. Waiting for a host-approved next turn.",
  NEXT_TURN_READY: "One host-approved follow-up is ready for this app.",
  CLAIMED: "One follow-up reserved for the hosting ChatGPT conversation.",
  DELIVERY_RECORDED: "Host send-request outcome noted; final delivery is unverified.",
  REVIEW_REQUIRED: "Goal held for operator or evidence review.",
  RECONCILE_REQUIRED: "Outcome uncertain. Do not retry or resend.",
  STOPPED: "Goal stopped by the native host.",
});
const statusHints = Object.freeze({
  NATIVE_STOP: "Native STOP applies. No further work is authorized.",
  RECOVERY_REQUIRED: "Native recovery is required; do not retry.",
  WORK_IN_PROGRESS: "Native Codex work is in progress; result is unverified.",
  QA_NOT_VERIFIED: "Native source is complete; independent QA is not verified.",
  NATIVE_REVIEW_REQUIRED: "Native review is still required.",
});
// A declared outputSchema applies to successful structured results.
// For goal.status a failed MCP tool has only isError:true + text,
// never a fabricated structured status that violates the schema.
const errorResult = (code, authMeta = null, dataOnly = false) => ({
  isError: true,
  content: [{type: "text", text: "Chat goal held: " + code + "."}],
  ...(!dataOnly ? {structuredContent: {
    status: ["HOST_OUTCOME_UNCERTAIN", "HOST_RECEIPT_INVALID"].includes(code)
      ? "RECONCILE_REQUIRED" : "REVIEW_REQUIRED", code,
  }} : {}),
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
      const deny = (code, authMeta = null) =>
        errorResult(code, authMeta, tool === "goal.status");
      const input = parseChatGoalInput(tool, rawInput);
      if (!input) return deny("INVALID_INPUT");
      let principal;
      try {
        principal = parseTrustedChatGoalPrincipal(await authenticate(requestContext));
      } catch {
        return deny("AUTHENTICATION_REQUIRED", authMeta);
      }
      if (!principal) return deny("AUTHENTICATION_REQUIRED", authMeta);
      let admission;
      try {
        // No state mutation is allowed here. The actual host must re-check
        // scope, STOP and principal even if the previous call succeeded.
        admission = parseNativeChatGoalAdmission(
          await authorize({tool, input, principal}), principal, tool);
      } catch {
        return deny("NATIVE_ADMISSION_UNAVAILABLE");
      }
      if (!admission) return deny("NATIVE_SCOPE_UNVERIFIED");
      if (tool === "goal.status") {
        // A status read requires the same OAuth + native scope admission.
        // No outbox reservation, widget re-render or Codex dispatch.
        let raw;
        try {
          raw = await invoke({tool, input, principal, admission});
        } catch {
          return deny("STATUS_UNAVAILABLE");
        }
        const snapshot = parseHostChatGoalStatus(raw, admission);
        if (!snapshot) return deny("STATUS_SNAPSHOT_INVALID");
        return {
          content: [{type:"text", text:
            "Codex source: " + snapshot.codexState + ". " +
            statusHints[snapshot.blocker] + " No ChatGPT turn or QA was verified."}],
          structuredContent: snapshot,
        };
      }
      // Package the untrusted report once, using ONLY native-bound scope.
      // The native invoke must verify the receipt and recheck STOP before
      // storing or passing this proposal to an approved Codex consumer.
      const codexBrief=tool==="goal.report"
        ? buildChatGoalCodexReviewBrief(input,admission) : null;
      if(tool==="goal.report"&&!codexBrief)
        return deny("CODEX_REVIEW_PROPOSAL_INVALID");
      let receipt;
      try {
        // Exactly one native attempt. Never replay after an uncertain effect.
        receipt = parseHostChatGoalReceipt(tool, await invoke({
          tool,input,principal,admission,
          ...(codexBrief?{codexBrief}:{}),
        }));
      } catch {
        return deny("HOST_OUTCOME_UNCERTAIN");
      }
      if (!receipt || (tool==="goal.bind" && !admission.chatBound &&
          receipt.state==="NEXT_TURN_READY"))
        return deny("HOST_RECEIPT_INVALID");
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
