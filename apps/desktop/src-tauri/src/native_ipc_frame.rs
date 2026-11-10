// Native authorization pipe framing ONLY. Not MCP stdio and not authentication.
// Caller must enforce authenticated Windows pipe identity and I/O deadlines.
use serde_json::Value;
use std::io::{Read, Write};
const MAX_FRAME: usize = 16 * 1024;
const VERSION: u8 = 1;

pub(crate) fn write_frame<W: Write>(writer: &mut W, value: &Value) -> Result<(), &'static str> {
    let payload = serde_json::to_vec(value).map_err(|_| "IPC_SERIALIZE_FAILED")?;
    if payload.is_empty() || payload.len() > MAX_FRAME {
        return Err("IPC_FRAME_TOO_LARGE");
    }
    let len = u32::try_from(payload.len()).map_err(|_| "IPC_FRAME_TOO_LARGE")?;
    let mut header = [0u8; 5];
    header[0] = VERSION;
    header[1..].copy_from_slice(&len.to_be_bytes());
    writer.write_all(&header).map_err(|_| "IPC_WRITE_FAILED")?;
    writer.write_all(&payload).map_err(|_| "IPC_WRITE_FAILED")?;
    writer.flush().map_err(|_| "IPC_WRITE_FAILED")
}
pub(crate) fn read_frame<R: Read>(reader: &mut R) -> Result<Value, &'static str> {
    let mut header = [0u8; 5];
    reader
        .read_exact(&mut header)
        .map_err(|_| "IPC_READ_FAILED")?;
    if header[0] != VERSION {
        return Err("IPC_VERSION_UNSUPPORTED");
    }
    let size =
        u32::from_be_bytes(header[1..].try_into().map_err(|_| "IPC_INVALID_HEADER")?) as usize;
    if size == 0 || size > MAX_FRAME {
        return Err("IPC_FRAME_TOO_LARGE");
    }
    let mut payload = vec![0u8; size];
    reader
        .read_exact(&mut payload)
        .map_err(|_| "IPC_READ_FAILED")?;
    let value: Value = serde_json::from_slice(&payload).map_err(|_| "IPC_INVALID_JSON")?;
    if !value.is_object() {
        return Err("IPC_INVALID_ENVELOPE");
    }
    Ok(value)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    #[test]
    fn bounded_roundtrip() {
        let value = serde_json::json!({"type":"health","nonce":"sample"});
        let mut output = Vec::new();
        write_frame(&mut output, &value).unwrap();
        assert_eq!(read_frame(&mut Cursor::new(output)).unwrap(), value);
    }
    #[test]
    fn rejects_invalid_versions_and_sizes_before_allocation() {
        let mut invalid = [0u8; 5];
        invalid[0] = 2;
        invalid[4] = 1;
        assert!(matches!(
            read_frame(&mut Cursor::new(invalid)),
            Err("IPC_VERSION_UNSUPPORTED")
        ));
        let oversized = [1, 0, 1, 0, 0];
        assert!(matches!(
            read_frame(&mut Cursor::new(oversized)),
            Err("IPC_FRAME_TOO_LARGE")
        ));
        let zero = [1, 0, 0, 0, 0];
        assert!(matches!(
            read_frame(&mut Cursor::new(zero)),
            Err("IPC_FRAME_TOO_LARGE")
        ));
    }
}
