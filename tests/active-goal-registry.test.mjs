import {test} from "node:test";
import assert from "node:assert/strict";
import {join, resolve} from "node:path";
import {ActiveGoalRegistry} from "../src/runtime/active-goal-registry.mjs";
const root = resolve("test-fixture");
const goal = (id, options = {}) => ({
  dataDir: join(root, `data-${id}`), cwd: join(root, "repository"),
  stopFile: join(root, `stop-${id}`), ...options
});
test("two read-only goals run with bounded admission", () => {
  const registry = new ActiveGoalRegistry();
  const releaseA = registry.acquire(goal("a"));
  const releaseB = registry.acquire(goal("b"));
  assert.equal(registry.size, 2);
  assert.throws(() => registry.acquire(goal("c")), /GOAL_HOST_BUSY/);
  assert.equal(releaseA(), true);
  const releaseC = registry.acquire(goal("c"));
  assert.equal(releaseA(), false);
  assert.equal(registry.size, 2);
  releaseB(); releaseC(); assert.equal(registry.size, 0);
});
test("durable scope files cannot be shared", () => {
  const registry = new ActiveGoalRegistry();
  const release = registry.acquire(goal("a"));
  assert.throws(() => registry.acquire(goal("b", {dataDir: goal("a").dataDir})), /GOAL_ALREADY_ACTIVE/);
  assert.throws(() => registry.acquire(goal("b", {stopFile: goal("a").stopFile})), /GOAL_ALREADY_ACTIVE/);
  release();
});
test("writers are exclusive even against readers", () => {
  const registry = new ActiveGoalRegistry();
  const reader = registry.acquire(goal("a"));
  assert.throws(() => registry.acquire(goal("b", {coding: {tasks: []}})), /GOAL_REPOSITORY_BUSY/);
  reader();
  const writer = registry.acquire(goal("b", {coding: {tasks: []}}));
  assert.throws(() => registry.acquire(goal("a")), /GOAL_REPOSITORY_BUSY/);
  const separate = registry.acquire(goal("c", {cwd: join(root, "other"), coding: {tasks: []}}));
  writer(); separate();
});
test("invalid scopes cannot consume capacity", () => {
  const registry = new ActiveGoalRegistry();
  assert.throws(() => registry.acquire(goal("a", {cwd:"relative"})), /INVALID_GOAL_RUN_CONFIG/);
  assert.throws(() => registry.acquire(goal("a", {coding:[]})), /INVALID_GOAL_RUN_CONFIG/);
  assert.throws(() => new ActiveGoalRegistry({maxActive:0}), /INVALID_GOAL_CAPACITY/);
  assert.equal(registry.size, 0);
});
