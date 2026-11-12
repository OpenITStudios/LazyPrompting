// OpenCode CLI JSONL is an observation stream, NOT a guaranteed final receipt.
// Versions have omitted the last step_finish even when exit code was 0. A
// missing terminal event therefore requires independent session reconciliation.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const READ_ONLY_TOOLS=new Set(['read','glob','grep']);
const MAX_BYTES=1024*1024;

export function parseOpenCodeJsonl(stdout,{sessionId,exitCode}={}) {
  if(typeof stdout!=='string'||Buffer.byteLength(stdout,'utf8')>MAX_BYTES||
      !ID.test(sessionId??'')||!Number.isInteger(exitCode))
    throw Error('OPENCODE_JSONL_INVALID_INPUT');
  const lines=stdout.split(/\r?\n/).filter(x=>x.trim());
  if(lines.length>512)return {state:'UNKNOWN',reason:'OPENCODE_JSONL_LIMIT'};
  let textId=null,textCount=0,finished=false,error=false,stepStarted=false;
  for(const line of lines){
    if(Buffer.byteLength(line,'utf8')>128*1024)
      return {state:'UNKNOWN',reason:'OPENCODE_JSONL_FRAME_LIMIT'};
    let event;
    try{event=JSON.parse(line);}catch{return {state:'UNKNOWN',reason:'OPENCODE_JSONL_MALFORMED'};}
    if(!event||typeof event!=='object'||Array.isArray(event)||
        event.sessionID!==sessionId||typeof event.type!=='string')
      return {state:'UNKNOWN',reason:'OPENCODE_JSONL_SESSION_CONFLICT'};
    if(event.type==='error'){error=true;continue;}
    if(event.type==='step_start'){
      stepStarted=true;finished=false;continue;
    }
    if(event.type==='tool_use'){
      if(!READ_ONLY_TOOLS.has(event.part?.tool))
        return {state:'UNKNOWN',reason:'OPENCODE_UNVERIFIED_TOOL_USE'};
      continue;
    }
    if(event.type==='text'){
      const id=event.part?.messageID;
      if(!ID.test(id??'')||typeof event.part?.text!=='string'||
          !event.part.text.trim())
        return {state:'UNKNOWN',reason:'OPENCODE_TEXT_UNVERIFIED'};
      textId=id;textCount++;continue;
    }
    if(event.type==='step_finish'){
      if(!stepStarted)return {state:'UNKNOWN',reason:'OPENCODE_STEP_ORDER_INVALID'};
      finished=event.part?.reason==='stop';continue;
    }
    // Unrecognized events provide no permission or completion evidence.
  }
  if(error||exitCode!==0)return {state:'FAILED',reason:'OPENCODE_EXECUTION_FAILED'};
  if(!textId||!textCount||!finished)
    // A candidate message ID is only a pointer for trusted reconciliation;
    // it is not a terminal event or an authorized result receipt.
    return {state:'UNKNOWN',reason:'OPENCODE_TERMINAL_EVENT_MISSING',
      ...(textId?{candidateTurnId:textId}:{})};
  return {state:'COMPLETED',sessionId,turnId:textId,resultRef:textId};
}
