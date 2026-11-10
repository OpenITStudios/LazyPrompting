import {randomUUID} from "node:crypto";
import {execFile} from "node:child_process";
import {mkdir, realpath} from "node:fs/promises";
import {isAbsolute, join} from "node:path";
import {promisify} from "node:util";
import {CodexAppServer} from "./codex-app-server.mjs";
import {ManagedCodexWorkspace} from "./managed-codex-workspace.mjs";
import {PromptOutbox} from "../prompt/prompt-outbox.mjs";
import {TrustedPromptPolicy} from "../prompt/trusted-prompt-policy.mjs";
import {WorkspaceRegistry} from "../runtime/workspace-registry.mjs";

const WORKSPACE = /^workspace-(0[1-9]|10)$/;
const CODEX_VERSION = "codex-cli 0.167.0-alpha.3.2";

// Called only by the authenticated gateway's private host control channel.
export async function createDesktopCodexRuntime({dataDir, executable}) {
  if (typeof dataDir !== "string" || typeof executable !== "string" ||
      !isAbsolute(dataDir) || !isAbsolute(executable))
    throw new Error("CODEX_LAUNCH_CONFIG_REQUIRED");
  await mkdir(dataDir, {recursive: true});
  const {stdout} = await promisify(execFile)(executable, ["--version"], {
    cwd: dataDir, timeout: 5_000, maxBuffer: 4096, windowsHide: true
  });
  if (stdout.trim() !== CODEX_VERSION) throw new Error("CODEX_VERSION_UNSUPPORTED");
  const server = new CodexAppServer({executable, cwd: dataDir, onEvent: () => {}});
  try {
    await server.initialize();
  } catch (error) {
    await server.close();
    throw error;
  }
  const registry = new WorkspaceRegistry(join(dataDir, "workspaces.json"));
  const outbox = new PromptOutbox(join(dataDir, "outbox.json"));
  const hostIdentity = {};
  const verifyIdentity = async scope => scope.hostIdentity === hostIdentity;
  const policy = new TrustedPromptPolicy({
    verifyIdentity,
    readWorkspace: async id => {
      const {workspaces} = await registry.read();
      const workspace = workspaces.find(item => item.workspaceId === id);
      return workspace && {...workspace, promptLimit: 100};
    }
  });
  const host = new ManagedCodexWorkspace({server, registry, outbox, policy, verifyIdentity});

  return {
    close: () => server.close(),
    async run({action, workspaceId, cwd, prompt}) {
      if (typeof workspaceId !== "string" || !WORKSPACE.test(workspaceId))
        throw new Error("INVALID_CODEX_WORKSPACE");
      const current = await registry.read();
      let workspace = current.workspaces.find(item => item.workspaceId === workspaceId);
      if (action === "dispatch") {
        if (typeof cwd !== "string" || !isAbsolute(cwd) || typeof prompt !== "string" ||
            !prompt.trim() || prompt.length > 12_000)
          throw new Error("INVALID_CODEX_WORKSPACE_INPUT");
        if ((await outbox.pending(workspaceId)).length)
          return {status: "NOT_SENT", reason: "WORKSPACE_PROMPT_PENDING"};
        const directory = await realpath(cwd);
        const taskId = randomUUID();
        if (workspace) {
          if (workspace.cwd !== directory) throw new Error("CODEX_WORKSPACE_PATH_CHANGED");
          if (workspace.status !== "READY") throw new Error("CODEX_WORKSPACE_STOPPED");
          if (workspace.taskIds.length >= 100) throw new Error("PROMPT_BUDGET_EXHAUSTED");
          const update = await registry.mutate(current.version, next => {
            next.workspaces.find(item => item.workspaceId === workspaceId).taskIds.push(taskId);
            next.version++;
            return next;
          });
          if (!update.ok) throw new Error("CODEX_WORKSPACE_CHANGED");
        } else {
          const {thread} = await server.startThread(directory);
          // No repository or HEAD is inferred for a local, read-only operator turn.
          workspace = {
            kind: "localCodex", workspaceId, sessionId: thread.id, cwd: directory, taskIds: [taskId],
            contextRevision: 0, status: "READY"
          };
          if (!(await registry.register(current.version, workspace)).ok)
            throw new Error("CODEX_WORKSPACE_CHANGED");
        }
        return host.dispatch({
          status: "READY_TO_SEND", workspaceId, sessionId: workspace.sessionId,
          contextRevision: workspace.contextRevision, taskId, prompt
        }, hostIdentity);
      }
      if (!workspace) return {status: "BLOCKED", reason: "CODEX_WORKSPACE_NOT_BOUND"};
      const scope = {workspaceId, sessionId: workspace.sessionId, hostIdentity};
      if (action === "status") {
        const [pending] = await outbox.pending(workspaceId);
        if (!pending) return {status: workspace.status};
        if (pending.sessionId !== workspace.sessionId || pending.state !== "ACKNOWLEDGED")
          return {status: "RECONCILE_REQUIRED"};
        const {data} = await server.listRecentTurns(workspace.sessionId);
        const turn = data?.find(item => item.id === pending.responseHandle);
        return {status: "ACKNOWLEDGED", turnId: pending.responseHandle, turnStatus: turn?.status ?? null};
      }
      if (action === "observe") return host.observe(scope, {recoverVerified:true});
      if (action === "stop") {
        const stopped = await registry.setStatus(current.version, workspaceId, "STOPPED");
        if (!stopped.ok) throw new Error("CODEX_WORKSPACE_CHANGED");
        const [pending] = await outbox.pending(workspaceId);
        if (pending?.state === "ACKNOWLEDGED") {
          try {
            await host.interrupt(scope);
          } catch {
            return {status: "STOPPED", reason: "INTERRUPT_UNCONFIRMED"};
          }
        }
        return {status: "STOPPED"};
      }
      throw new Error("INVALID_CODEX_ACTION");
    }
  };
}
