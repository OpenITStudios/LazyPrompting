import {readFileSync} from "node:fs";
import {transitionCheckpoint} from "../src/supervisor/checkpoint-transition.mjs";
const cases=JSON.parse(readFileSync(new URL("./fixtures/checkpoint-cases.json",import.meta.url),"utf8"));
let failed=0;
for(const test of cases){
 const before=JSON.stringify(test.current);
 const result=transitionCheckpoint(test.current,test.event);
 const pass=Object.entries(test.expected).every(([key,value])=>result[key]===value)&&
   before===JSON.stringify(test.current)&&(!result.ok||result.checkpoint.version===test.current.version+1);
 if(!pass){failed++;console.error("FAIL",test.name,result);}
 else console.log("PASS",test.name);
}
if(failed)process.exitCode=1;else console.log("All",cases.length,"checkpoint cases passed.");
