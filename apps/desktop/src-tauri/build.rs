use sha2::{Digest, Sha256};
use std::fs;
use std::io::ErrorKind;

fn main() {
    let manifest = "resources/gateway/manifest.json";
    println!("cargo:rerun-if-changed={manifest}");
    match fs::read(manifest) {
        Ok(bytes) => println!(
            "cargo:rustc-env=LAZY_GATEWAY_MANIFEST_SHA256={:x}",
            Sha256::digest(bytes)
        ),
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => panic!("Unable to read staged gateway manifest: {error}"),
    }
    tauri_build::build()
}
