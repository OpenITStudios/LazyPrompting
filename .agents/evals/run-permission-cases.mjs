import { readFileSync } from "node:fs";
import { evaluatePermission } from "../permissions/evaluate-permission.mjs";
const cases = JSON.parse(readFileSync(new URL("./permission-cases.json", import.meta.url), "utf8"));
let failures = 0;
for (const item of cases) {
  const actual = evaluatePermission(item.request);
  if (actual.decision !== item.expected) {
    failures++;
    console.error("FAIL", item.name, item.expected, actual);
  } else console.log("PASS", item.name);
}
if (failures) process.exitCode = 1;
else console.log("All", cases.length, "permission cases passed.");
