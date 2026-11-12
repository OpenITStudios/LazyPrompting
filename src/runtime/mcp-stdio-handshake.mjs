import {spawn} from "node:child_process";

export const MCP_PUBLIC_TOOLS = Object.freeze([
  "status", "search_capabilities", "describe_capability", "invoke_capability"
]);

// Probes the installed MCP server, NOT the target client's agent integration.
export async function verifyMcpStdioServer(command, args = [], {timeoutMs = 30_000} = {}) {
  if (typeof command !== "string" || !command || !Array.isArray(args) ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    return {ok:false, tools:0, reason:"INVALID_VERIFICATION_CONFIG"};

  const send = value => JSON.stringify({jsonrpc:"2.0",...value})+"\n";
  return new Promise(resolve => {
    let child;
    try {
      child=spawn(command,args,{stdio:["pipe","pipe","ignore"],windowsHide:true});
    } catch {
      resolve({ok:false,tools:0,reason:"MCP_SERVER_START_FAILED"});return;
    }
    let phase="initialize",buffer="",tools=0,problem=null,settled=false;
    const timeout=setTimeout(()=>fail("MCP_HANDSHAKE_TIMEOUT"),timeoutMs);
    const fail=reason=>{
      if (!problem) problem=reason;
      child.kill();
    };
    const init=send({id:1,method:"initialize",params:{
      protocolVersion:"2025-03-26",capabilities:{},
      clientInfo:{name:"lazyprompting-setup",version:"1"}
    }});
    child.stdin.on("error",()=>fail("MCP_STDIN_FAILED"));
    child.stdout.on("data",chunk=>{
      buffer+=chunk.toString("utf8");
      if (buffer.length>256*1024){fail("MCP_OUTPUT_TOO_LARGE");return;}
      while(buffer.includes("\n") && !problem){
        const end=buffer.indexOf("\n");
        const line=buffer.slice(0,end).trim(); buffer=buffer.slice(end+1);
        let message;
        try { message=JSON.parse(line); }
        catch { fail("MCP_INVALID_STDOUT");return; }
        if (phase==="initialize") {
          if(message?.jsonrpc!=="2.0" || message.id!==1 ||
             message.result?.protocolVersion!=="2025-03-26" ||
             message.result?.serverInfo?.name!=="lazyprompting" ||
             !message.result?.capabilities?.tools){
            fail("MCP_INITIALIZE_INVALID");return;
          }
          phase="tools";
          child.stdin.write(send({method:"notifications/initialized"})+
            send({id:2,method:"tools/list",params:{}}));
        } else if (phase==="tools") {
          if(message?.jsonrpc!=="2.0" || message.id!==2 ||
             !Array.isArray(message.result?.tools)){
            fail("MCP_TOOLS_LIST_INVALID");return;
          }
          const listed=message.result.tools;
          tools=listed.length;
          if (tools!==MCP_PUBLIC_TOOLS.length || listed.some((x,i)=>
              x?.name!==MCP_PUBLIC_TOOLS[i] || x.inputSchema?.type!=="object" ||
              typeof x.description!=="string" || !x.description)){
            fail("MCP_TOOLS_CONTRACT_MISMATCH");return;
          }
          phase="complete";
          child.stdin.end();
        } else {
          fail("MCP_UNEXPECTED_STDOUT");return;
        }
      }
    });
    child.on("error",()=>fail("MCP_SERVER_START_FAILED"));
    child.on("close",code=>{
      if (settled) return;
      settled=true;clearTimeout(timeout);
      const reason=problem??(code!==0?"MCP_SERVER_EXIT_FAILED":
        phase!=="complete"?"MCP_HANDSHAKE_INCOMPLETE":"MCP_STDIO_VERIFIED");
      resolve({ok:reason==="MCP_STDIO_VERIFIED",tools,reason});
    });
    child.stdin.write(init);
  });
}
