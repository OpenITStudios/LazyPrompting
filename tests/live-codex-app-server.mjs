// Opt-in live check. Uses the signed-in Codex account for one read-only turn.
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {CodexAppServer} from "../src/transport/codex-app-server.mjs";

const executable = process.argv[2];
if (!executable) throw new Error("Pass the absolute path to the authorized Codex CLI executable");

const cwd = await mkdtemp(join(tmpdir(), "lazyprompting-codex-"));
const events = [];
let server;
try {
  server = new CodexAppServer({
    executable, cwd, onEvent: event => {
      if (event.method === "turn/completed" ||
          (event.method === "item/completed" && event.params.item.type === "agentMessage"))
        events.push(event);
    }
  });
  await server.initialize();
  const {thread} = await server.startThread(cwd);
  const {turn} = await server.startTurn(thread.id, "Reply with LAZYPROMPTING_OK only. Do not use tools.");

  const deadline = Date.now() + 60_000;
  let completion;
  while (!completion && Date.now() < deadline) {
    completion = events.find(event => event.method === "turn/completed" &&
      event.params.threadId === thread.id && event.params.turn.id === turn.id);
    if (!completion) await delay(200);
  }
  assert.equal(completion?.params.turn.status, "completed");
  assert.ok(events.some(event => event.method === "item/completed" &&
    event.params.threadId === thread.id && event.params.turnId === turn.id &&
    event.params.item.text.trim() === "LAZYPROMPTING_OK"));

  await server.close();
  server = new CodexAppServer({executable, cwd, onEvent: () => {}});
  await server.initialize();
  assert.equal((await server.resumeThread(thread.id)).thread.id, thread.id);
  console.log("Live Codex: turn completed and the same thread resumed after process restart.");
} finally {
  await server?.close();
  await rm(cwd, {recursive: true, force: true});
}
