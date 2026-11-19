import {App} from "@modelcontextprotocol/ext-apps/app-with-deps";

// Source-only widget. It cannot launch other chats or poll ChatGPT output.
// One-use claims must be consumed by the authenticated native host first.
const status = document.getElementById("status");
const app = new App({name: "LazyPrompting Chat Goal", version: "0.1.0"});
const attempted = new Set();
const hex = /^[a-f0-9]{48}$/;

app.ontoolresult = async result => {
  const claim = result?._meta?.nextClaim;
  if (typeof claim !== "string" || !hex.test(claim) || attempted.has(claim)) return;
  attempted.add(claim);
  let delivery = null;
  let outcome = "uncertain";
  try {
    const reserved = await app.callServerTool({
      name: "turn.claim", arguments: {claim},
    });
    const prompt = reserved?._meta?.prompt;
    delivery = reserved?._meta?.delivery ?? null;
    if (reserved?.isError || typeof prompt !== "string" ||
      prompt.length === 0 || prompt.length > 12000 || !hex.test(delivery ?? "")) {
      status.textContent = "Follow-up unavailable. Review the goal in LazyPrompting.";
      return;
    }
    const send = await app.sendMessage({
      role: "user", content: [{type: "text", text: prompt}],
    });
    outcome = send?.isError ? "rejected" : "accepted";
    status.textContent = send?.isError
      ? "ChatGPT host rejected this request. No retry will occur."
      : "Follow-up requested in this chat. Final delivery is unverified.";
  } catch {
    status.textContent = "Outcome uncertain. Review before any further action.";
  } finally {
    if (delivery && hex.test(delivery)) {
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
