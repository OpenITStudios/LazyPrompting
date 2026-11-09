import { readFileSync } from "node:fs";
import { evaluateContinuation } from "../src/supervisor/decision-engine.mjs";
const cases = JSON.parse(readFileSync(new URL("./fixtures/continuation-cases.json", import.meta.url), "utf8"));
let failed = 0;
for (const item of cases) {
  const result = evaluateContinuation(item.input);
  const matches = Object.entries(item.expected).every(([key, value]) => result[key] === value);
  const safe = result.modelCalls === 0 && (!result.prompt || !/^ya lanjutkan$/i.test(result.prompt.trim()));
  if (!matches || !safe) {
    failed++;
    console.error("FAIL", item.name, item.expected, result);
  } else console.log("PASS", item.name);
}
if (failed) process.exitCode = 1;
else console.log("All", cases.length, "supervisor cases passed.");
