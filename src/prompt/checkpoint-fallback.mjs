// Fail-closed fallback when context limit interrupts a planned checkpoint.
// This only chooses a previously source-verified checkpoint, never claims lost work survived.
import {assessRepositoryCheckpoint,buildRepositoryResumePrompt} from "./repository-continuity.mjs";
export function chooseLastVerifiedCheckpoint({workspace,candidates=[]}={}){
 if(!workspace||!Array.isArray(candidates)||candidates.length>100)
  return {ready:false,reason:"INVALID_CHECKPOINT_HISTORY"};
 const eligible=[];
 for(const item of candidates){
  const verified=assessRepositoryCheckpoint({workspace,checkpoint:item?.checkpoint,sourceProof:item?.sourceProof});
  if(verified.ready&&Number.isSafeInteger(item.sequence)&&item.sequence>=0)
   eligible.push({sequence:item.sequence,verified});
 }
 if(!eligible.length)return {ready:false,reason:"NO_CURRENT_VERIFIED_CHECKPOINT"};
 eligible.sort((a,b)=>b.sequence-a.sequence);
 const selected=eligible[0].verified;
 const resume=buildRepositoryResumePrompt(selected);
 return {ready:true,checkpoint:selected,resumePrompt:resume.prompt,
  recoveryWarning:"UNCOMMITTED_CHAT_WORK_NOT_VERIFIED"};
}
