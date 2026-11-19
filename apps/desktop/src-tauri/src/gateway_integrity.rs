// The trusted desktop build embeds the staged manifest digest.
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::{ErrorKind, Read};
use std::path::{Component, Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    node_sha256: String,
    files: BTreeMap<String, String>,
}
// Verification must rehash every packaged file, including the large Node
// binary, without keeping an entire executable in process memory.
fn digest(path: &Path) -> Result<String, &'static str> {
    let mut file = fs::File::open(path).map_err(|_| "GATEWAY_INTEGRITY_READ_FAILED")?;
    let mut hasher = Sha256::new();
    let mut chunk = [0u8; 64 * 1024];
    loop {
        match file.read(&mut chunk) {
            Ok(0) => break,
            Ok(count) => hasher.update(&chunk[..count]),
            Err(error) if error.kind() == ErrorKind::Interrupted => continue,
            Err(_) => return Err("GATEWAY_INTEGRITY_READ_FAILED"),
        }
    }
    Ok(format!("{:x}", hasher.finalize()))
}
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;
fn read_manifest(path: &Path) -> Result<Vec<u8>, &'static str> {
    let file = fs::File::open(path).map_err(|_| "GATEWAY_INTEGRITY_MANIFEST_MISSING")?;
    let mut raw = Vec::new();
    file.take(MAX_MANIFEST_BYTES + 1)
        .read_to_end(&mut raw)
        .map_err(|_| "GATEWAY_INTEGRITY_MANIFEST_MISSING")?;
    if raw.len() as u64 > MAX_MANIFEST_BYTES {
        return Err("GATEWAY_INTEGRITY_MANIFEST_TOO_LARGE");
    }
    Ok(raw)
}
fn safe_path(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('\\')
        && Path::new(value)
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
        && !Path::new(value).is_absolute()
}
pub(crate) fn verify(root: &Path) -> Result<(), &'static str> {
    let expected =
        option_env!("LAZY_GATEWAY_MANIFEST_SHA256").ok_or("GATEWAY_NOT_PACKAGED_AT_BUILD")?;
    let canonical_root = fs::canonicalize(root).map_err(|_| "GATEWAY_INTEGRITY_ROOT_MISSING")?;
    let raw = read_manifest(&canonical_root.join("manifest.json"))?;
    if format!("{:x}", Sha256::digest(&raw)) != expected {
        return Err("GATEWAY_INTEGRITY_MANIFEST_MISMATCH");
    }
    let manifest: Manifest =
        serde_json::from_slice(&raw).map_err(|_| "GATEWAY_INTEGRITY_MANIFEST_INVALID")?;
    if manifest.files.is_empty()
        || manifest.files.len() > 512
        || !manifest.files.contains_key("mcp-gateway.mjs")
    {
        return Err("GATEWAY_INTEGRITY_MANIFEST_INVALID");
    }
    let node = if cfg!(windows) { "node.exe" } else { "node" };
    let mut entries = manifest.files;
    entries.insert(node.to_string(), manifest.node_sha256);
    for (relative, expected) in entries {
        if !safe_path(&relative)
            || expected.len() != 64
            || !expected.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err("GATEWAY_INTEGRITY_MANIFEST_INVALID");
        }
        let candidate = fs::canonicalize(canonical_root.join(&relative))
            .map_err(|_| "GATEWAY_INTEGRITY_FILE_MISSING")?;
        if !candidate.starts_with(&canonical_root) || !candidate.is_file() {
            return Err("GATEWAY_INTEGRITY_PATH_ESCAPE");
        }
        if digest(&candidate)? != expected.to_ascii_lowercase() {
            return Err("GATEWAY_INTEGRITY_HASH_MISMATCH");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture_path() -> std::path::PathBuf {
        let mut nonce = [0u8; 8];
        getrandom::getrandom(&mut nonce).unwrap();
        std::env::temp_dir().join(format!(
            "lazyprompting-gateway-integrity-{}-{:x}",
            std::process::id(),
            u64::from_le_bytes(nonce)
        ))
    }

    #[test]
    fn streamed_binary_digest_matches_exact_sha256_for_empty_and_multichunk_files() {
        let path = fixture_path();
        let data: Vec<u8> = (0..(128 * 1024 + 17)).map(|n| (n % 251) as u8).collect();
        fs::write(&path, &data).unwrap();
        assert_eq!(
            digest(&path).unwrap(),
            format!("{:x}", Sha256::digest(&data))
        );
        fs::write(&path, b"").unwrap();
        assert_eq!(digest(&path).unwrap(), format!("{:x}", Sha256::digest(b"")));
        fs::remove_file(&path).unwrap();
        assert_eq!(digest(&path), Err("GATEWAY_INTEGRITY_READ_FAILED"));
    }

    #[test]
    fn manifest_admission_reads_at_most_limit_plus_one_byte() {
        let path = fixture_path();
        fs::write(&path, vec![b'x'; MAX_MANIFEST_BYTES as usize]).unwrap();
        assert_eq!(
            read_manifest(&path).unwrap().len(),
            MAX_MANIFEST_BYTES as usize
        );
        fs::write(&path, vec![b'x'; MAX_MANIFEST_BYTES as usize + 1]).unwrap();
        assert_eq!(
            read_manifest(&path),
            Err("GATEWAY_INTEGRITY_MANIFEST_TOO_LARGE")
        );
        fs::remove_file(&path).unwrap();
        assert_eq!(
            read_manifest(&path),
            Err("GATEWAY_INTEGRITY_MANIFEST_MISSING")
        );
    }
}
