import {createInterface} from "node:readline";
const scenario=process.argv[2]??"success";
const out=value=>process.stdout.write(JSON.stringify(value)+"\n");
const names=["status","search_capabilities","describe_capability","invoke_capability"];
for await(const line of createInterface({input:process.stdin})){
  const req=JSON.parse(line);
  if(req.method==="initialize"){
    if(scenario==="missing-init")continue;
    if(scenario==="junk-output"){process.stdout.write("not-json\n");continue;}
    out({jsonrpc:"2.0",id:req.id,result:{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"lazyprompting"}}});
  }
  if(req.method==="tools/list"){
    if(scenario==="exit-error")process.exitCode=1;
    out({jsonrpc:"2.0",id:req.id,result:{tools:names.map((name,i)=>({name:scenario==="wrong-name"&&i===2?"fake":name,
      description:`The ${name} tool`,inputSchema:{type:"object"}}))}});
  }
}
