// Existing LazyPrompting executable's browser CLI route.
// No second browser/MCP server, standalone daemon, or permission owner.
use serde_json::{json,Value};

fn command(args:&[String])->Result<Value,String>{
 if args.len()<3||args.len()>4||args[0]!="browser"||args[1]!="observe"{
  return Err("USAGE: browser observe <workspace-01..10> [compact|delta]".into())
 }
 let workspace=&args[2];
 crate::embedded_webview::label_for(workspace)?;
 let mode=args.get(3).map(String::as_str).unwrap_or("compact");
 if !matches!(mode,"compact"|"delta"){
  return Err("BROWSER_CLI_INVALID_MODE".into())
 }
 // Identical request as the installed stdio MCP facade; native pipe still
 // authenticates the executable and enforces workspace ownership and consent.
 Ok(json!({"workspaceId":workspace,"action":"observe","mode":mode}))
}
pub(crate) fn run()->Result<(),String>{
 let args=std::env::args().skip(1).collect::<Vec<_>>();
 let request=command(&args)?;
 let reply=crate::browser_mcp_pipe::request(request)?;
 let output=serde_json::to_string(&reply)
   .map_err(|_|"BROWSER_CLI_RESPONSE_INVALID")?;
 println!("{output}");
 Ok(())
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]
 fn strict_cli_arguments_share_native_observe_contract(){
  let args=["browser","observe","workspace-01","delta"]
    .map(str::to_string).to_vec();
  let request=command(&args).unwrap();
  assert_eq!(request["workspaceId"],"workspace-01");
  assert_eq!(request["mode"],"delta");
  assert_eq!(request["action"],"observe");
  let fallback=command(&args[..3]).unwrap();
  assert_eq!(fallback["mode"],"compact");
 }
 #[test]
 fn cli_cannot_arm_or_operate_chatgpt(){
  for args in [
   vec!["browser","arm","workspace-01"],
   vec!["browser","click","workspace-01"],
   vec!["browser","observe","workspace-11"],
   vec!["browser","observe","workspace-01","javascript"],
   vec!["browser","observe","workspace-01","compact","extra"],
  ]{
   let values=args.into_iter().map(str::to_string).collect::<Vec<_>>();
   assert!(command(&values).is_err());
  }
 }
}
