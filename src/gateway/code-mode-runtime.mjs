// Confined Code Mode for the existing gateway capability owner.
// Acorn parses the source. No eval, Function, vm or host globals are exposed.
// Only explicitly listed read/pure capabilities may cross the interpreter.
import {parse} from "acorn";
import {getCapability} from "./capability-registry.mjs";

const PERMITTED = Object.freeze(["supervisor.status", "supervisor.evaluate"]);
// Metadata tools are Code Mode-only projections of the existing MCP catalog.
// They do not grant authority to invoke any of the capabilities they describe.
const METADATA = Object.freeze({
  "capabilities.search": {
    name:"capabilities.search", effect:"READ",
    description:"Search available gateway capabilities (metadata only, never invokes them)",
    inputSchema:{type:"object",properties:{
      query:{type:"string",maxLength:256},
      limit:{type:"integer",minimum:1,maximum:8}
    },required:["query"],additionalProperties:false}
  },
  "capabilities.describe": {
    name:"capabilities.describe", effect:"READ",
    description:"Read one registered capability schema, effect and readiness (metadata only)",
    inputSchema:{type:"object",properties:{
      name:{type:"string",minLength:1,maxLength:128}
    },required:["name"],additionalProperties:false}
  },
  "goal.status": {
    name:"goal.status", effect:"READ", requiresNativeGoalBinding:true,
    description:"Read the exact approved Codex V1 goal already leased by this native MCP client; no mutations or independent QA",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "workspace.location": {
    name:"workspace.location", effect:"READ", requiresNativeWorkspaceLease:true,
    description:"Read only the HTTPS origin of the current approved supporting tab; never the ChatGPT main view, URL path, query or page content",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  }
});
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_CODE = 4096;
const MAX_CALLS = 8;
const MAX_NODES = 1500;
const MAX_LOOPS = 32;
const MAX_DEPTH = 32;
const MAX_OUTPUT = 6000;
const MAX_TOOL_RESULT = 16000;
const DEADLINE_MS = 2000;
const NATIVE_GOAL_RUN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/i;
const NATIVE_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const GOAL_STATES = new Set([
 "AWAITING_SCOPE_REVIEW","REVIEW_INTERRUPTED","SCOPE_REVIEWED","STARTING",
 "RUNNING","PAUSE_REQUESTED","PAUSED","NEEDS_ATTENTION","REVIEW_COMPLETE",
 "CODING_COMPLETE","STOPPED","DECLINED","RECONCILE_REQUIRED"
]);
const TASK_STATES = new Set([
 "QUEUED","RUNNING","REVIEWED","VERIFIED","BLOCKED","STOPPED","PAUSED",
 "RECONCILE_REQUIRED","UNKNOWN"
]);
const CHECK_STATES = new Set(["NOT_RECORDED","RECORDED_PASS","RECORDED_FAIL"]);
const WORKSPACE = /^workspace-(0[1-9]|10)$/;
const SUPPORT_TAB = /^tab-0[1-3]$/;
export function validateNativeCodeModeBrowser(value) {
 if (!exactKeys(value,["source","workspaceId","tabId","origin",
      "chatContentRead","nextPromptAllowed"]) ||
     value.source !== "NATIVE_SUPPORT_TAB_ORIGIN" ||
     !WORKSPACE.test(value.workspaceId??"") ||
     !SUPPORT_TAB.test(value.tabId??"") ||
     value.chatContentRead !== false || value.nextPromptAllowed !== false ||
     typeof value.origin !== "string" || value.origin.length>256) {
   throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");
 }
 let url;
 try {url = new URL(value.origin);} catch {throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");}
 const host=url.hostname.replace(/\.$/,"");
 if (url.protocol !== "https:" || url.origin !== value.origin ||
     url.username || url.password || host === "localhost" || host === "127.0.0.1" ||
     host.endsWith(".localhost") || host === "chatgpt.com" ||
     host.endsWith(".chatgpt.com") || host === "openai.com" ||
     host.endsWith(".openai.com")) {
   throw Error("CODE_MODE_WORKSPACE_BINDING_INVALID");
 }
 return JSON.parse(JSON.stringify(value));
}
const exactKeys = (object, keys) => object && typeof object === "object" &&
 !Array.isArray(object) &&
 Object.keys(object).sort().join(",") === [...keys].sort().join(",");
export function validateNativeCodeModeGoal(value) {
 if (!exactKeys(value,["source","schemaVersion","runId","state","mode",
     "baseSha","checkpointRevision","taskCount","tasks",
     "qa","chatTurnVerified","nextPromptAllowed"]) ||
   value.source !== "NATIVE_CODEX_V1_RUN_STATUS" || value.schemaVersion !== 1 ||
   !NATIVE_GOAL_RUN.test(value.runId??"") || !NATIVE_SHA.test(value.baseSha??"") ||
   !GOAL_STATES.has(value.state) ||
   !["READ_ONLY","WORKTREE_WRITE"].includes(value.mode) ||
   !Number.isSafeInteger(value.checkpointRevision) || value.checkpointRevision<0 ||
   !Number.isSafeInteger(value.taskCount) || value.taskCount<1 || value.taskCount>8 ||
   value.qa !== "NOT_VERIFIED" || value.chatTurnVerified !== false ||
   value.nextPromptAllowed !== false || !Array.isArray(value.tasks) ||
   value.tasks.length>value.taskCount)
   throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 for (const [i,task] of value.tasks.entries()) {
   if (!exactKeys(task,["id","state","recordedCheck","recordedChecks","lastExitCode"]) ||
       task.id !== "task-"+(i+1) || !TASK_STATES.has(task.state) ||
       !CHECK_STATES.has(task.recordedCheck) ||
       !Number.isSafeInteger(task.recordedChecks) ||
       task.recordedChecks<0 || task.recordedChecks>2 ||
       (task.lastExitCode!==null && !Number.isSafeInteger(task.lastExitCode)))
     throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 }
 const json = JSON.stringify(value);
 if (json.length>MAX_TOOL_RESULT) throw Error("CODE_MODE_GOAL_BINDING_INVALID");
 return JSON.parse(json);
}
const fail = code => {throw Error(code)};
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const property = (node) => {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && (typeof node.value === "string" || Number.isSafeInteger(node.value)))
    return String(node.value);
  fail("CODE_MODE_PROPERTY_DENIED");
};
const safeKey = key => {
  if (typeof key !== "string" || FORBIDDEN_KEYS.has(key)) fail("CODE_MODE_PROPERTY_DENIED");
  return key;
};
const toolPath = callee => {
  const parts = [];
  while (callee?.type === "MemberExpression" && !callee.computed) {
    parts.unshift(safeKey(property(callee.property)));
    callee = callee.object;
  }
  return callee?.type === "Identifier" && callee.name === "tools" ? parts.join(".") : null;
};

export function codeModeCatalog() {
  return {
    engine: "CONFINED_JS_READ_ONLY",
    authorization: "READ_ONLY_ALLOWLIST",
    nativeHostAuthentication: "REQUIRED_BY_INSTALLED_DESKTOP_FACADE",
    catalogScope: "NODE_GATEWAY",
    maxCodeChars: MAX_CODE,
    maxToolCalls: MAX_CALLS,
    maxOutputChars: MAX_OUTPUT,
    capabilities: PERMITTED.map(name => {
      const c = getCapability(name);
      return {name, effect:c.effect, description:c.description, inputSchema:c.inputSchema};
    }),
    builtins: Object.values(METADATA),
    example: "const s = await tools.supervisor.status(); return {gateway:s.gateway};",
    limits: "No ambient JS globals, imports, filesystem, network, worker or browser access"
  };
}

export async function executeCodeMode(source, {invoke,search,describe,nativeGoal=null,nativeBrowser=null} = {}) {
  if (typeof source !== "string" || !source.trim() || source.length > MAX_CODE ||
      typeof invoke !== "function")
    return {status:"ERROR", code:"CODE_MODE_INVALID_INPUT"};
  let attachedGoal = null;
  let attachedBrowser = null;
  try {
    if (nativeGoal !== null) attachedGoal = validateNativeCodeModeGoal(nativeGoal);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_GOAL_BINDING_INVALID"};
  }
  try {
    if (nativeBrowser !== null) attachedBrowser = validateNativeCodeModeBrowser(nativeBrowser);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_WORKSPACE_BINDING_INVALID"};
  }
  let syntax;
  try {
    syntax = parse(source, {
      ecmaVersion:"latest", sourceType:"script",
      allowAwaitOutsideFunction:true, allowReturnOutsideFunction:true
    });
  } catch {
    return {status:"ERROR", code:"CODE_MODE_SYNTAX"};
  }
  let nodes = 0, calls = 0;
  const deadline = Date.now() + DEADLINE_MS;
  const check = depth => {
    nodes++;
    if (nodes > MAX_NODES) fail("CODE_MODE_STEP_LIMIT");
    if (depth > MAX_DEPTH) fail("CODE_MODE_DEPTH_LIMIT");
    if (Date.now() > deadline) fail("CODE_MODE_DEADLINE");
  };
  const copy = (value, limit = MAX_TOOL_RESULT) => {
    const json = JSON.stringify(value);
    if (typeof json !== "string" || json.length > limit) fail("CODE_MODE_DATA_LIMIT");
    return JSON.parse(json);
  };

  async function evaluate(node, vars, depth = 0) {
    check(depth);
    if (!node) fail("CODE_MODE_EXPRESSION_DENIED");
    const visit = value => evaluate(value, vars, depth + 1);
    switch (node.type) {
      case "Literal":
        if (node.value === null || ["string","number","boolean"].includes(typeof node.value))
          return node.value;
        break;
      case "Identifier":
        if (vars.has(node.name)) return vars.get(node.name);
        break;
      case "ArrayExpression": {
        if (node.elements.length > MAX_LOOPS || node.elements.some(x => !x || x.type === "SpreadElement"))
          break;
        const result = [];
        for (const item of node.elements) result.push(await visit(item));
        return copy(result);
      }
      case "ObjectExpression": {
        if (node.properties.length > MAX_LOOPS) break;
        const result = Object.create(null);
        for (const item of node.properties) {
          if (item.type !== "Property" || item.computed || item.method ||
              item.kind !== "init" || item.shorthand) fail("CODE_MODE_OBJECT_DENIED");
          result[safeKey(property(item.key))] = await visit(item.value);
        }
        return copy(result);
      }
      case "AwaitExpression": return visit(node.argument);
      case "MemberExpression": {
        const value = await visit(node.object);
        const key = safeKey(node.computed ? String(await visit(node.property)) : property(node.property));
        if ((Array.isArray(value) || typeof value === "string") && key === "length")
          return value.length;
        if (value !== null && (typeof value === "object" || typeof value === "string") &&
            has(Object(value), key)) return value[key];
        return null;
      }
      case "UnaryExpression": {
        const value = await visit(node.argument);
        if (node.operator === "!") return !value;
        if (node.operator === "-" && typeof value === "number") return -value;
        if (node.operator === "+" && typeof value === "number") return +value;
        break;
      }
      case "BinaryExpression": {
        const left = await visit(node.left), right = await visit(node.right);
        switch (node.operator) {
          case "===": return left === right;
          case "!==": return left !== right;
          case "<": return left < right;
          case "<=": return left <= right;
          case ">": return left > right;
          case ">=": return left >= right;
          case "+": {
            if (typeof left === "string" || typeof right === "string") {
              const a = String(left), b = String(right);
              if (a.length + b.length > MAX_TOOL_RESULT) fail("CODE_MODE_DATA_LIMIT");
              return a + b;
            }
            if (typeof left !== "number" || typeof right !== "number") fail("CODE_MODE_ARGUMENTS_INVALID");
            return left + right;
          }
          case "-": return left - right;
          case "*": return left * right;
          case "/": return left / right;
          default: break;
        }
        break;
      }
      case "LogicalExpression": {
        const left = await visit(node.left);
        if (node.operator === "&&") return left && await visit(node.right);
        if (node.operator === "||") return left || await visit(node.right);
        if (node.operator === "??") return left ?? await visit(node.right);
        break;
      }
      case "ConditionalExpression":
        return await visit(node.test) ? visit(node.consequent) : visit(node.alternate);
      case "TemplateLiteral": {
        let output = "";
        for (let i = 0; i < node.quasis.length; i++) {
          const literal = node.quasis[i].value.cooked ?? "";
          if (output.length + literal.length > MAX_TOOL_RESULT) fail("CODE_MODE_DATA_LIMIT");
          output += literal;
          if (i < node.expressions.length) {
            const interpolated = String(await visit(node.expressions[i]));
            if (output.length + interpolated.length > MAX_TOOL_RESULT) fail("CODE_MODE_DATA_LIMIT");
            output += interpolated;
          }
        }
        return output;
      }
      case "CallExpression": {
        if (node.optional || node.arguments.some(x => x.type === "SpreadElement")) break;
        const path = toolPath(node.callee);
        if (path !== null) {
          const builtin = Object.hasOwn(METADATA, path);
          const registered = getCapability(path);
          if (!builtin && (!PERMITTED.includes(path) ||
              !registered || !["READ","PURE"].includes(registered.effect)))
            fail("CODE_MODE_CAPABILITY_DENIED");
          if (++calls > MAX_CALLS) fail("CODE_MODE_CALL_LIMIT");
          if (node.arguments.length > 1) fail("CODE_MODE_ARGUMENTS_INVALID");
          const args = node.arguments.length ? await visit(node.arguments[0]) : {};
          if (!args || typeof args !== "object" || Array.isArray(args))
            fail("CODE_MODE_ARGUMENTS_INVALID");
          const params = copy(args);
          let response;
          if (path === "capabilities.search") {
            const keys = Object.keys(params);
            if (keys.some(key => !["query","limit"].includes(key)) ||
                typeof params.query !== "string" || params.query.length > 256 ||
                (params.limit !== undefined && (!Number.isSafeInteger(params.limit) ||
                 params.limit < 1 || params.limit > 8)))
              fail("CODE_MODE_ARGUMENTS_INVALID");
            if (typeof search !== "function") fail("CODE_MODE_CAPABILITY_DENIED");
            response = await search(params.query,params.limit ?? 4);
          } else if (path === "capabilities.describe") {
            if (Object.keys(params).length !== 1 || typeof params.name !== "string" ||
                !params.name || params.name.length > 128)
              fail("CODE_MODE_ARGUMENTS_INVALID");
            if (typeof describe !== "function") fail("CODE_MODE_CAPABILITY_DENIED");
            response = await describe(params.name);
          } else if (path === "goal.status") {
            // No user-selected goal identity or execution authority in code.
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedGoal === null) fail("CODE_MODE_CAPABILITY_DENIED");
            response = {status:"OK",structuredContent:attachedGoal};
          } else if (path === "workspace.location") {
            // Native host already checked the same verified client's workspace
            // lease and projected an origin-only supporting-tab snapshot.
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedBrowser === null) fail("CODE_MODE_CAPABILITY_DENIED");
            response = {status:"OK",structuredContent:attachedBrowser};
          } else {
            response = await invoke(path,params);
          }
          if (response?.status !== "OK") fail("CODE_MODE_CAPABILITY_FAILED");
          return copy(response.structuredContent);
        }
        if (node.callee?.type !== "MemberExpression" || node.callee.computed) break;
        const method = safeKey(property(node.callee.property));
        if (node.callee.object?.type === "Identifier") {
          const root = node.callee.object.name;
          if (root === "Array" && method === "isArray" && node.arguments.length === 1)
            return Array.isArray(await visit(node.arguments[0]));
          if (root === "Object" && method === "keys" && node.arguments.length === 1) {
            const target = await visit(node.arguments[0]);
            if (!target || typeof target !== "object") fail("CODE_MODE_ARGUMENTS_INVALID");
            return Object.keys(target).filter(k => !FORBIDDEN_KEYS.has(k));
          }
        }
        const owner = await visit(node.callee.object);
        const args = [];
        for (const arg of node.arguments) args.push(await visit(arg));
        if (Array.isArray(owner)) {
          if (method === "push" && args.length === 1 && owner.length < MAX_LOOPS)
            {
              const item = copy(args[0]);
              if (JSON.stringify(owner).length + JSON.stringify(item).length > MAX_TOOL_RESULT)
                fail("CODE_MODE_DATA_LIMIT");
              return owner.push(item);
            }
          if (method === "slice" && args.length <= 2 && args.every(Number.isSafeInteger))
            return owner.slice(...args);
          if (method === "includes" && args.length === 1)
            return owner.includes(args[0]);
        }
        if (typeof owner === "string" && method === "includes" &&
            args.length === 1 && typeof args[0] === "string")
          return owner.includes(args[0]);
        break;
      }
      default: break;
    }
    fail("CODE_MODE_EXPRESSION_DENIED");
  }

  async function statements(body, vars, depth = 0) {
    check(depth);
    let last = null;
    for (const node of body) {
      check(depth + 1);
      if (node.type === "VariableDeclaration" && ["const","let"].includes(node.kind)) {
        for (const item of node.declarations) {
          if (item.id.type !== "Identifier" || !item.init ||
              vars.has(item.id.name) || ["tools","Array","Object"].includes(item.id.name))
            fail("CODE_MODE_BINDING_DENIED");
          vars.set(item.id.name, copy(await evaluate(item.init, vars, depth + 2)));
        }
      } else if (node.type === "ExpressionStatement") {
        last = await evaluate(node.expression, vars, depth + 2);
      } else if (node.type === "ReturnStatement") {
        return {returned:true, value:node.argument ? await evaluate(node.argument, vars, depth + 2) : null};
      } else if (node.type === "BlockStatement") {
        const nested = await statements(node.body, new Map(vars), depth + 2);
        if (nested.returned) return nested;
      } else if (node.type === "IfStatement") {
        const selected = await evaluate(node.test, vars, depth + 2) ? node.consequent : node.alternate;
        if (selected) {
          const nested = await statements(selected.type === "BlockStatement" ? selected.body : [selected],
            new Map(vars), depth + 2);
          if (nested.returned) return nested;
        }
      } else if (node.type === "ForOfStatement") {
        if (node.await || node.left.type !== "VariableDeclaration" ||
            node.left.kind !== "const" || node.left.declarations.length !== 1 ||
            node.left.declarations[0].id.type !== "Identifier" ||
            node.left.declarations[0].init)
          fail("CODE_MODE_LOOP_DENIED");
        const items = await evaluate(node.right, vars, depth + 2);
        if (!Array.isArray(items) || items.length > MAX_LOOPS)
          fail("CODE_MODE_LOOP_LIMIT");
        const identifier = node.left.declarations[0].id.name;
        if (["tools","Array","Object"].includes(identifier)) fail("CODE_MODE_BINDING_DENIED");
        for (const entry of items) {
          const scoped = new Map(vars);
          scoped.set(identifier, entry);
          const nested = await statements(
            node.body.type === "BlockStatement" ? node.body.body : [node.body],
            scoped, depth + 2);
          if (nested.returned) return nested;
        }
      } else if (node.type === "EmptyStatement") {
        continue;
      } else fail("CODE_MODE_STATEMENT_DENIED");
    }
    return {returned:false,value:last};
  }

  try {
    const result = await statements(syntax.body, new Map());
    const value = copy(result.value, MAX_OUTPUT);
    const content = {value,toolCalls:calls,steps:nodes,mode:"READ_ONLY"};
    copy(content, MAX_OUTPUT);
    return {status:"OK",structuredContent:content};
  } catch (e) {
    const code = String(e?.message ?? "");
    return {status:"ERROR",code:/^CODE_MODE_[A-Z_]+$/.test(code) ? code : "CODE_MODE_DENIED"};
  }
}
