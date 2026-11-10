// The trusted desktop build embeds the staged manifest digest.
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Manifest {
    node_sha256: String,
    files: BTreeMap<String, String>,
}
fn digest(path: &Path) -> Result<String, &'static str> {
    let data = fs::read(path).map_err(|_| "GATEWAY_INTEGRITY_READ_FAILED")?;
    Ok(format!("{:x}", Sha256::digest(data)))
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
    let raw = fs::read(canonical_root.join("manifest.json"))
        .map_err(|_| "GATEWAY_INTEGRITY_MANIFEST_MISSING")?;
    if raw.len() > 1024 * 1024 {
        return Err("GATEWAY_INTEGRITY_MANIFEST_TOO_LARGE");
    }
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
