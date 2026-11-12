import {isAbsolute, normalize} from "node:path";

// Process-local admission only; the durable approved goal checkpoint remains
// the sole state owner. A restart must reconcile its exact approved scope.
export class ActiveGoalRegistry {
  #active = new Map();
  #limit;
  constructor({maxActive = 2} = {}) {
    if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 5)
      throw new Error("INVALID_GOAL_CAPACITY");
    this.#limit = maxActive;
  }
  get size() { return this.#active.size; }
  get capacity() { return this.#limit; }
  acquire({dataDir, cwd, stopFile, coding = null} = {}) {
    if (![dataDir, cwd, stopFile].every(value =>
      typeof value === "string" && isAbsolute(value) && value.length <= 4096))
      throw new Error("INVALID_GOAL_RUN_CONFIG");
    if (coding !== null && (typeof coding !== "object" || Array.isArray(coding)))
      throw new Error("INVALID_GOAL_RUN_CONFIG");
    const entry = {dataDir: normalize(dataDir), cwd: normalize(cwd),
      stopFile: normalize(stopFile), writes: coding !== null};
    // Case-insensitive Windows filesystem paths must not alias two leases.
    if (process.platform === "win32") {
      for (const key of ["dataDir", "cwd", "stopFile"])
        entry[key] = entry[key].toLowerCase();
    }
    for (const running of this.#active.values()) {
      if (running.dataDir === entry.dataDir || running.stopFile === entry.stopFile)
        throw new Error("GOAL_ALREADY_ACTIVE");
      if (running.cwd === entry.cwd && (running.writes || entry.writes))
        throw new Error("GOAL_REPOSITORY_BUSY");
    }
    if (this.#active.size >= this.#limit) throw new Error("GOAL_HOST_BUSY");
    const lease = Symbol("goal-admission");
    this.#active.set(lease, entry);
    let released = false;
    return () => {
      if (released) return false;
      released = true;
      return this.#active.delete(lease);
    };
  }
}
