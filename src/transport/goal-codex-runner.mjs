import {execFile} from "node:child_process";
import {randomUUID} from "node:crypto";
import {access, mkdir, open, readFile, rm} from "node:fs/promises";
import {isAbsolute, join} from "node:path";
import {promisify} from "node:util";
import {setTimeout as sleep} from "node:timers/promises";
import {PromptOutbox} from "../prompt/prompt-outbox.mjs";
import {publishStateFile} from "../runtime/publish-state-file.mjs";
import {CodexAppServer} from "./codex-app-server.mjs";
import {CodexTerminalEvents} from "./codex-terminal-events.mjs";
import {openGoalWorktrees} from "./goal-worktrees.mjs";

const exec = promisify(execFile);
const exists = async path => access(path).then(()=>true,error=>{
  if (error.code === "ENOENT") return false;
  throw error;
});

async function save(path, value) {
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    const fd = await open(temporary, "wx", 0o600);
    try {
      await fd.writeFile(JSON.stringify(value));
      await fd.sync();
    } finally {
      await fd.close();
    }
    await publishStateFile(temporary, path);
  } finally {
    await rm(temporary, {force:true});
  }
}

async function launchOptions(executable, cwd) {
  const options = {cwd, timeout:5000, maxBuffer:1024*1024, windowsHide:true};
  const {stdout:version} = await exec(executable, ["--version"], options);
  if (version.trim() !== "codex-cli 0.167.0-alpha.3.2") throw Error("CODEX_VERSION_UNSUPPORTED");
  const {stdout} = await exec(executable, ["--disable","plugins","--disable","apps","mcp","list","--json"], options);
  const servers = JSON.parse(stdout);
  if (!Array.isArray(servers) || servers.some(server=>!/^[a-zA-Z0-9_-]{1,128}$/.test(server.name ?? "")))
    throw Error("GOAL_WORKER_MCP_CONFIG_UNVERIFIED");
  const disabled = servers.flatMap(server=>["-c",`mcp_servers.${server.name}.enabled=false`]);
  const flags = ["--disable","plugins","--disable","apps","--disable","hooks","--disable","goals","-c",'web_search="disabled"',...disabled];
  const {stdout:effective} = await exec(executable, [...flags,"mcp","list","--json"], options);
  if (JSON.parse(effective).some(server=>server.enabled !== false))
    throw Error("GOAL_WORKER_MCP_CONFIG_UNVERIFIED");
  return flags;
}

async function response(server, threadId, turnId, requireExisting) {
  let cursor, turn;
  for (let page=0;page<3&&!turn;page++) {
    const result=await server.listRecentTurns(threadId,20,cursor);
    turn=result.data?.find(item=>item.id===turnId);
    cursor=result.nextCursor;
    if (!cursor) break;
  }
  if (!turn && requireExisting) throw Error("GOAL_TURN_UNCONFIRMED");
  if (!turn || turn.status==="inProgress") return null;
  if (turn.status!=="completed") throw Error("GOAL_TURN_INCOMPLETE");
  const items = await server.listRecentTurnItems(threadId,turnId);
  const message = items.data?.find(entry=>entry.turnId===turnId &&
    entry.item?.type==="agentMessage" && entry.item.phase!=="commentary")?.item;
  if (typeof message?.text!=="string") throw Error("GOAL_RESPONSE_UNAVAILABLE");
  return message.text.slice(0,1200);
}

