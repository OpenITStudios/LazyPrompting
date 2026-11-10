// Opt-in live check. Uses the signed-in Codex account for two read-only turns.
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {CodexAppServer} from "../src/transport/codex-app-server.mjs";
import {ManagedCodexWorkspace} from "../src/transport/managed-codex-workspace.mjs";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {WorkspaceRegistry} from "../src/runtime/workspace-registry.mjs";
import {TrustedPromptPolicy} from "../src/prompt/trusted-prompt-policy.mjs";

const executable = process.argv[2];
if (!executable) throw new Error("Pass the absolute path to the authorized Codex CLI executable");

const cwd = await mkdtemp(join(tmpdir(), "lazyprompting-codex-"));
const events = [];
const registry = new WorkspaceRegistry(join(cwd, "registry.json"));
const outboxPath = join(cwd, "outbox.json");
const hostIdentity = {};
const verifyIdentity = async scope => scope.hostIdentity === hostIdentity;
const workspaceId = "workspace-01";
const policy = new TrustedPromptPolicy({
  readWorkspace: async id => {
    const {workspaces} = await registry.read();
    return {...workspaces.find(workspace => workspace.workspaceId === id), promptLimit: 2};
  },
  verifyIdentity
});
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
  const scope = {workspaceId, sessionId: thread.id, hostIdentity};
  assert.ok((await registry.register(0, {
    workspaceId, sessionId: thread.id, taskIds: ["task-1", "task-2"], status: "READY",
    repository: "OpenITStudios/LazyPrompting", branch: "Local", headSha: "a".repeat(40), contextRevision: 0
  })).ok);
  const outbox = new PromptOutbox(outboxPath);
  const host = new ManagedCodexWorkspace({server, registry, outbox, policy, verifyIdentity});
  const plan = {
    workspaceId, sessionId: thread.id, taskId: "task-1", contextRevision: 0, status: "READY_TO_SEND",
    prompt: "Reply with LAZYPROMPTING_OK only. Do not use tools."
  };
  assert.equal((await host.dispatch(plan, {})).status, "NOT_SENT");
  assert.equal((await host.dispatch(plan, hostIdentity)).status, "SENT");
  const [pending] = await outbox.pending(workspaceId);
  assert.equal(pending.state, "ACKNOWLEDGED");
  const turnId = pending.responseHandle;

  const deadline = Date.now() + 60_000;
  let completion;
  while (!completion && Date.now() < deadline) {
    completion = events.find(event => event.method === "turn/completed" &&
      event.params.threadId === thread.id && event.params.turn.id === turnId);
    if (!completion) await delay(200);
  }
  assert.equal(completion?.params.turn.status, "completed");
  assert.ok(events.some(event => event.method === "item/completed" &&
    event.params.threadId === thread.id && event.params.turnId === turnId &&
    event.params.item.text.trim() === "LAZYPROMPTING_OK"));

  await server.close();
  server = new CodexAppServer({executable, cwd, onEvent: () => {}});
  await server.initialize();
  const reopened = new PromptOutbox(outboxPath);
  const recovered = new ManagedCodexWorkspace({server, registry, outbox: reopened, policy, verifyIdentity});
  assert.equal((await recovered.observe({...scope, hostIdentity: {}})).status, "BLOCKED");
  assert.equal((await recovered.dispatch(plan, hostIdentity)).reason, "WORKSPACE_PROMPT_PENDING");
  const result = await recovered.observe(scope);
  assert.equal(result.status, "OBSERVED");
  assert.equal(result.responseId, turnId);
  assert.equal(result.responseText.trim(), "LAZYPROMPTING_OK");
  assert.deepEqual(await reopened.pending(workspaceId), []);
  assert.equal((await recovered.dispatch(plan, hostIdentity)).reason, "TASK_ALREADY_DISPATCHED");
  const next = {...plan, taskId: "task-2", prompt: "Reply with LAZYPROMPTING_UNCERTAIN only. Do not use tools."};
  const lostAckServer = {
    ensureThread: id => server.ensureThread(id),
    async startTurn(id, prompt) {
      await server.startTurn(id, prompt);
      throw new Error("Simulated loss of the acknowledged turn ID before persistence");
    }
  };
  const uncertain = new ManagedCodexWorkspace({server: lostAckServer, registry, outbox: reopened, policy, verifyIdentity});
  assert.equal((await uncertain.dispatch(next, hostIdentity)).status, "RECONCILE_REQUIRED");
  assert.equal((await reopened.pending(workspaceId))[0].state, "RESERVED");
  const {data: [accepted]} = await server.listRecentTurns(thread.id);
  assert.notEqual(accepted.id, turnId);

  await server.close();
  server = new CodexAppServer({executable, cwd, onEvent: () => {}});
  await server.initialize();
  const afterLoss = new ManagedCodexWorkspace({
    server, registry, outbox: new PromptOutbox(outboxPath), policy, verifyIdentity
  });
  assert.equal((await afterLoss.dispatch(next, hostIdentity)).reason, "WORKSPACE_PROMPT_PENDING");
  assert.equal((await afterLoss.observe(scope)).reason, "DELIVERY_NOT_ACKNOWLEDGED");
  assert.equal((await server.listRecentTurns(thread.id)).data[0].id, accepted.id);
  console.log("Live Codex: durable dispatch, restart reconciliation and no resend after lost acknowledgment.");
} finally {
  await server?.close();
  await rm(cwd, {recursive: true, force: true});
}
