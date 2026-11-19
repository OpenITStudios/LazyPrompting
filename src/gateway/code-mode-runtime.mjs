// Confined Code Mode for the existing gateway capability owner.
// Acorn parses the source. No eval, Function, vm or host globals are exposed.
// Only explicitly listed read/pure capabilities may cross the interpreter.
import {parse} from "acorn";
import {MAX_TOOL_RESULT,
 validateNativeCodeModeBrowser,
 validateNativeCodeModeAgent,
 validateNativeCodeModeEffectPolicy,
 validateNativeCodeModeReceipt,
 validateNativeCodeModeCatalog,
 validateNativeCodeModeHandoff,
 validateNativeCodeModeRepository,
 validateCodeModeApiGoalStatus,
 validateNativeCodeModeGoal} from "./code-mode-bindings.mjs";
export {
 validateNativeCodeModeBrowser,
 validateNativeCodeModeAgent,
 validateNativeCodeModeEffectPolicy,
 validateNativeCodeModeReceipt,
 validateNativeCodeModeCatalog,
 validateNativeCodeModeHandoff,
 validateNativeCodeModeRepository,
 validateCodeModeApiGoalStatus,
 validateNativeCodeModeGoal} from "./code-mode-bindings.mjs";
import {getCapability} from "./capability-registry.mjs";
import {prepareManualHandoff,validateManualHandoffArguments,
 continueManualHandoff,validateManualContinuationArguments} from "./native-effect-broker.mjs";

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
  },
  "goal.report": {
    name:"goal.report",effect:"READ",requiresNativeGoalBinding:true,
    description:"Project recorded V1 task/check states; neither runner output nor independent QA",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "goal.receipt": {
    name:"goal.receipt",effect:"READ",requiresNativeReceiptBinding:true,
    description:"Read only one already-correlated Codex V1 turn receipt selected by the native host",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "api_goal.status": {
    name:"api_goal.status",effect:"READ",requiresHostApiGoalBinding:true,
    description:"Read a host-selected OpenAI Platform API goal outbox status; no paid call, output, consumer chat or permission",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "agent.status": {
    name:"agent.status",effect:"READ",requiresNativeAgentBinding:true,
    description:"Read a leased Agent V2 source-only status; execution and QA remain unavailable",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "agent.effect_policy": {
    name:"agent.effect_policy",effect:"READ",requiresNativeAgentBinding:true,
    description:"Inspect four actual Rust Agent V2 per-action denial decisions without dispatch or durable reservation",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "checkpoint.summary": {
    name:"checkpoint.summary",effect:"READ",requiresCheckpointStore:true,
    description:"Return bounded phase/recovery indicators from the existing configured checkpoint owner",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "repo.status": {
    name:"repo.status",effect:"READ",requiresNativeGoalBinding:true,
    description:"Read only approved V1 repository Git status counts and pinned SHA equality; no arbitrary CLI, path or contents",
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "capabilities.native": {
    name:"capabilities.native",effect:"READ",requiresNativeCatalog:true,
    description:"Search native Rust MCP capability metadata, never invoke effects or grant permissions",
    inputSchema:{type:"object",properties:{
      query:{type:"string",maxLength:256},
      limit:{type:"integer",minimum:1,maximum:8}
    },required:["query"],additionalProperties:false}
  },
  "handoff.reconcile": {
    name:"handoff.reconcile",effect:"READ",
    description:"Inspect only the host-owned manual draft inbox in the existing leased workspace; empty is not proof of no previous effect",
    requiresNativeWorkspaceLease:true,
    inputSchema:{type:"object",properties:{},additionalProperties:false}
  },
  "handoff.prepare": {
    name:"handoff.prepare",effect:"HOST_SCOPED_DRAFT",
    description:"Stage exactly one native operator-reviewed manual draft in an existing owned workspace, never send to ChatGPT",
    requiresNativeEffectBroker:true,
    inputSchema:{type:"object",properties:{
      goal:{type:"string",maxLength:2000},
      acceptance:{type:"array",minItems:1,maxItems:8,
        items:{type:"string",maxLength:400}},
      repository:{type:"string",maxLength:201},
      branch:{type:"string",maxLength:128},
      baseSha:{type:"string"},
      nextStep:{type:"string",maxLength:600}
    },required:["goal","acceptance"],additionalProperties:false}
  },
  "handoff.continue": {
    name:"handoff.continue",effect:"HOST_SCOPED_DRAFT",
    description:"Replace only the exact pending native manual draft using an operator-pasted, unverified reply; never send or attest ChatGPT output",
    requiresNativeEffectBroker:true,requiresNativeWorkspaceLease:true,
    inputSchema:{type:"object",properties:{
      previousFingerprint:{type:"string",pattern:"^[a-f0-9]{64}$"},
      reply:{type:"string",minLength:1,maxLength:3000},
      nextStep:{type:"string",maxLength:800}
    },required:["previousFingerprint","reply"],additionalProperties:false}
  }
});
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_CODE = 4096;
const MAX_CALLS = 8;
const MAX_NODES = 1500;
const MAX_LOOPS = 32;
const MAX_DEPTH = 32;
const MAX_OUTPUT = 6000;
const DEADLINE_MS = 2000;
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
    authorization: "READ_ONLY_PLUS_SINGLE_NATIVE_MANUAL_DRAFT",
    nativeHostAuthentication: "REQUIRED_BY_INSTALLED_DESKTOP_FACADE",
    catalogScope: "NODE_GATEWAY",
    nativeCatalogAvailability: "INSTALLED_RUST_MCP_ONLY",
    maxCodeChars: MAX_CODE,
    maxToolCalls: MAX_CALLS,
    maxOutputChars: MAX_OUTPUT,
    capabilities: PERMITTED.map(name => {
      const c = getCapability(name);
      return {name, effect:c.effect, description:c.description, inputSchema:c.inputSchema};
    }),
    builtins: Object.values(METADATA),
    example: "const s = await tools.supervisor.status(); return {gateway:s.gateway};",
    limits: "No ambient JS globals, imports, filesystem, network, worker or browser access; native manual draft is one terminal host-reviewed operation only"
  };
}

export async function executeCodeMode(source, {invoke,search,describe,
 nativeGoal=null,nativeBrowser=null,nativeAgent=null,nativeReceipt=null,
 nativeRepository=null,nativeCatalog=null,checkpoint=null,
 nativeEffect=null,handoffWorkspaceId=null,nativeHandoffStatus=null,
 nativeEffectPolicy=null,apiGoalStatus=null} = {}) {
  if (typeof source !== "string" || !source.trim() || source.length > MAX_CODE ||
      typeof invoke !== "function")
    return {status:"ERROR", code:"CODE_MODE_INVALID_INPUT"};
  let attachedApiGoal = null;
  let attachedGoal = null;
  let attachedBrowser = null;
  let attachedAgent = null;
  let attachedEffectPolicy = null;
  let attachedReceipt = null;
  let attachedRepository = null;
  let attachedNativeCatalog = null;
  let attachedHandoffStatus = null;
  let effectAttempted = false;
  try {
    if (nativeGoal !== null) attachedGoal = validateNativeCodeModeGoal(nativeGoal);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_GOAL_BINDING_INVALID"};
  }
  try {
    if(apiGoalStatus!==null)
      attachedApiGoal=validateCodeModeApiGoalStatus(apiGoalStatus);
  }catch{
    return {status:"ERROR",code:"CODE_MODE_API_GOAL_BINDING_INVALID"};
  }
  try {
    if (nativeBrowser !== null) attachedBrowser = validateNativeCodeModeBrowser(nativeBrowser);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_WORKSPACE_BINDING_INVALID"};
  }
  try {
    if (nativeAgent !== null) attachedAgent = validateNativeCodeModeAgent(nativeAgent);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_AGENT_BINDING_INVALID"};
  }
  try {
    if(nativeEffectPolicy!==null){
      attachedEffectPolicy=validateNativeCodeModeEffectPolicy(nativeEffectPolicy);
      if(attachedAgent===null ||
         attachedEffectPolicy.runId!==attachedAgent.runId ||
         attachedEffectPolicy.state!==attachedAgent.state ||
         attachedEffectPolicy.executionReview!==attachedAgent.executionReview ||
         attachedEffectPolicy.scopeAndBinaryCurrent!==attachedAgent.scopeAndBinaryCurrent)
        throw Error("CODE_MODE_AGENT_EFFECT_POLICY_INVALID");
    }
  }catch{
    return {status:"ERROR",code:"CODE_MODE_AGENT_EFFECT_POLICY_INVALID"};
  }
  try {
    if (nativeReceipt !== null) {
      attachedReceipt = validateNativeCodeModeReceipt(nativeReceipt);
      if (attachedGoal === null || attachedGoal.runId !== attachedReceipt.runId)
        throw Error("CODE_MODE_RECEIPT_BINDING_INVALID");
    }
  } catch {
    return {status:"ERROR",code:"CODE_MODE_RECEIPT_BINDING_INVALID"};
  }
  try {
    if (nativeRepository !== null) {
      attachedRepository = validateNativeCodeModeRepository(nativeRepository);
      if (attachedAgent===null || attachedAgent.runId!==attachedRepository.runId)
        throw Error("CODE_MODE_REPOSITORY_BINDING_INVALID");
    }
  } catch {
    return {status:"ERROR",code:"CODE_MODE_REPOSITORY_BINDING_INVALID"};
  }
  try {
    if (nativeCatalog !== null)
      attachedNativeCatalog = validateNativeCodeModeCatalog(nativeCatalog);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_NATIVE_CATALOG_INVALID"};
  }
  try {
    if(nativeHandoffStatus!==null) {
      attachedHandoffStatus=validateNativeCodeModeHandoff(nativeHandoffStatus);
      if(attachedHandoffStatus.workspaceId!==handoffWorkspaceId)
        throw Error("CODE_MODE_HANDOFF_BINDING_INVALID");
    }
  }catch{
    return {status:"ERROR",code:"CODE_MODE_HANDOFF_BINDING_INVALID"};
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
  // A native mutation is permitted only as the single terminal return.
  // This prevents an already-persisted draft being followed by another
  // action, a loop, or a misleading post-effect computation.
  const effectCalls=[];
  function scanForEffects(node){
    if(!node||typeof node!=="object")return;
    if(node.type==="CallExpression" &&
       ["handoff.prepare","handoff.continue"].includes(toolPath(node.callee)))
      effectCalls.push(node);
    for(const value of Object.values(node)){
      if(Array.isArray(value))for(const item of value)scanForEffects(item);
      else if(value&&typeof value==="object")scanForEffects(value);
    }
  }
  try {
    for(const statement of syntax.body)scanForEffects(statement);
  } catch {
    return {status:"ERROR",code:"CODE_MODE_PROPERTY_DENIED"};
  }
  if(effectCalls.length){
    const last=syntax.body.at(-1);
    const awaitExpr=last?.type==="ReturnStatement"?last.argument:null;
    const call=awaitExpr?.type==="AwaitExpression"?awaitExpr.argument:null;
    if(effectCalls.length!==1 || call!==effectCalls[0] ||
       !["handoff.prepare","handoff.continue"].includes(toolPath(call?.callee)))
      return {status:"ERROR",code:"CODE_MODE_EFFECT_TERMINAL_REQUIRED"};
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
          } else if (path === "goal.report") {
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedGoal === null) fail("CODE_MODE_CAPABILITY_DENIED");
            const {runId,state,mode,baseSha,checkpointRevision,taskCount,tasks,qa,
                   nextPromptAllowed} = attachedGoal;
            response = {status:"OK",structuredContent:{
              source:"NATIVE_CODEX_V1_TASK_REPORT",runId,state,mode,baseSha,
              checkpointRevision,taskCount,tasks,qa,nextPromptAllowed
            }};
          } else if (path === "goal.receipt") {
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedReceipt === null) fail("CODE_MODE_CAPABILITY_DENIED");
            response = {status:"OK",structuredContent:attachedReceipt};
          } else if (path === "api_goal.status") {
            // This owned projection cannot dispatch a paid effect.
            if(node.arguments.length!==0)fail("CODE_MODE_ARGUMENTS_INVALID");
            if(attachedApiGoal===null)fail("CODE_MODE_CAPABILITY_DENIED");
            response={status:"OK",structuredContent:attachedApiGoal};
          } else if (path === "agent.status") {
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedAgent === null) fail("CODE_MODE_CAPABILITY_DENIED");
            response = {status:"OK",structuredContent:attachedAgent};
          } else if (path === "agent.effect_policy") {
            if (node.arguments.length!==0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if(attachedEffectPolicy===null) fail("CODE_MODE_CAPABILITY_DENIED");
            response={status:"OK",structuredContent:attachedEffectPolicy};
          } else if (path === "checkpoint.summary") {
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (typeof checkpoint !== "function") fail("CODE_MODE_CAPABILITY_DENIED");
            response = await checkpoint();
          } else if (path === "repo.status") {
            if (node.arguments.length !== 0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedRepository===null) fail("CODE_MODE_CAPABILITY_DENIED");
            response = {status:"OK",structuredContent:attachedRepository};
          } else if (path === "handoff.reconcile") {
            if(node.arguments.length!==0) fail("CODE_MODE_ARGUMENTS_INVALID");
            if(attachedHandoffStatus===null) fail("CODE_MODE_CAPABILITY_DENIED");
            response={status:"OK",structuredContent:attachedHandoffStatus};
          } else if (path === "handoff.prepare") {
            if (effectAttempted) fail("CODE_MODE_EFFECT_LIMIT");
            // Unavailable bindings and invalid model data fail *before*
            // entering the uncertain-effect recovery state.
            if(!/^workspace-(0[1-9]|10)$/.test(handoffWorkspaceId??"") ||
               typeof nativeEffect!=="function")
              fail("CODE_MODE_EFFECT_UNAVAILABLE");
            validateManualHandoffArguments(params);
            effectAttempted = true;
            // Only authenticated host IPC can supply the callback. The
            // Rust host rechecks its existing client-owned workspace lease.
            const receipt = await prepareManualHandoff(params,{
              workspaceId:handoffWorkspaceId,invoke:nativeEffect
            });
            response = {status:"OK",structuredContent:receipt};
          } else if (path === "handoff.continue") {
            if(effectAttempted)fail("CODE_MODE_EFFECT_LIMIT");
            if(!/^workspace-(0[1-9]|10)$/.test(handoffWorkspaceId??"")||
               typeof nativeEffect!=="function")
              fail("CODE_MODE_EFFECT_UNAVAILABLE");
            const validated=validateManualContinuationArguments(params);
            // A Code Mode client cannot invent a prior draft identity or
            // claim the native inbox is empty. Re-read after the callback.
            if(attachedHandoffStatus===null||
               attachedHandoffStatus.state!=="PENDING_REVIEW"||
               attachedHandoffStatus.draftFingerprint!==validated.previousFingerprint)
              fail("CODE_MODE_HANDOFF_STALE");
            effectAttempted=true;
            const receipt=await continueManualHandoff(validated,{
              workspaceId:handoffWorkspaceId,invoke:nativeEffect
            });
            response={status:"OK",structuredContent:receipt};
          } else if (path === "capabilities.native") {
            const keys=Object.keys(params);
            if (keys.some(key=>!["query","limit"].includes(key)) ||
                typeof params.query!=="string" || params.query.length>256 ||
                (params.limit!==undefined && (!Number.isSafeInteger(params.limit) ||
                  params.limit<1 || params.limit>8)))
              fail("CODE_MODE_ARGUMENTS_INVALID");
            if (attachedNativeCatalog===null) fail("CODE_MODE_CAPABILITY_DENIED");
            const terms=params.query.toLowerCase().split(/\s+/).filter(Boolean);
            const matches=attachedNativeCatalog.capabilities.filter(item=>
              terms.every(term=>(item.name+" "+item.description).toLowerCase().includes(term)));
            response={status:"OK",structuredContent:{
              source:"NATIVE_MCP_CATALOG",results:matches.slice(0,params.limit??4)
            }};
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
    const content = {value,toolCalls:calls,steps:nodes,
      mode:effectAttempted?"HOST_MANUAL_DRAFT":"READ_ONLY",
      ...(effectAttempted?{effectCalls:1,nextPromptAllowed:false}:{})};
    copy(content, MAX_OUTPUT);
    return {status:"OK",structuredContent:content};
  } catch (e) {
    const code = String(e?.message ?? "");
    return {status:"ERROR",code:effectAttempted
      ?"CODE_MODE_EFFECT_RECONCILE_REQUIRED":
      (/^CODE_MODE_[A-Z_]+$/.test(code) ? code : "CODE_MODE_DENIED")};
  }
}
