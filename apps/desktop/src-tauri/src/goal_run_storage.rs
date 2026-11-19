// Bounded reads for native Codex V1 state. No file or approval is modified.
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

pub(crate) const MAX_SCOPE_BYTES: u64 = 64 * 1024;
pub(crate) const MAX_REPORT_BYTES: u64 = 4 * 1024 * 1024;
pub(crate) const MAX_TASK_OUTBOX_BYTES: u64 = 8 * 1024 * 1024;
pub(crate) const MAX_DECISION_BYTES: u64 = 64;
pub(crate) const MAX_LAUNCH_ERROR_BYTES: u64 = 4 * 1024;

fn unsafe_record() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "GOAL_STATE_UNSAFE_OR_TOO_LARGE")
}

// Check the path before opening, then check the opened handle and cap
// actual bytes read. A replacement/extension after metadata cannot cause
// an unbounded allocation. Missing files remain distinct from corruption.
pub(crate) fn read_bounded(path: &Path, max_bytes: u64) -> io::Result<Option<Vec<u8>>> {
    let info = match fs::symlink_metadata(path) {
        Ok(info) => info,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    if !info.is_file() || info.file_type().is_symlink() || info.len() > max_bytes {
        return Err(unsafe_record());
    }
    let file = File::open(path)?;
    let opened = file.metadata()?;
    if !opened.is_file() || opened.len() > max_bytes {
        return Err(unsafe_record());
    }
    let mut data = Vec::new();
    file.take(max_bytes + 1).read_to_end(&mut data)?;
    if (data.len() as u64) > max_bytes {
        return Err(unsafe_record());
    }
    Ok(Some(data))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::ErrorKind;

    #[test]
    fn absent_small_and_oversized_records_have_distinct_outcomes() {
        let mut nonce = [0u8; 16];
        getrandom::getrandom(&mut nonce).unwrap();
        let root = std::env::temp_dir().join(format!(
            "lazyprompting-bounded-{}",
            crate::native_ipc_pipe::hex(&nonce)
        ));
        fs::create_dir(&root).unwrap();
        let path = root.join("run.json");
        assert!(read_bounded(&path, MAX_SCOPE_BYTES).unwrap().is_none());

        fs::write(&path, b"{\"safe\":true}").unwrap();
        assert_eq!(
            read_bounded(&path, MAX_SCOPE_BYTES).unwrap().as_deref(),
            Some(&b"{\"safe\":true}"[..])
        );

        fs::write(&path, vec![b'x'; MAX_SCOPE_BYTES as usize + 1]).unwrap();
        assert_eq!(
            read_bounded(&path, MAX_SCOPE_BYTES).unwrap_err().kind(),
            ErrorKind::InvalidData
        );
        assert_eq!(fs::metadata(&path).unwrap().len(), MAX_SCOPE_BYTES + 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn directories_are_never_treated_as_records() {
        assert_eq!(
            read_bounded(std::env::temp_dir().as_path(), MAX_SCOPE_BYTES)
                .unwrap_err()
                .kind(),
            ErrorKind::InvalidData
        );
    }
}
