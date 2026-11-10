import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { build } from "esbuild";
import { z } from "zod";

const token = () => randomBytes(24).toString("hex");
const id = z.string().regex(/^[0-9a-f]{48}$/);
const widget = "ui://lazyprompting/chat-probe.html";
const widgetMime = "text/html;profile=mcp-app";
const widgetMetadata = {
  ui: { resourceUri: widget },
  "openai/outputTemplate": widget,
  "openai/widgetAccessible": true,
};
const result = (text) => ({ content: [{ type: "text", text }] });
const denied = { ...result("Invalid, expired, or already used probe capability."), isError: true };
const annotations = { destructiveHint: false, openWorldHint: false };
const widgetOnly = { ui: { visibility: ["app"] }, "openai/visibility": "private", "openai/widgetAccessible": true };
const trace = (event, session, details = {}) => process.stderr.write(JSON.stringify({
  event, workspace: session.workspace, round: session.turn, ...details,
}) + "\n");
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("./chatgpt-probe-widget.mjs", import.meta.url))],
  bundle: true,
  minify: true,
  write: false,
});
const script = outputFiles[0].text.replaceAll(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<p id="status" role="status">LazyPrompting probe</p><script>${script}</script>`;
const port = Number(process.env.LAZY_CHAT_PROBE_PORT ?? 38764);
const endpointKey = id.parse(process.env.LAZY_CHAT_PROBE_ENDPOINT_KEY ?? token());
const path = `/${endpointKey}/mcp`;
const expires = Date.now() + 30 * 60_000;
const pendingDelivery = new Map();

// shortcut: synthetic probe state is process-local; restart invalidates every outstanding send.
const sessions = Array.from({ length: 5 }, (_, index) => ({
  workspace: `Browser 0${index + 1}`,
  left: index * 2 + 1,
  add: index + 3,
  bind: token(),
  turn: 0,
  phase: "unbound",
  answers: [],
}));

function prepare(session) {
  session.turn += 1;
  session.phase = "ready";
  session.claim = token();
  session.receipt = token();
  trace("ready", session);
  return {
    ...result(`${session.workspace} is ready for round ${session.turn}.`),
    _meta: { claim: session.claim },
  };
}

function createMcp() {
  const server = new McpServer({ name: "LazyPrompting Chat Probe", version: "0.1.0" });
  server.registerResource("probe", widget, { mimeType: widgetMime }, async () => ({
    contents: [{ uri: widget, mimeType: widgetMime, text: html }],
  }));
  server.registerTool("bind_probe", {
    description: "Attach a one-time synthetic two-round LazyPrompting probe to this conversation. Only call when the user supplies a binding code.",
    inputSchema: { code: id },
    annotations,
    _meta: widgetMetadata,
  }, ({ code }) => {
    const session = sessions.find((item) => item.bind === code && item.phase === "unbound");
    return session ? prepare(session) : denied;
  });
  server.registerTool("claim_probe_prompt", {
    description: "Reserve the pending probe prompt once for its conversation widget.",
    inputSchema: { claim: id },
    annotations,
    _meta: widgetOnly,
  }, ({ claim }) => {
    const session = sessions.find((item) => item.claim === claim && item.phase === "ready");
    if (!session) return denied;
    session.phase = "awaiting_answer";
    const delivery = token();
    pendingDelivery.set(delivery, { workspace: session.workspace, turn: session.turn });
    trace("claimed", session);
    const question = session.turn === 1
      ? `What is ${session.left} + ${session.left}?`
      : `Add ${session.add} to your previous answer. What is the result?`;
    return {
      ...result("Prompt reserved. Do not replay it if delivery is uncertain."),
      _meta: {
        delivery,
        prompt: `${question} Show the answer in this chat and call the LazyPrompting Chat Probe tool report_probe_answer with receipt ${session.receipt} and the numeric answer.`,
      },
    };
  });
  server.registerTool("note_probe_delivery", {
    description: "Record the MCP Apps host response to the widget's send request.",
    inputSchema: { delivery: id, outcome: z.enum(["accepted", "rejected", "uncertain"]) },
    annotations,
    _meta: widgetOnly,
  }, ({ delivery, outcome }) => {
    const session = pendingDelivery.get(delivery);
    if (!session) return denied;
    pendingDelivery.delete(delivery);
    trace("host_send_response", session, { outcome });
    return result("Host response recorded.");
  });
  server.registerTool("report_probe_answer", {
    description: "Report the numeric answer for the receipt in the current LazyPrompting probe prompt.",
    inputSchema: { receipt: id, answer: z.number().int().min(-1000).max(1000) },
    annotations,
    _meta: widgetMetadata,
  }, ({ receipt, answer }) => {
    const session = sessions.find((item) => item.receipt === receipt && item.phase === "awaiting_answer");
    if (!session) return denied;
    session.answers.push(answer);
    const expected = session.left * 2 + (session.turn === 2 ? session.add : 0);
    const correct = answer === expected;
    trace("answer", session, { answer, expected, correct });
    if (correct && session.turn === 1) return prepare(session);
    session.phase = correct ? "complete" : "incorrect";
    return result(`${session.workspace} probe ${session.phase}.`);
  });
  return server;
}

const http = createServer(async (request, response) => {
  if (request.url !== path || Date.now() >= expires) {
    response.writeHead(404).end();
    return;
  }
  const server = createMcp();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  response.once("close", () => void server.close());
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});

http.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({
    endpoint: `http://127.0.0.1:${http.address().port}${path}`,
    expires: new Date(expires).toISOString(),
    bindings: sessions.map(({ workspace, bind }) => ({ workspace, code: bind })),
  }));
});
