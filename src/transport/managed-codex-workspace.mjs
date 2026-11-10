import {PromptDispatchGate} from "../prompt/prompt-dispatch-gate.mjs";
import {ResponseObserver} from "../prompt/response-observer.mjs";

const ID = /^[A-Za-z0-9:_-]{1,128}$/;

// Constructed by the trusted runtime. The registry is the owner of workspace
// bindings and the outbox is the owner of Codex turn receipts.
export class ManagedCodexWorkspace {
  #server;
  #outbox;
  #gate;
  #observer;
  #verifySession;

  constructor({server, registry, outbox, policy, verifyIdentity, evaluationQueue}) {
    if (typeof policy?.resolve !== "function" || typeof verifyIdentity !== "function")
      throw new Error("CODEX_HOST_POLICY_REQUIRED");
    this.#server = server;
    this.#outbox = outbox;
    const verifySession = async scope => {
      if (await verifyIdentity(scope) !== true) return false;
      const {workspaceId, sessionId, contextRevision, taskId} = scope;
      const {workspaces} = await registry.read();
      return workspaces.some(workspace => workspace.workspaceId === workspaceId &&
        workspace.sessionId === sessionId &&
        (taskId === undefined || workspace.taskIds.includes(taskId)) &&
        (contextRevision === undefined || workspace.contextRevision === contextRevision));
    };
    this.#verifySession = verifySession;
    this.#gate = new PromptDispatchGate({
      store: outbox, verifySession, policy, singleDispatchPerTask: true,
      sendPrompt: async ({sessionId, prompt}) => {
        await server.ensureThread(sessionId);
        const {turn} = await server.startTurn(sessionId, prompt);
        if (typeof turn?.id !== "string" || !ID.test(turn.id)) throw new Error("CODEX_TURN_ID_REQUIRED");
        return {accepted: true, receipt: {responseHandle: turn.id}};
      }
    });
    this.#observer = new ResponseObserver({
      outbox, verifySession, evaluationQueue,
      observeResponse: async ({sessionId, responseHandle}) => {
        const {data} = await server.listRecentTurns(sessionId);
        const turn = data?.find(value => value.id === responseHandle);
        if (!turn || turn.status === "inProgress") return null;
        if (turn.status !== "completed") throw new Error("CODEX_TURN_" + turn.status);
        const items = await server.listRecentTurnItems(sessionId, responseHandle);
        const message = items.data?.find(entry => entry.turnId === responseHandle &&
          entry.item?.type === "agentMessage" && entry.item.phase !== "commentary")?.item;
        if (typeof message?.text !== "string") return null;
        return {
          complete: true, trusted: true, sessionId, responseHandle,
          responseId: turn.id, text: message.text
        };
      }
    });
  }

  dispatch(plan, hostIdentity) {
    return this.#gate.send(plan, {hostIdentity});
  }

  async observe(scope) {
    try {
      return await this.#observer.inspect(scope);
    } catch {
      return {status: "RECONCILE_REQUIRED", reason: "CODEX_RESULT_UNCONFIRMED"};
    }
  }

  async interrupt(scope) {
    if (!await this.#verifySession(scope))
      throw new Error("CODEX_THREAD_BINDING_MISMATCH");
    const {workspaceId, sessionId} = scope;
    const [pending] = await this.#outbox.pending(workspaceId);
    if (pending?.sessionId !== sessionId || pending.state !== "ACKNOWLEDGED")
      throw new Error("CODEX_TURN_UNCONFIRMED");
    await this.#server.interruptTurn(sessionId, pending.responseHandle);
  }
}
