import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';

// Immutable replay identity for one native-authorized goal-run invocation.
// This digest detects conflicting checkpoint inputs; it does not authenticate
// a caller, grant tools, or replace the original native operator approval.
const EXACT_LIMITS = ['maxActiveTasks', 'maxTurnsPerTask', 'wallMinutes'];
const EXACT_CODING = ['git', 'root', 'tasks'];
const EXACT_TASK = ['files', 'verify'];
const exact = (value, allowed) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === allowed.length &&
  allowed.every(key => Object.hasOwn(value, key));

export function fingerprintGoalRunScope({executable, cwd, dataDir, stopFile,
  objective, acceptance, baseSha, limits, coding = null} = {}) {
  if (![executable, cwd, dataDir, stopFile].every(x => typeof x === 'string' && isAbsolute(x)) ||
      typeof objective !== 'string' || !objective.trim() || objective.length > 2000 ||
      !Array.isArray(acceptance) || acceptance.length < 1 || acceptance.length > 8 ||
      acceptance.some(a => typeof a !== 'string' || !a.trim() || a.length > 400) ||
      typeof baseSha !== 'string' || !/^[a-f0-9]{40,64}$/.test(baseSha) ||
      !exact(limits, EXACT_LIMITS) ||
      !Number.isSafeInteger(limits.maxActiveTasks) || limits.maxActiveTasks < 1 || limits.maxActiveTasks > 5 ||
      !Number.isSafeInteger(limits.maxTurnsPerTask) || limits.maxTurnsPerTask < 1 || limits.maxTurnsPerTask > 6 ||
      !Number.isSafeInteger(limits.wallMinutes) || limits.wallMinutes < 1 || limits.wallMinutes > 30)
    throw new Error('INVALID_GOAL_RUN_SCOPE');
  let codingBinding = null;
  if (coding !== null) {
    if (!exact(coding, EXACT_CODING) || !isAbsolute(coding.git ?? '') ||
        !isAbsolute(coding.root ?? '') || !Array.isArray(coding.tasks) ||
        coding.tasks.length !== acceptance.length ||
        coding.tasks.some(t => !exact(t, EXACT_TASK) ||
          !Array.isArray(t.files) || t.files.length === 0 ||
          !Array.isArray(t.verify) || t.verify.length === 0 ||
          t.files.some(f => typeof f !== 'string' || !f.trim()) ||
          t.verify.some(v => typeof v !== 'string' || !v.trim())))
      throw new Error('INVALID_GOAL_RUN_SCOPE');
    codingBinding = {git:coding.git, root:coding.root, tasks:coding.tasks.map(t =>
      ({files:[...t.files], verify:[...t.verify]}))};
  }
  const scope = {version:1, executable, cwd, dataDir, stopFile, objective,
    acceptance:[...acceptance], baseSha,
    limits:{maxActiveTasks:limits.maxActiveTasks,
      maxTurnsPerTask:limits.maxTurnsPerTask, wallMinutes:limits.wallMinutes},
    coding:codingBinding};
  return createHash('sha256').update(JSON.stringify(scope), 'utf8').digest('hex');
}
