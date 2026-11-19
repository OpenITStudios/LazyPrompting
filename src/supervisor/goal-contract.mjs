import {createHash} from "node:crypto";

// Pure, bounded representation of one operator-approved goal.
// A SHA-256 digest detects accidental/state mismatch; it is NOT an approval,
// credential, signature, or permission to dispatch work.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const WS=/^workspace-(0[1-9]|10)$/;
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const PAYLOAD_KEYS=["schemaVersion","goalId","workspaceId","repository",
 "branch","baseSha","revision","objective","acceptance","constraints",
 "nonGoals","preserve","allowedActions","limits"];
const LIMIT_KEYS=["maxIterations","maxMinutes","maxModelTokens"];
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const text=(s,max,multiline=false)=>typeof s==="string"&&s.length<=max&&
 s.trim().length>0&&
 !(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:
 /[\u0000-\u001f\u007f]/).test(s);
const list=(v,maxCount,maxLength,required=false)=>Array.isArray(v)&&
 v.length<=(maxCount)&&(!required||v.length>0)&&
 v.every(x=>text(x,maxLength)&&x===x.trim())&&new Set(v).size===v.length;
const validBranch=s=>typeof s==="string"&&BRANCH.test(s)&&
 !s.startsWith("/")&&!s.endsWith("/")&&!s.includes("//")&&!s.includes("..");
function validPayload(x){
 return exact(x,PAYLOAD_KEYS)&&x.schemaVersion===1&&
 ID.test(x.goalId??"")&&WS.test(x.workspaceId??"")&&
 REPO.test(x.repository??"")&&validBranch(x.branch)&&
 SHA.test(x.baseSha??"")&&
 Number.isSafeInteger(x.revision)&&x.revision>=1&&x.revision<=10000&&
 text(x.objective,2000,true)&&
 list(x.acceptance,8,400,true)&&list(x.constraints,12,300)&&
 list(x.nonGoals,8,300)&&list(x.preserve,12,300)&&
 list(x.allowedActions,12,200,true)&&exact(x.limits,LIMIT_KEYS)&&
 Number.isSafeInteger(x.limits.maxIterations)&&x.limits.maxIterations>=1&&
 x.limits.maxIterations<=1000&&
 Number.isSafeInteger(x.limits.maxMinutes)&&x.limits.maxMinutes>=1&&
 x.limits.maxMinutes<=10080&&
 Number.isSafeInteger(x.limits.maxModelTokens)&&x.limits.maxModelTokens>=1&&
 x.limits.maxModelTokens<=100000000;
}
function payload(input){
 return {schemaVersion:1,goalId:input.goalId,workspaceId:input.workspaceId,
  repository:input.repository,branch:input.branch,baseSha:input.baseSha,
  revision:input.revision,objective:input.objective,
  acceptance:[...input.acceptance],constraints:[...input.constraints],
  nonGoals:[...input.nonGoals],preserve:[...input.preserve],
  allowedActions:[...input.allowedActions],
  limits:{maxIterations:input.limits.maxIterations,
   maxMinutes:input.limits.maxMinutes,
   maxModelTokens:input.limits.maxModelTokens}};
}
export function createGoalContract(input){
 if(!validPayload(input))throw Error("INVALID_GOAL_CONTRACT");
 const normalized=payload(input);
 if(Buffer.byteLength(JSON.stringify(normalized),"utf8")>16384)
  throw Error("GOAL_CONTRACT_SIZE_LIMIT");
 return {...normalized,goalHash:createHash("sha256").
  update(JSON.stringify(normalized)).digest("hex")};
}
export function verifyGoalContract(contract){
 if(!exact(contract,[...PAYLOAD_KEYS,"goalHash"])||
    !DIGEST.test(contract.goalHash??""))return false;
 try{
  const source=Object.fromEntries(PAYLOAD_KEYS.map(k=>[k,contract[k]]));
  return createGoalContract(source).goalHash===contract.goalHash;
 }catch{return false;}
}
// The authenticated native host supplies this receipt after operator review;
// source-only callers cannot grant themselves authority with a boolean.
export function matchesNativeGoalApproval(contract,receipt,operation){
 return verifyGoalContract(contract)&&plain(receipt)&&
  receipt.trusted===true&&receipt.source==="NATIVE_HOST"&&
  receipt.operatorApproved===true&&receipt.operation===operation&&
  receipt.goalId===contract.goalId&&
  receipt.workspaceId===contract.workspaceId&&
  receipt.goalHash===contract.goalHash&&
  receipt.revision===contract.revision&&
  receipt.repository===contract.repository&&
  receipt.branch===contract.branch&&
  receipt.baseSha===contract.baseSha;
}
