<script lang="ts">
 import {onMount} from "svelte";
 import {invoke} from "@tauri-apps/api/core";
 let {nativeDesktop=false}:{nativeDesktop:boolean}=$props();

 type ApiReceipt={
  source?:string;started?:boolean;reason?:string;runId?:string;
  workspaceId:string;state:string;consumerChat:boolean;
  nextPromptAllowed:boolean;summary?:string;evidence?:string;
  blocker?:string;turnCount?:number;totalTokens?:number;
  lastDecision?:string;conversationId?:string|null;
 };
 let goal=$state("");
 let model=$state("gpt-6-astra");
 let maxTurns=$state(3);
 let maxOutputTokens=$state(1024);
 let maxTotalTokens=$state(10000);
 let runId=$state("");
 let state=$state("NO_RUN");
 let summary=$state("");
 let evidence=$state("");
 let turnCount=$state(0);
 let usedTokens=$state(0);
 let notice=$state("");
 let busy=$state(false);
 let reading=$state(false);
 let timer:number|null=null;
 let alive=true;
 const active=()=>["PREPARING","RUNNING","STOP_REQUESTED"].includes(state);
 function schedule(){
  if(timer!==null)window.clearTimeout(timer);
  timer=null;
  if(!alive||!nativeDesktop||document.hidden||!runId||!active())return;
  timer=window.setTimeout(()=>{timer=null;void refresh();},2000);
 }
 async function refresh(){
  if(!nativeDesktop||reading)return;
  reading=true;
  try{
   const receipt=await invoke<ApiReceipt>("api_goal_status",{runId:runId||null});
   if(!alive)return;
   if(receipt.source!=="OPENAI_PLATFORM_GOAL"||
      receipt.workspaceId!=="api-workspace-01"||
      receipt.consumerChat!==false||receipt.nextPromptAllowed!==false)
    throw Error("INVALID_API_GOAL_STATUS");
   runId=receipt.runId??runId;
   state=receipt.state;
   summary=receipt.summary??"";
   evidence=receipt.evidence??"";
   turnCount=receipt.turnCount??0;
   usedTokens=receipt.totalTokens??0;
   notice=state==="REVIEW_REQUIRED"
    ?"The model proposes a result. Review it; independent QA is not verified."
    :state==="RECONCILE_REQUIRED"
    ?"The prior API operation is uncertain. Do not retry; inspect this run."
    :state==="STOPPED"
    ?"The run stopped. No further model turns are authorized."
    :state==="NO_RUN"
    ?"No API run is recorded for this local workspace."
    :active()?"The approved API run is in progress."
    :receipt.blocker??"Review the run state.";
  }catch{
   if(alive){state="RECONCILE_REQUIRED";
    notice="Status unavailable. Do not repeat a paid request; inspect the outbox.";}
  }finally{reading=false;schedule();}
 }
 async function start(){
  if(!nativeDesktop||busy||active()||state==="RECONCILE_REQUIRED"||
     !goal.trim())return;
  busy=true;
  try{
   const receipt=await invoke<ApiReceipt>("api_goal_start",{
    settings:{goal,model,maxTurns:Number(maxTurns),
     maxOutputTokens:Number(maxOutputTokens),maxTotalTokens:Number(maxTotalTokens)}
   });
   if(!alive)return;
   if(receipt.started!==true||receipt.workspaceId!=="api-workspace-01"||
      receipt.consumerChat!==false||receipt.nextPromptAllowed!==false||
      typeof receipt.runId!=="string")throw Error(receipt.reason??"API_GOAL_NOT_STARTED");
   runId=receipt.runId;state="PREPARING";
   summary="";evidence="";turnCount=0;usedTokens=0;
   notice="Run accepted. The separate OpenAI API conversation is being prepared.";
  }catch(error){
   if(alive){
    const reason=String(error);
    notice=reason.includes("OPENAI_API_KEY_OR_CLIENT_UNAVAILABLE")
     ?"Configure OPENAI_API_KEY for the local host and reopen the app. No request was sent."
     :reason.includes("API_GOAL_OPERATOR_DECLINED")
     ?"The billed API run was declined. Nothing was generated."
     :"Run was not started: "+reason.slice(0,95)+". Inspect earlier state first.";
   }
  }finally{busy=false;schedule();}
 }
 async function stop(){
  if(!nativeDesktop||busy||!runId||!active())return;
  busy=true;
  try{
   const receipt=await invoke<ApiReceipt>("api_goal_stop",{runId});
   if(!alive)return;
   if(receipt.runId!==runId||receipt.workspaceId!=="api-workspace-01"||
      receipt.nextPromptAllowed!==false)throw Error("API_GOAL_STOP_UNVERIFIED");
   state=receipt.state;
   notice="STOP requested. Any in-flight generation may be uncertain; no new turns are permitted.";
  }catch{
   if(alive){state="RECONCILE_REQUIRED";
    notice="STOP outcome uncertain. Inspect this run; never replay it automatically.";}
  }finally{busy=false;schedule();}
 }
 onMount(()=>{
  alive=true;
  const visibility=()=>schedule();
  document.addEventListener("visibilitychange",visibility);
  return ()=>{alive=false;
   if(timer!==null)window.clearTimeout(timer);
   document.removeEventListener("visibilitychange",visibility);
  };
 });
