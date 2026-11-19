import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function openProbe(t, adaptive) {
  const child = spawn(process.execPath, ["src/mcp/chatgpt-probe.mjs"], {
    env: { ...process.env, LAZY_CHAT_PROBE_PORT: "0", LAZY_CHAT_PROBE_ADAPTIVE: adaptive ? "1" : "0" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const { value } = await lines[Symbol.asyncIterator]().next();
  const { endpoint, bindings } = JSON.parse(value);
  const client = new Client({ name: "probe-test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  t.after(() => client.close());
  return { client, bindings, call: (name, args) => client.callTool({ name, arguments: args }) };
}

const receipt = (prompt) => prompt.match(/receipt ([a-f0-9]{48})/)[1];

test("probe isolates five conversations and never reissues a claimed turn", async (t) => {
  const { client, bindings, call } = await openProbe(t, false);
  assert.equal((await client.listTools()).tools.length, 4);

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

test("Browser 01 selects its next prompt from the reported answer and stops after two turns", async (t) => {
  for (const [choice, instruction, expected] of [[2, /Double/, 4], [3, /Square/, 9]]) {
    await t.test(`choice ${choice}`, async (t) => {
      const { bindings, call } = await openProbe(t, true);
      assert.deepEqual(bindings.map(({ workspace }) => workspace), ["Browser 01"]);
      const bound = await call("bind_probe", { code: bindings[0].code });
      const first = await call("claim_probe_prompt", { claim: bound._meta.claim });
      assert.match(first._meta.prompt, /Choose either 2 or 3/);
      const next = await call("report_probe_answer", { receipt: receipt(first._meta.prompt), answer: choice });
      const second = await call("claim_probe_prompt", { claim: next._meta.claim });
      assert.match(second._meta.prompt, instruction);
      const final = { receipt: receipt(second._meta.prompt), answer: expected };
      const done = await call("report_probe_answer", final);
      assert.equal(done.content[0].text, "Browser 01 probe complete.");
      assert.equal(done._meta?.claim, undefined);
      assert.equal((await call("report_probe_answer", final)).isError, true);
    });
  }
});
