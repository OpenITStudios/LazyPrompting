import {createHash} from "node:crypto";
import {parseChatGoalInput} from "./contract.mjs";

// Untrusted, bounded ChatGPT -> Codex review data, not a worker command.
// The native host alone owns Codex execution, leases, STOP and QA.
const WS=/^workspace-(0[1-9]|10)$/;
const DIGEST=/^[a-f0-9]{64}$/;
const validDigest=x=>typeof x==="string"&&x.length===64&&
  DIGEST.test(x)&&x!=="0".repeat(64);
const validWorkspace=x=>typeof x==="string"&&x.length===12&&WS.test(x);
const DOMAIN="lazyprompting/chatgpt-to-codex/review-only/v1\n";
const MAX_BRIEF_BYTES=4096;

export function buildChatGoalCodexReviewBrief(input,admission){
  // The receipt stays in the private native input, NEVER in this
  // Codex-readable proposal. Account and principal IDs stay outside too.
  const report=parseChatGoalInput("goal.report",input);
  if(!report||!admission||typeof admission!=="object"||
    !validWorkspace(admission.workspaceId)||
    !validDigest(admission.goalDigest)||
    !validDigest(admission.conversationDigest)||
    !Number.isSafeInteger(admission.epoch)||admission.epoch<1||
    admission.chatBound!==true)return null;
  const scope=Object.freeze({
    workspaceId:admission.workspaceId,
    goalDigest:admission.goalDigest,
    conversationDigest:admission.conversationDigest,
    epoch:admission.epoch,
  });
  const evidenceRefs=Object.freeze(report.evidenceRefs.map(item=>
    Object.freeze({kind:item.kind,ref:item.ref})));
  const proposal=Object.freeze({
    outcome:report.outcome,
    summary:report.summary,
    nextAction:report.nextAction??null,
    evidenceRefs,
  });
  const core={schemaVersion:1,kind:"CHATGPT_CODEX_REVIEW_PROPOSAL",scope,proposal};
  const fingerprint=createHash("sha256").update(DOMAIN)
    .update(JSON.stringify(core)).digest("hex");
  const brief=Object.freeze({
    ...core,source:"UNTRUSTED_CHATGPT_TOOL_DATA",fingerprint,
    evidenceVerified:false,operatorReviewRequired:true,
    codexDispatchAuthorized:false,chatTurnVerified:false,
    qa:"NOT_VERIFIED",nextPromptAllowed:false,
  });
  if(Buffer.byteLength(JSON.stringify(brief),"utf8")>MAX_BRIEF_BYTES)
    return null;
  return brief;
}
