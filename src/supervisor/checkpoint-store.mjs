import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { transitionCheckpoint } from "./checkpoint-transition.mjs";

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
