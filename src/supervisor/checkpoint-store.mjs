import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { transitionCheckpoint } from "./checkpoint-transition.mjs";
import { publishStateFile } from "../runtime/publish-state-file.mjs";
import {verifyGoalContract,matchesNativeGoalApproval} from "./goal-contract.mjs";

// Single-host durable checkpoint. A lock directory serializes writers; never auto-break stale locks.
export class CheckpointStore {
  constructor(filePath) {
    if (typeof filePath !== "string" || !filePath.trim()) throw new TypeError("Checkpoint path required");
    this.filePath = resolve(filePath);
    this.lockPath = this.filePath + ".lock";
  }
  async read() {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8"));
      if (!value || !Number.isSafeInteger(value.version) || value.version < 0 ||
          typeof value.goalId !== "string" || typeof value.goalHash !== "string" ||
          typeof value.phase !== "string") throw new Error("INVALID_CHECKPOINT");
      // Source-only approved-goal checkpoints remain bound to their original
      // native authority. The digest is an integrity check, not permission.
      if (value.goalContract !== undefined &&
          (!verifyGoalContract(value.goalContract) ||
           value.goalId !== value.goalContract.goalId ||
           value.goalHash !== value.goalContract.goalHash ||
           value.workspaceId !== value.goalContract.workspaceId ||
           value.repository !== value.goalContract.repository ||
           value.branch !== value.goalContract.branch ||
           !["UNBOUND","BOUND_VERIFIED"].includes(value.chatState) ||
           !Array.isArray(value.goalRevisionHistory) ||
           value.goalRevisionHistory.length>32 ||
           value.goalRevisionHistory.some((entry,i,all)=>
             !entry||!Number.isSafeInteger(entry.revision)||
             entry.revision<1||entry.revision>=value.goalContract.revision||
             !/^[a-f0-9]{64}$/.test(entry.goalHash??"")||
             (i>0&&entry.revision<=all[i-1].revision))))
        throw new Error("INVALID_GOAL_CONTRACT_CHECKPOINT");
      return value;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  async withLock(callback) {
    await mkdir(dirname(this.filePath), { recursive: true });
    // mkdir is exclusive; lock contention fails closed, no retries or automatic lock stealing.
    await mkdir(this.lockPath);
    try { return await callback(); }
    finally { await rm(this.lockPath, { recursive: true, force: true }); }
  }
  async writeAtomically(value) {
    const temp = this.filePath + "." + randomUUID() + ".tmp";
    let handle;
    try {
      handle = await open(temp, "wx", 0o600);
      await handle.writeFile(JSON.stringify(value) + "\n", "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      if (process.platform === "win32") {
        await publishStateFile(temp, this.filePath);
        return;
      }
      await rename(temp, this.filePath);
      // Best-effort directory fsync; unsupported filesystems may reject this.
      try {
        const dir = await open(dirname(this.filePath), "r");
        try { await dir.sync(); } finally { await dir.close(); }
      } catch { /* Do not claim cross-platform crash durability from this best effort. */ }
    } finally {
      if (handle) await handle.close();
      await rm(temp, { force: true });
    }
  }
  async initialize(checkpoint) {
    return this.withLock(async () => {
      if (await this.read()) throw new Error("ALREADY_INITIALIZED");
      if (!checkpoint || checkpoint.version !== 0 || checkpoint.phase !== "READY" ||
          typeof checkpoint.goalId !== "string" || !checkpoint.goalId ||
          typeof checkpoint.goalHash !== "string" || !checkpoint.goalHash ||
          checkpoint.pendingTaskId) throw new Error("INVALID_INITIAL_CHECKPOINT");
      await this.writeAtomically(checkpoint);
      return checkpoint;
    });
  }
  // Goal intake uses the existing per-goal checkpoint owner. The caller MUST
  // inject an authenticated native operator-approval callback. No ChatGPT
  // conversation is bound and no worker or prompt is dispatched here.
  async initializeApprovedGoal({contract,outbox,authorize}={}) {
    if (!verifyGoalContract(contract) || contract.revision!==1 ||
        typeof outbox?.unresolvedWorkspaceEffects !== "function" ||
        typeof authorize !== "function")
      throw new Error("INVALID_APPROVED_GOAL_INTAKE");
    return this.withLock(async () => {
      if (await this.read()) throw new Error("ALREADY_INITIALIZED");
      const effects=await outbox.unresolvedWorkspaceEffects({workspaceId:contract.workspaceId});
      if (effects?.workspaceId!==contract.workspaceId || effects.unresolved!==false)
        return {ok:false,reason:"GOAL_OUTBOX_NOT_QUIESCENT"};
      const approval=await authorize({
        operation:"APPROVE_GOAL",goalId:contract.goalId,
        workspaceId:contract.workspaceId,goalHash:contract.goalHash,
        revision:contract.revision,repository:contract.repository,
        branch:contract.branch,baseSha:contract.baseSha
      });
      if (!matchesNativeGoalApproval(contract,approval,"APPROVE_GOAL"))
        return {ok:false,reason:"NATIVE_GOAL_APPROVAL_REQUIRED"};
      const checkpoint={
        version:0,goalId:contract.goalId,goalHash:contract.goalHash,
        goalContract:structuredClone(contract),goalRevisionHistory:[],
        workspaceId:contract.workspaceId,repository:contract.repository,
        branch:contract.branch,headSha:contract.baseSha,phase:"PAUSED",
        chatState:"UNBOUND",pendingTaskId:null,lastTaskId:null,lastResultId:null,
        iteration:0,elapsedMinutes:0,modelTokensUsed:0,noProgress:0,
        transportApproved:false
      };
      await this.writeAtomically(checkpoint);
      return {ok:true,checkpoint};
    });
  }
  // Revisions are restricted to a paused, unbound and unreserved goal.
  // A changed repo, branch or goal identity requires a separately approved
  // new goal. No in-flight prompt can be silently reassigned.
  async reviseApprovedGoal({contract,expectedVersion,outbox,authorize}={}) {
    if (!verifyGoalContract(contract) || !Number.isSafeInteger(expectedVersion) ||
        expectedVersion<0 ||
        typeof outbox?.unresolvedWorkspaceEffects!=="function" ||
        typeof authorize!=="function")
      throw new Error("INVALID_GOAL_REVISION");
    return this.withLock(async () => {
      const current=await this.read();
      if (!current?.goalContract) return {ok:false,reason:"APPROVED_GOAL_NOT_FOUND"};
      if (current.version!==expectedVersion)
        return {ok:false,reason:"STALE_GOAL_REVISION"};
      const prev=current.goalContract;
      if (current.phase!=="PAUSED" || current.chatState!=="UNBOUND" ||
          current.pendingTaskId || current.review || current.dispatchReceiptId)
        return {ok:false,reason:"GOAL_REVISION_REQUIRES_QUIESCENCE"};
      if (contract.goalId!==prev.goalId ||
          contract.workspaceId!==prev.workspaceId ||
          contract.repository!==prev.repository ||
          contract.branch!==prev.branch || contract.baseSha!==prev.baseSha ||
          current.headSha!==prev.baseSha ||
          contract.revision!==prev.revision+1)
        return {ok:false,reason:"GOAL_REVISION_SCOPE_MISMATCH"};
      const effects=await outbox.unresolvedWorkspaceEffects({workspaceId:contract.workspaceId});
      if (effects?.workspaceId!==contract.workspaceId || effects.unresolved!==false)
        return {ok:false,reason:"GOAL_OUTBOX_NOT_QUIESCENT"};
      const approval=await authorize({
        operation:"REVISE_GOAL",goalId:contract.goalId,
        workspaceId:contract.workspaceId,goalHash:contract.goalHash,
        revision:contract.revision,repository:contract.repository,
        branch:contract.branch,baseSha:contract.baseSha
      });
      if (!matchesNativeGoalApproval(contract,approval,"REVISE_GOAL"))
        return {ok:false,reason:"NATIVE_GOAL_APPROVAL_REQUIRED"};
      const history=[...(current.goalRevisionHistory??[]),
        {revision:prev.revision,goalHash:prev.goalHash}].slice(-32);
      const next={...current,version:current.version+1,
        goalHash:contract.goalHash,goalContract:structuredClone(contract),
        goalRevisionHistory:history};
      await this.writeAtomically(next);
      return {ok:true,checkpoint:next};
    });
  }
  async apply(event) {
    return this.withLock(async () => {
      const current = await this.read();
      if (!current) throw new Error("NOT_INITIALIZED");
      const outcome = transitionCheckpoint(current, event);
      if (!outcome.ok) return outcome;
      await this.writeAtomically(outcome.checkpoint);
      return outcome;
    });
  }
  async recovery() {
    const current = await this.read();
    if (!current) return {state:"UNINITIALIZED",checkpoint:null};
    if (["DISPATCH_PENDING","WAITING","RECONCILE_REQUIRED"].includes(current.phase))
      return {state:"RECONCILE_REQUIRED",checkpoint:current};
    return {state:current.phase,checkpoint:current};
  }
}
