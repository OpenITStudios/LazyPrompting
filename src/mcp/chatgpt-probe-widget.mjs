import { App } from "@modelcontextprotocol/ext-apps/app-with-deps";

const status = document.getElementById("status");
const app = new App({ name: "LazyPrompting Chat Probe", version: "0.1.0" });
let started = false;

app.ontoolresult = async ({ _meta }) => {
  if (!_meta?.claim || started) return;
  started = true;
  let delivery;
  let outcome = "uncertain";
  try {
    const reservation = await app.callServerTool({
      name: "claim_probe_prompt",
      arguments: { claim: _meta.claim },
    });
    const prompt = reservation._meta?.prompt;
    delivery = reservation._meta?.delivery;
    if (typeof prompt !== "string") {
      status.textContent = "Probe prompt unavailable or already reserved.";
      return;
    }
    const sent = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: prompt }],
    });
    outcome = sent?.isError ? "rejected" : "accepted";
    status.textContent = sent?.isError
      ? "Host rejected the message. The probe will not resend."
      : "Probe prompt requested. Waiting for ChatGPT.";
  } catch {
    status.textContent = "Delivery uncertain. The probe will not resend.";
  } finally {
    if (delivery) {
      // A diagnostic failure must never cause the message to be sent again.
      await app.callServerTool({
        name: "note_probe_delivery",
        arguments: { delivery, outcome },
      }).catch(() => {});
    }
  }
};

app.connect().catch(() => {
  status.textContent = "Could not initialize the ChatGPT widget.";
});
