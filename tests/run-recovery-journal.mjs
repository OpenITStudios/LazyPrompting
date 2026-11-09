import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {RecoveryJournal} from "../src/governance/recovery-journal.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-journal-"));
try{
 const journal=new RecoveryJournal(join(root,"journal.jsonl"));
 const base={workspaceId:"ws1",taskId:"task1",sourceSha:"a".repeat(40)};
 assert.equal((await journal.append({...base,type:"INTENT_RECORDED"})).sequence,1);
 assert.equal((await journal.append({...base,type:"DISPATCH_ATTEMPTED"})).sequence,2);
 assert.equal((await journal.pending()).length,1);
 assert.equal((await journal.append({...base,type:"RESULT_VERIFIED"})).sequence,3);
 assert.equal((await journal.pending()).length,0);
}finally{await rm(root,{recursive:true,force:true});}
console.log("Recovery journal source tests authored; NOT_EXECUTED");
