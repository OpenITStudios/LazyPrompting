// Pure policy for monitoring UI generation-control hints, not ChatGPT output.
// The existing native host owns the actual read; no model, network request,
// browser worker or second scheduler is introduced here.
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
export const CHAT_WATCH_MAX_MS=15*60*1000;
export const CHAT_WATCH_MIN_GLOBAL_GAP_MS=2000;
const WAITING_DELAYS=[3000,6000,12000,20000,30000];
const GENERATING_DELAYS=[5000,10000,18000,30000];

export function nextChatWatchDelay(phase,checks,elapsedMs){
 if(!Number.isSafeInteger(checks)||checks<0||
    !Number.isSafeInteger(elapsedMs)||elapsedMs<0||
    elapsedMs>=CHAT_WATCH_MAX_MS)return null;
 const intervals=phase==="WAITING"?WAITING_DELAYS:
   phase==="GENERATING"?GENERATING_DELAYS:null;
 if(!intervals)return null;
 return Math.min(intervals[Math.min(checks,intervals.length-1)],
                 CHAT_WATCH_MAX_MS-elapsedMs);
}

// Choose one due workspace only; null means no timer is necessary.
// Expired watches are retired locally even when the global rate cap
// would otherwise delay another native status request.
export function selectChatWatch({watches={},mounted=[],checking={},sending={},
 nowMs,lastPolledAtMs=null}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<0||!Array.isArray(mounted)||
    !watches||typeof watches!=="object"||Array.isArray(watches)||
    !checking||typeof checking!=="object"||
    !sending||typeof sending!=="object"||
    (lastPolledAtMs!==null&&(!Number.isSafeInteger(lastPolledAtMs)||
      lastPolledAtMs<0)))return null;
 let chosen=null;
 for(const [workspaceId,watch] of Object.entries(watches)){
  if(!WORKSPACE.test(workspaceId)||!watch||typeof watch!=="object"||
     !mounted.includes(workspaceId)||checking[workspaceId]===true||
     sending[workspaceId]===true)continue;
  const {startedAt,dueAt,checks}=watch;
  if(![startedAt,dueAt,checks].every(Number.isSafeInteger)||
     startedAt<0||dueAt<startedAt||checks<0||nowMs<startedAt)continue;
  const expiry=startedAt+CHAT_WATCH_MAX_MS;
  if(!Number.isSafeInteger(expiry))continue;
  const expired=nowMs>=expiry;
  const due=expired?nowMs:Math.min(expiry,Math.max(
    dueAt,
    lastPolledAtMs===null?0:lastPolledAtMs+CHAT_WATCH_MIN_GLOBAL_GAP_MS));
  const delayMs=Math.max(0,due-nowMs);
  if(!chosen||delayMs<chosen.delayMs||
     (delayMs===chosen.delayMs&&workspaceId<chosen.workspaceId))
   chosen={workspaceId,delayMs,expired};
 }
 return chosen;
}
