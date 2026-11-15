// Command-line entry point on the existing LazyPrompting executable.
// All executable operations use the installed MCP native pipe and workspace
// leases. No standalone browser, privileged CLI engine or permission bypass.
use serde_json::{json,Value};

const USAGE:&str="Usage: lazyprompting-desktop.exe browser <action> <workspace-01..10> [argument]\n\
Actions:\n\
  open [https-url]       Open ChatGPT main; public URLs need operator tab approval\n\
  navigate <https-url>   Navigate selected supporting tab only\n\
  location               Read selected tab address (query/fragment removed)\n\
  back | forward | reload  Act on selected supporting tab only\n\
  observe [compact|delta]  Use one preapproved supporting-tab snapshot\n\
  release                Release this client's workspace lease\n";

fn command(args:&[String])->Result<Value,String>{
 if args.len()<3||args.len()>4||args[0]!="browser"{
  return Err(USAGE.into())
 }
 let action=args[1].as_str();
 let workspace=&args[2];
 crate::embedded_webview::label_for(workspace)?;
 let mut req=json!({"workspaceId":workspace,"action":action});
 match (action,args.get(3).map(String::as_str)){
  ("open",None)=>{},
  ("open",Some(url))|("navigate",Some(url))=>{
   // Avoid reserving a client lease for invalid addresses. The native host
   // independently revalidates the complete request and selected-tab policy.
   if url.len()>2048||crate::embedded_webview::browser_address(url).is_err(){
    return Err("BROWSER_CLI_INVALID_ADDRESS".into())
   }
   req["address"]=json!(url);
  },
  ("observe",None)=>{req["mode"]=json!("compact");},
  ("observe",Some(mode)) if matches!(mode,"compact"|"delta")=>{
   req["mode"]=json!(mode);
  },
  ("location"|"back"|"forward"|"reload"|"release",None)=>{},
  _=>return Err(USAGE.into()),
 }
 Ok(req)
}
pub(crate) fn run()->Result<(),String>{
 let args=std::env::args().skip(1).collect::<Vec<_>>();
 if args.len()==1&&args[0]=="browser" ||
    args.len()==2&&args[0]=="browser"&&matches!(args[1].as_str(),"--help"|"help"|"--usage"){
  println!("{USAGE}");
  return Ok(())
 }
 let request=command(&args)?;
 // Same authenticated pipe, verified executable identity, source owner,
 // workspace lease, operator consent and ChatGPT main policy as stdio MCP.
 let reply=crate::browser_mcp_pipe::request(request)?;
 let output=serde_json::to_string(&reply)
   .map_err(|_|"BROWSER_CLI_RESPONSE_INVALID")?;
 println!("{output}");
 Ok(())
}
#[cfg(test)]
mod tests{
 use super::*;
 fn args(parts:&[&str])->Vec<String>{parts.iter().map(|s|s.to_string()).collect()}
 #[test]
 fn all_cli_commands_match_existing_native_pipe_contract(){
  let cases=[
   (vec!["browser","open","workspace-01"],"open"),
   (vec!["browser","open","workspace-01","https://example.org/"],"open"),
   (vec!["browser","navigate","workspace-01","https://example.org/"],"navigate"),
   (vec!["browser","location","workspace-01"],"location"),
   (vec!["browser","back","workspace-01"],"back"),
   (vec!["browser","forward","workspace-01"],"forward"),
   (vec!["browser","reload","workspace-01"],"reload"),
   (vec!["browser","release","workspace-01"],"release"),
   (vec!["browser","observe","workspace-01","delta"],"observe"),
  ];
  for (parts,expected) in cases{
   let request=command(&args(&parts)).unwrap();
   assert_eq!(request["workspaceId"],"workspace-01");
   assert_eq!(request["action"],expected);
  }
  let read=command(&args(&["browser","observe","workspace-01"])).unwrap();
  assert_eq!(read["mode"],"compact");
 }
 #[test]
 fn cli_cannot_arm_or_operate_an_arbitrary_site_without_host_admission(){
  for parts in [
   vec!["browser","arm","workspace-01"],
   vec!["browser","click","workspace-01"],
   vec!["browser","observe","workspace-11"],
   vec!["browser","observe","workspace-01","javascript"],
   vec!["browser","navigate","workspace-01"],
   vec!["browser","navigate","workspace-01","javascript:alert(1)"],
   vec!["browser","navigate","workspace-01","https://user:pass@example.org/"],
   vec!["browser","location","workspace-01","https://example.org/"],
   vec!["browser","open","workspace-01","https://example.org/","extra"],
  ]{
   assert!(command(&args(&parts)).is_err(),"{parts:?}");
  }
 }
}
