import assert from "node:assert/strict";
import {evaluateBrowserBenchmarks} from "../apps/desktop/src/browser-benchmark-plan.mjs";
assert.equal(evaluateBrowserBenchmarks([]).complete,false);
const samples=[1,4,10].map(workspaces=>({workspaces,source:"NATIVE_OBSERVATION",verified:true,ramMb:100,cpuPercent:2,switchMs:30,platform:"windows",runtimeVersion:"1.0"}));
assert.equal(evaluateBrowserBenchmarks(samples).complete,true);
assert.equal(evaluateBrowserBenchmarks(samples.map(x=>({...x,verified:false}))).complete,false);
console.log("Benchmark contract cases authored; NOT_EXECUTED");