</script>

<details class="lp-browser-detail" aria-label="Optional OpenAI Platform API automation">
 <summary>API automation (optional, separately billed)</summary>
 <p>Separate OpenAI Platform API conversation, not the ChatGPT browser tab. Requires OPENAI_API_KEY in the local desktop environment and explicit Windows approval. Set a hard spend cap in the OpenAI project; token thresholds are not dollar guarantees.</p>
 <label for="lp-api-goal">Approved goal</label>
 <textarea id="lp-api-goal" rows="3" maxlength="2000"
  bind:value={goal} placeholder="Describe one bounded prompting or analysis goal."></textarea>
 <div class="lp-browser-observation-tools">
  <label for="lp-api-model">Model</label>
  <input id="lp-api-model" maxlength="80" bind:value={model}/>
  <label for="lp-api-turns">Maximum turns (1–5)</label>
  <input id="lp-api-turns" type="number" min="1" max="5" step="1" bind:value={maxTurns}/>
  <label for="lp-api-output">Output tokens per turn (256–2048)</label>
  <input id="lp-api-output" type="number" min="256" max="2048" step="256"
   bind:value={maxOutputTokens}/>
  <label for="lp-api-total">Total-token stop threshold (2048–80000)</label>
  <input id="lp-api-total" type="number" min="2048" max="80000" step="1024"
   bind:value={maxTotalTokens}/>
 </div>
 <div class="lp-browser-observation-tools">
  <button type="button" class="lp-focus-button"
   disabled={!nativeDesktop||busy||!goal.trim()||active()||state==="RECONCILE_REQUIRED"}
   onclick={start}>Start approved API goal</button>
  <button type="button" class="lp-focus-button"
   disabled={!nativeDesktop||reading} onclick={refresh}>Check existing API run</button>
  <button type="button" class="lp-focus-button"
   disabled={!nativeDesktop||busy||!active()||!runId}
   onclick={stop}>STOP API goal</button>
 </div>
 <p role="status">{notice||"API mode inactive. No API calls or model-token polling occur while idle."}</p>
 {#if runId}
  <p>Run: {runId} · State: {state} · Turns: {turnCount}/{maxTurns} · Reported tokens: {usedTokens}</p>
 {/if}
 {#if summary}
  <p><strong>Model-proposed result (review required):</strong> {summary}</p>
 {/if}
 {#if evidence}
  <p>Model-described evidence (not independently verified): {evidence}</p>
 {/if}
</details>
