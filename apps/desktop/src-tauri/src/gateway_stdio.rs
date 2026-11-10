// MCP JSON-RPC stdio framing (newline-delimited JSON), separate from native auth IPC.
// Pure, bounded codec; never treat MCP messages as authorization.
use serde_json::Value;
use std::io::{BufRead, Write};

const MAX_MESSAGE: usize = 1024 * 1024;

pub(crate) fn write_message<W: Write>(output: &mut W, message: &Value) -> Result<(), &'static str> {
    let data=serde_json::to_vec(message).map_err(|_|"MCP_SERIALIZE_FAILED")?;
    if data.len()>MAX_MESSAGE || data.contains(&b'\n') {return Err("MCP_MESSAGE_TOO_LARGE");}
    output.write_all(&data).map_err(|_|"MCP_WRITE_FAILED")?;
    output.write_all(b"\n").map_err(|_|"MCP_WRITE_FAILED")?;
    output.flush().map_err(|_|"MCP_WRITE_FAILED")
}

pub(crate) fn read_message<R: BufRead>(input: &mut R) -> Result<Value, &'static str> {
    let mut data=Vec::new();
    loop {
        let available=input.fill_buf().map_err(|_|"MCP_READ_FAILED")?;
        if available.is_empty() {return Err("MCP_EOF");}
        let newline=available.iter().position(|byte|*byte==b'\n');
        let take=newline.map_or(available.len(),|index|index+1);
        if data.len().saturating_add(take)>MAX_MESSAGE+1 {return Err("MCP_MESSAGE_TOO_LARGE");}
        data.extend_from_slice(&available[..take]);
        input.consume(take);
        if newline.is_some() {break;}
    }
    if data.last()==Some(&b'\n') {data.pop();}
    if data.last()==Some(&b'\r') {data.pop();}
    if data.len()>MAX_MESSAGE {return Err("MCP_MESSAGE_TOO_LARGE");}
    let value:Value=serde_json::from_slice(&data).map_err(|_|"MCP_INVALID_JSON")?;
    if value.get("jsonrpc").and_then(Value::as_str)!=Some("2.0") ||
       !value.is_object() {return Err("MCP_INVALID_ENVELOPE");}
    Ok(value)
}

pub(crate) fn response_matches(message:&Value, expected_id:u64) -> bool {
    message.get("jsonrpc").and_then(Value::as_str)==Some("2.0") &&
    message.get("id").and_then(Value::as_u64)==Some(expected_id) &&
    (message.get("result").is_some() ^ message.get("error").is_some())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufReader,Cursor};
    #[test] fn round_trip_and_id_match() {
        let value=serde_json::json!({"jsonrpc":"2.0","id":3,"result":{"ok":true}});
        let mut output=Vec::new();
        write_message(&mut output,&value).unwrap();
        let mut reader=BufReader::new(Cursor::new(output));
        let decoded=read_message(&mut reader).unwrap();
        assert!(response_matches(&decoded,3));
        assert!(!response_matches(&decoded,4));
    }
    #[test] fn rejects_bad_and_oversized_frames() {
        let mut reader=BufReader::new(Cursor::new(b"{broken}\n"));
        assert!(matches!(read_message(&mut reader),Err("MCP_INVALID_JSON")));
        let mut reader=BufReader::new(Cursor::new(vec![b'a';MAX_MESSAGE+2]));
        assert!(matches!(read_message(&mut reader),Err("MCP_MESSAGE_TOO_LARGE")));
        let mut reader=BufReader::new(Cursor::new(b"{\"id\":1}\n"));
        assert!(matches!(read_message(&mut reader),Err("MCP_INVALID_ENVELOPE")));
    }
}
