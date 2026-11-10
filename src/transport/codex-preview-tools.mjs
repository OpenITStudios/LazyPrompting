import {randomUUID} from "node:crypto";

const TOOL_ACTIONS = new Map([
  ["lazyprompting_open_preview", "open"],
  ["lazyprompting_read_preview", "snapshot"],
  ["lazyprompting_close_preview", "close"]
]);
const ID = /^[A-Za-z0-9:_-]{1,128}$/;
const TTL = 120_000;
const denied = reason => ({success: false, contentItems: [{type: "inputText", text: reason}]});

export const previewToolDefinitions = [...TOOL_ACTIONS].map(([name, action]) => ({
  type: "function", name,
  description: `${action} the fixed local Lightpanda preview in this workspace with native operator permission.`,
  inputSchema: {type: "object", properties: {}, additionalProperties: false}
}));

// Requests stay in memory and are never replayed across an App Server restart.
export class CodexPreviewTools {
  #pending = new Map();
  #used = new Map();

  receive(message) {
    if (message.method !== "item/tool/call") return null;
    const params = message.params ?? {};
    const {threadId, turnId, callId, tool, arguments: args, namespace} = params;
    if (!TOOL_ACTIONS.has(tool) || namespace != null ||
        ![threadId, turnId, callId].every(id => typeof id === "string" && ID.test(id)) ||
        !args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length ||
        this.#pending.size >= 16)
      return denied("Preview request outside the admitted scope");
    const key = threadId + "/" + turnId;
    const used = this.#used.get(key) ?? new Set();
    if (used.has(tool) || (this.#used.size >= 16 && !this.#used.has(key)))
      return denied("Preview operation already requested for this turn");
    used.add(tool);
    this.#used.set(key, used);
    const token = randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => this.#finish(token, denied("Preview approval expired")), TTL);
      this.#pending.set(token, {threadId, turnId, action: TOOL_ACTIONS.get(tool),
        expires: Date.now() + TTL, timer, resolve, claimed: false});
    });
  }

  notification(event) {
    if (event.method !== "turn/completed") return;
    const {threadId, turn} = event.params ?? {};
    this.cancel(threadId, turn?.id);
    this.#used.delete(threadId + "/" + turn?.id);
  }

  cancel(threadId, turnId) {
    for (const [token, request] of this.#pending) {
      if (request.threadId === threadId && (turnId === undefined || request.turnId === turnId))
        this.#finish(token, denied("Preview request cancelled"));
    }
  }

  peek(threadId, turnId) {
    for (const [token, request] of this.#pending) {
      if (request.threadId === threadId && request.turnId === turnId &&
          !request.claimed && Date.now() < request.expires)
        return {token, action: request.action};
    }
    return null;
  }

  claim(threadId, turnId, token, approved) {
    const request = this.#pending.get(token);
    if (!request || request.threadId !== threadId || request.turnId !== turnId ||
        request.claimed || Date.now() >= request.expires) return false;
    if (approved !== true) {
      this.#finish(token, denied("Operator denied preview access"));
      return false;
    }
    request.claimed = true;
    return true;
  }

  answer(threadId, turnId, token, result) {
    const request = this.#pending.get(token);
    if (!request || !request.claimed || request.threadId !== threadId ||
        request.turnId !== turnId || Date.now() >= request.expires) return false;
    const text = JSON.stringify(result ?? null);
    this.#finish(token, text.length <= 2048 && result?.ok === true
      ? {success: true, contentItems: [{type: "inputText", text}]}
      : denied("Native preview operation failed"));
    return true;
  }

  close() {
    for (const token of this.#pending.keys()) this.#finish(token, denied("Workspace host closed"));
    this.#used.clear();
  }

  #finish(token, result) {
    const request = this.#pending.get(token);
    if (!request) return;
    this.#pending.delete(token);
    clearTimeout(request.timer);
    request.resolve(result);
  }
}
