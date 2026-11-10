import {spawn} from "node:child_process";
import {isAbsolute} from "node:path";

const MAX_FRAME = 1024 * 1024;
const RPC_TIMEOUT = 15_000;

// The caller owns durable reservations and reconciliation. This transport never
// replays a request, including when the server dies before acknowledging a turn.
export class CodexAppServer {
  #child;
  #pending = new Map();
  #nextId = 0;
  #ready = false;
  #closed = false;
  #exited;
  #loaded = new Set();
  #onRequest;
  #onDisconnect;
  #dynamicTools;

  constructor({executable, cwd, onEvent, onRequest, onDisconnect, dynamicTools, launchOptions = []}) {
    if (!isAbsolute(executable) || !isAbsolute(cwd) || typeof onEvent !== "function")
      throw new Error("CODEX_TRUSTED_LAUNCH_CONFIG_REQUIRED");

    this.#onRequest = onRequest;
    this.#onDisconnect = onDisconnect;
    this.#dynamicTools = dynamicTools;
    this.#child = spawn(executable, ["app-server", "--listen", "stdio://", ...launchOptions], {
      cwd, windowsHide: true, stdio: ["pipe", "pipe", "ignore"]
    });
    this.#exited = new Promise(resolve => this.#child.once("close", resolve));
    this.#child.once("error", () => this.#disconnect("CODEX_PROCESS_ERROR"));
    this.#child.once("close", () => this.#disconnect("CODEX_DISCONNECTED"));
    this.#child.stdin.on("error", () => this.#disconnect("CODEX_WRITE_FAILED"));
    void this.#read(onEvent).catch(() => this.#disconnect("CODEX_PROTOCOL_ERROR"));
  }

  async initialize() {
    if (this.#ready || this.#nextId !== 0) throw new Error("CODEX_ALREADY_INITIALIZED");
    await this.#request("initialize", {
      clientInfo: {name: "lazyprompting", title: "LazyPrompting", version: "0.1.0"},
      ...(this.#dynamicTools ? {capabilities: {experimentalApi: true}} : {})
    });
    this.#send({method: "initialized"});
    this.#ready = true;
  }

  async startThread(cwd) {
    if (!isAbsolute(cwd)) throw new Error("CODEX_WORKSPACE_PATH_REQUIRED");
    const result = await this.#call("thread/start", {
      cwd, sandbox: "read-only", approvalPolicy: "never",
      ...(this.#dynamicTools ? {dynamicTools: this.#dynamicTools} : {})
    });
    this.#loaded.add(result.thread.id);
    return result;
  }

  resumeThread(threadId) {
    return this.#call("thread/resume", {threadId, excludeTurns: true, sandbox: "read-only", approvalPolicy: "never"});
  }

  async ensureThread(threadId) {
    if (this.#loaded.has(threadId)) return;
    const {thread} = await this.resumeThread(threadId);
    if (thread?.id !== threadId || thread.status?.type !== "idle")
      throw new Error("CODEX_THREAD_NOT_IDLE");
    this.#loaded.add(threadId);
  }

  startTurn(threadId, text, workspace) {
    if (typeof text !== "string" || !text.trim() || text.length > 12_000)
      throw new Error("CODEX_INVALID_PROMPT");
    return this.#call("turn/start", {threadId, input: [{type: "text", text}], ...workspace});
  }

  runCommand(command, cwd, sandboxPolicy) {
    if (!this.#ready) throw new Error("CODEX_NOT_INITIALIZED");
    return this.#request("command/exec", {command, cwd, sandboxPolicy, timeoutMs:30_000}, 35_000);
  }

  interruptTurn(threadId, turnId) {
    return this.#call("turn/interrupt", {threadId, turnId});
  }

  listRecentTurns(threadId, limit = 1, cursor) {
    return this.#call("thread/turns/list", {threadId, limit, cursor, itemsView: "notLoaded"});
  }

  listRecentTurnItems(threadId, turnId) {
    return this.#call("thread/items/list", {threadId, turnId, limit: 20, sortDirection: "desc"});
  }

  async close() {
    this.#disconnect("CODEX_CLOSED");
    await this.#exited;
  }

  #call(method, params) {
    if (!this.#ready) throw new Error("CODEX_NOT_INITIALIZED");
    return this.#request(method, params);
  }

  #request(method, params, timeout = RPC_TIMEOUT) {
    if (this.#closed) throw new Error("CODEX_DISCONNECTED");
    if (this.#pending.size >= 16) throw new Error("CODEX_REQUEST_LIMIT");
    const id = ++this.#nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.#disconnect("CODEX_RPC_TIMEOUT"), timeout);
      this.#pending.set(id, {resolve, reject, timer});
      try {
        this.#send({id, method, params});
      } catch {
        this.#disconnect("CODEX_WRITE_FAILED");
      }
    });
  }

  #send(message) {
    if (this.#closed) throw new Error("CODEX_DISCONNECTED");
    this.#child.stdin.write(JSON.stringify(message) + "\n");
  }

  async #read(onEvent) {
    let frame = Buffer.alloc(0);
    for await (const chunk of this.#child.stdout) {
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf(10, start);
        const end = newline < 0 ? chunk.length : newline;
        const part = chunk.subarray(start, end);
        if (frame.length + part.length > MAX_FRAME) throw new Error("CODEX_FRAME_TOO_LARGE");
        frame = Buffer.concat([frame, part]);
        if (newline < 0) break;
        this.#receive(JSON.parse(frame.toString("utf8")), onEvent);
        frame = Buffer.alloc(0);
        start = end + 1;
      }
    }
  }

  #receive(message, onEvent) {
    if (this.#closed) return;
    if (!message || typeof message !== "object" || Array.isArray(message))
      throw new Error("CODEX_INVALID_FRAME");
    if (typeof message.method === "string") {
      if (Object.hasOwn(message, "id")) {
        const result = this.#onRequest?.(message);
        if (result) {
          void Promise.resolve(result).then(value => {
            if (!this.#closed) this.#send({id: message.id, result: value});
          }).catch(() => this.#disconnect("CODEX_TOOL_RESPONSE_FAILED"));
        } else {
          this.#send({id: message.id, error: {code: -32601, message: "Request not authorized"}});
        }
      } else {
        onEvent(message);
      }
      return;
    }
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    if (Object.hasOwn(message, "result") && !Object.hasOwn(message, "error")) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error("CODEX_RPC_REJECTED"));
    }
  }

  #disconnect(reason) {
    if (this.#closed) return;
    this.#closed = true;
    this.#onDisconnect?.();
    this.#child.stdin.destroy();
    this.#child.kill();
    for (const {reject, timer} of this.#pending.values()) {
      clearTimeout(timer);
      reject(new Error(reason));
    }
    this.#pending.clear();
  }
}
