import {App} from "@modelcontextprotocol/ext-apps/app-with-deps";
import {parseChatGoalInput, parseHostChatGoalReceipt} from "./contract.mjs";

// Source-only widget. It cannot launch other chats or poll ChatGPT output.
// One-use claims must be consumed by the authenticated native host first.
const status = document.getElementById("status");
const app = new App({name: "LazyPrompting Chat Goal", version: "0.1.0"});
const attempted = new Set();

app.ontoolresult = async result => {
  const claim = result?._meta?.nextClaim;
  if (!parseChatGoalInput("turn.claim", {claim}) || attempted.has(claim)) return;
  attempted.add(claim);
  let delivery = null;
  let outcome = "uncertain";
  try {
    const reserved = await app.callServerTool({
      name: "turn.claim", arguments: {claim},
    });
    // Share the server's strict claimed-prompt contract. A malformed
    // _meta value must never trigger sendMessage, even if coercible to text.
    const claimed = parseHostChatGoalReceipt("turn.claim", {
      state: "CLAIMED",
      prompt: reserved?._meta?.prompt,
      delivery: reserved?._meta?.delivery,
    });
    if (reserved?.isError || !claimed) {
      status.textContent = "Follow-up unavailable. Review the goal in LazyPrompting.";
      return;
    }
    delivery = claimed.delivery;
    const send = await app.sendMessage({
      role: "user", content: [{type: "text", text: claimed.prompt}],
    });
    outcome = send?.isError ? "rejected" : "accepted";
    status.textContent = send?.isError
      ? "ChatGPT host rejected this request. No retry will occur."
      : "Follow-up requested in this chat. Final delivery is unverified.";
  } catch {
    status.textContent = "Outcome uncertain. Review before any further action.";
  } finally {
    if (delivery !== null) {
      // Diagnostics only. Failure must not trigger a second send.
      await app.callServerTool({
        name: "turn.delivery", arguments: {delivery, outcome},
      }).catch(() => {});
    }
  }
};

app.connect().catch(() => {
  status.textContent = "The ChatGPT app bridge is unavailable.";
});
