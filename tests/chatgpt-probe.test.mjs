import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("probe isolates five conversations and never reissues a claimed turn", async (t) => {
  const child = spawn(process.execPath, ["src/mcp/chatgpt-probe.mjs"], {
    env: { ...process.env, LAZY_CHAT_PROBE_PORT: "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const { value } = await lines[Symbol.asyncIterator]().next();
  const { endpoint, bindings } = JSON.parse(value);
  const client = new Client({ name: "probe-test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  t.after(() => client.close());
  assert.equal((await client.listTools()).tools.length, 4);
  const call = (name, args) => client.callTool({ name, arguments: args });

  await Promise.all(bindings.map(async ({ code, workspace }, index) => {
    const bound = await call("bind_probe", { code });
    assert.match(bound.content[0].text, new RegExp(workspace));
    assert.equal((await call("bind_probe", { code })).isError, true);
    const claim = bound._meta.claim;
    const first = await call("claim_probe_prompt", { claim });
    assert.equal((await call("claim_probe_prompt", { claim })).isError, true);
    const delivery = { delivery: first._meta.delivery, outcome: "accepted" };
    const operand = index * 2 + 1;
    assert.ok(first._meta.prompt.startsWith(`What is ${operand} + ${operand}?`));
    const receipt = (prompt) => prompt.match(/receipt ([a-f0-9]{48})/)[1];
    const firstReport = { receipt: receipt(first._meta.prompt), answer: operand * 2 };
    const next = await call("report_probe_answer", firstReport);
    assert.equal((await call("note_probe_delivery", delivery)).isError, undefined);
    assert.equal((await call("note_probe_delivery", delivery)).isError, true);
    assert.equal((await call("report_probe_answer", firstReport)).isError, true);
    const second = await call("claim_probe_prompt", { claim: next._meta.claim });
    const add = index + 3;
    assert.ok(second._meta.prompt.startsWith(`Add ${add} to your previous answer.`));
    const done = await call("report_probe_answer", {
      receipt: receipt(second._meta.prompt), answer: firstReport.answer + add,
    });
    assert.equal(done.content[0].text, `${workspace} probe complete.`);
  }));
});