export async function runReadOnlyGoal({
  executable, cwd, dataDir, objective, acceptance, baseSha, limits, stopFile,
  resume = false, hostEpoch = null, coding = null
}, {newServer = config=>new CodexAppServer(config), resolveOptions = launchOptions, onReady = ()=>{}} = {}) {
  if (![executable,cwd,dataDir,stopFile].every(isAbsolute) ||
      typeof objective!=="string" || !Array.isArray(acceptance) || acceptance.length<1 || acceptance.length>8 ||
      !/^[a-f0-9]{40,64}$/.test(baseSha) || !Number.isInteger(limits?.maxActiveTasks) ||
      limits.maxActiveTasks<1 || limits.maxActiveTasks>5 ||
      !Number.isInteger(limits.maxTurnsPerTask) || limits.maxTurnsPerTask<1 || limits.maxTurnsPerTask>6 ||
      !Number.isInteger(limits.wallMinutes) || limits.wallMinutes<1 || limits.wallMinutes>30)
    throw Error("INVALID_GOAL_RUN_CONFIG");

  if (coding && (!Array.isArray(coding.tasks) || coding.tasks.length!==acceptance.length ||
      coding.tasks.some(task=>!Array.isArray(task.files)||!task.files.length||!Array.isArray(task.verify)||!isAbsolute(task.verify[0]))))
    throw Error("INVALID_GOAL_CODING_TASKS");
  const mode=coding?"WORKTREE_WRITE":"READ_ONLY";
  await mkdir(dataDir,{recursive:true});
  const statePath=join(dataDir,"report.json");
  const previous=await exists(statePath);
  if (previous!==resume) throw Error("GOAL_RECONCILE_REQUIRED");
  const report=previous?JSON.parse(await readFile(statePath,"utf8")):{
    state:"RUNNING",mode,baseSha,deadline:Date.now()+limits.wallMinutes*60_000,revision:0,
    tasks:acceptance.map((criterion,index)=>({id:`task-${index+1}`,criterion,state:"QUEUED",turns:[]}))
  };
  if (report.baseSha!==baseSha || report.mode!==mode ||
      !Number.isSafeInteger(report.deadline) || !Number.isSafeInteger(report.revision) ||
      !Array.isArray(report.tasks) || report.tasks.length!==acceptance.length ||
      report.tasks.some((task,index)=>task.id!==`task-${index+1}` || task.criterion!==acceptance[index] ||
        !Array.isArray(task.turns) || task.turns.length>Math.min(2,limits.maxTurnsPerTask)))
    throw Error("GOAL_CHECKPOINT_INVALID");
  if (resume && ["STOPPED","REVIEW_COMPLETE","CODING_COMPLETE"].includes(report.state)) throw Error("GOAL_ALREADY_TERMINAL");
  const {tasks,deadline}=report;
  report.state="RUNNING";
  report.hostEpoch=hostEpoch;
  delete report.reason;
  let writes=Promise.resolve();
  const checkpoint=()=>{
    report.revision++;
    const value=structuredClone(report);
    const next=writes.then(()=>save(statePath,value));
    writes=next;
    return next;
  };
  const control=async()=> {
    if (await exists(stopFile)) throw Error("GOAL_STOPPED");
    if (Date.now()>=deadline) throw Error("GOAL_TIME_LIMIT");
  };
  // Notifications are observed only from our owned Codex App Server child.
  // The record is process-local and never claims native host attestation.
  const terminalEvents = new CodexTerminalEvents();
  let server;
  try {
    await checkpoint();
    onReady();
    const flags=await resolveOptions(executable,cwd);
    await control();
    server=newServer({executable,cwd,launchOptions:flags,
      onEvent(event){terminalEvents.observe(event);}});
    await server.initialize();
    const worktrees=coding?await openGoalWorktrees({cwd,dataDir,baseSha,coding,tasks},server):null;
    let next=0;
    await Promise.all(Array.from({length:Math.min(limits.maxActiveTasks,tasks.length)},async()=>{
      while (next<tasks.length) {
        const i=next++;
        const task=tasks[i];
        const worktree=worktrees?.[i];
        if (["REVIEWED","VERIFIED","STOPPED"].includes(task.state)) continue;
        const outbox=new PromptOutbox(join(dataDir,task.id+".json"));
        let turnId;
        try {
          await control();
          if (worktree) {
            await worktree.probe();
            task.worktree=worktree.path;
          }
          const {items}=await outbox.read();
          if (!task.threadId && items.length) throw Error("GOAL_RECONCILE_REQUIRED");
          if (!task.threadId) task.threadId=(await server.startThread(worktree?.path ?? cwd)).thread.id;
          const threadId=task.threadId;
          if (items.some(item=>item.workspaceId!==task.id || item.sessionId!==threadId) ||
              new Set(items.map(item=>item.taskId)).size!==items.length ||
              task.turns.some((turn,index)=>!items.some(item=>item.taskId===`${task.id}-turn-${index+1}` &&
                item.state==="RESPONSE_VERIFIED" && item.responseId===turn.turnId && item.responseHandle===turn.turnId)))
            throw Error("GOAL_RECONCILE_REQUIRED");
          task.state="RUNNING";
          delete task.reason;
          await checkpoint();
          if (worktree && task.turns.length && !task.verification) {
            task.verification=await worktree.verify();
            task.turns.at(-1).verification=task.verification;
            await checkpoint();
          }
          for(let index=task.turns.length;index<Math.min(2,limits.maxTurnsPerTask);index++){
            await control();
            if (worktree && task.verification?.pass) break;
            const taskId=`${task.id}-turn-${index+1}`;
            let entry=items.find(item=>item.taskId===taskId);
            const recovering=Boolean(entry);
            if (entry) {
              if (entry.workspaceId!==task.id || entry.sessionId!==threadId ||
                  !["ACKNOWLEDGED","RESPONSE_VERIFIED"].includes(entry.state) ||
                  !entry.responseHandle ||
                  (entry.state==="RESPONSE_VERIFIED" && entry.responseId!==entry.responseHandle))
                throw Error("GOAL_RECONCILE_REQUIRED");
              turnId=entry.responseHandle;
            } else {
              if (task.pendingTurnId || items.some(item=>item.state!=="RESPONSE_VERIFIED"))
                throw Error("GOAL_RECONCILE_REQUIRED");
              const prompt=worktree?
                `Goal: ${objective}\nYour task: ${task.criterion}\nChange only these paths in your assigned worktree: ${worktree.scope.files.join(", ")}. Do not commit or publish. ${index?"The host check did not pass (exit code "+task.verification?.exitCode+"). Inspect the prior attempt and fix the cause.":"Implement the smallest change requested for this turn."} Finish the turn after making the change. The host runs the approved verification separately.`:
                index===0?
                `Read-only repository investigation. Goal: ${objective}\nApproved base commit: ${baseSha}\nYour only acceptance criterion: ${task.criterion}\nInspect the relevant source. Report concrete file and line evidence and one unresolved verification question. Do not modify files or publish anything.`:
                `Continue the same read-only goal and criterion. Verify the strongest claim in your last answer against the actual source at ${baseSha}. Resolve the outstanding question if the repository provides evidence. Return a concise result with exact files and any remaining blocker. Do not claim that coding or tests passed.`;
              await server.ensureThread(threadId);
              const reserved=await outbox.reserve({workspaceId:task.id,sessionId:threadId,
                taskId,contextRevision:index,prompt,promptLimit:2,singleDispatchPerTask:true});
              if (!reserved.reserved) throw Error("GOAL_RECONCILE_REQUIRED");
              await control();
              const {turn}=await server.startTurn(threadId,prompt,worktree?.turnPolicy);
              turnId=turn.id;
              await outbox.ack({workspaceId:task.id,promptId:reserved.promptId,hostReceipt:{responseHandle:turnId}});
              entry={promptId:reserved.promptId,state:"ACKNOWLEDGED"};
            }
            task.pendingTurnId=turnId;
            await checkpoint();
            let text;
            while(!(text=await response(server,threadId,turnId,recovering))){
              await control();
              await sleep(350);
            }
            const correlated=terminalEvents.correlate({threadId,turnId,queriedStatus:"completed"});
            if (correlated.status==="CONFLICT"||correlated.status==="NON_SUCCESS")
              throw Error("GOAL_TURN_TERMINAL_EVENT_CONFLICT");
            // Query-only recovery is valid for completion state but does not
            // pretend we observed the original process's terminal event.
            const terminalObservation=correlated.status==="CORRELATED"?{
              kind:"EVENT_AND_QUERY_CORRELATED",threadId,turnId,
              source:"CODEX_APP_SERVER_NOTIFICATION",hostAttested:false
            }:{kind:"TURN_STATUS_QUERY_ONLY",threadId,turnId,hostAttested:false};
            if (entry.state==="ACKNOWLEDGED")
              await outbox.reconcile({workspaceId:task.id,promptId:entry.promptId,responseId:turnId,verified:true});
            entry.state="RESPONSE_VERIFIED";
            task.turns.push({turnId,text,terminalObservation});
            delete task.pendingTurnId;
            if (worktree) delete task.verification;
            turnId=undefined;
            await checkpoint();
            if (worktree) {
              await control();
              task.verification=await worktree.verify();
              task.turns.at(-1).verification=task.verification;
              await checkpoint();
            }
          }
          task.state=worktree?(task.verification?.pass?"VERIFIED":"BLOCKED"):"REVIEWED";
          if (worktree && !task.verification?.pass) task.reason="GOAL_VERIFICATION_FAILED";
        } catch(error) {
          const code=String(error.message);
          const pending=await outbox.pending(task.id);
          const stopped=code==="GOAL_STOPPED"||code==="GOAL_TIME_LIMIT";
          task.state=stopped?"STOPPED":pending.length||code==="GOAL_RECONCILE_REQUIRED"?"RECONCILE_REQUIRED":"BLOCKED";
          task.reason=/^[A-Z_]{1,80}$/.test(code)?code:"GOAL_WORKER_FAILED";
          if (stopped && turnId) {
            try {await server.interruptTurn(task.threadId,turnId);} catch {task.reason="GOAL_INTERRUPT_UNCONFIRMED";}
          }
        }
        await checkpoint();
      }
    }));
    report.state=await exists(stopFile)?"STOPPED":
      tasks.every(task=>task.state===(coding?"VERIFIED":"REVIEWED"))?
        (coding?"CODING_COMPLETE":"REVIEW_COMPLETE"):"NEEDS_ATTENTION";
  } catch(error) {
    report.state="NEEDS_ATTENTION";
    const code=String(error.message);
    report.reason=/^[A-Z_]{1,80}$/.test(code)?code:"GOAL_WORKER_FAILED";
  } finally {
    await server?.close();
    await checkpoint();
  }
  return report;
}
