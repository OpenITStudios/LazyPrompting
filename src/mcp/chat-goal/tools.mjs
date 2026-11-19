import {z} from "zod";

// This is a registration factory, NOT a server entrypoint. No OAuth issuer,
// authenticated native host transport, public endpoint or background worker
// is created here. The caller must supply a verified host bridge.
const WIDGET = "ui://lazyprompting/chat-goal.html";
const HTML_MIME = "text/html;profile=mcp-app";
const hex = z.string().length(48).regex(/^[a-f0-9]{48}$/);
const inline = limit => z.string().min(1).max(limit).refine(value =>
  value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value),
  "Single-line, nonblank text required");
const oauth = [{type: "oauth2", scopes: ["chat_goal:operate"]}];
const annotations = {readOnlyHint: false, destructiveHint: false,
  openWorldHint: false, idempotentHint: false};
const withWidget = {ui: {resourceUri: WIDGET},
  "openai/outputTemplate": WIDGET, "openai/widgetAccessible": true};
const widgetOnly = {ui: {visibility: ["app"]},
  "openai/widgetAccessible": true};

export function registerChatGoalTools(server, {bridge, widgetHtml} = {}) {
  if (typeof server?.registerTool !== "function" ||
    typeof server?.registerResource !== "function" ||
    typeof bridge?.call !== "function" ||
    typeof widgetHtml !== "string" || widgetHtml.length < 20 ||
    widgetHtml.length > 256_000)
    throw Error("CHAT_GOAL_AUTHENTICATED_REGISTRATION_REQUIRED");

  server.registerResource("chat-goal", WIDGET, {mimeType: HTML_MIME},
    async () => ({contents: [{uri: WIDGET, mimeType: HTML_MIME, text: widgetHtml}]}));

  const add = (name, description, inputSchema, metadata) => server.registerTool(
    name, {description, inputSchema, securitySchemes: oauth, annotations,
      _meta: {...metadata, securitySchemes: oauth}},
    (args, extra) => bridge.call(name, args, extra));

  add("goal.bind", "Bind one native-approved goal using a single-use operator code. No browser or worker action.",
    {code: hex}, withWidget);
  add("goal.report", "Send a concise ChatGPT proposal for Codex review; optional nextAction only for CONTINUE. Never runs Codex or verifies QA.",
    {receipt: hex, outcome: z.enum(["CONTINUE", "DONE_PROPOSED", "BLOCKED", "NEEDS_REVIEW"]),
      summary: inline(600), nextAction: inline(200).optional(),
      evidenceRefs: z.array(z.object({kind: z.enum(["COMMIT", "QA_RECEIPT", "ARTIFACT", "DOCUMENT"]),
        ref: inline(200)}).strict()).max(8)}, withWidget);
  add("turn.claim", "Widget-only, one-time native reservation for a follow-up inside its hosting conversation.",
    {claim: hex}, widgetOnly);
  add("turn.delivery", "Widget-only diagnostic of the host send request; never attests message delivery.",
    {delivery: hex, outcome: z.enum(["accepted", "rejected", "uncertain"])}, widgetOnly);
}
