use serde::Serialize;
use std::sync::Mutex;

const MAX_WORKSPACES: usize = 10;
const MAX_ACTIVE_PREVIEWS: usize = 2;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub workspace_id: String,
    pub state: &'static str,
}

#[derive(Default)]
pub struct InstanceRegistry {
    entries: Mutex<Vec<Instance>>,
}

impl InstanceRegistry {
    pub fn list(&self) -> Result<Vec<Instance>, String> {
        self.entries.lock().map(|entries| entries.clone()).map_err(|_| "REGISTRY_UNAVAILABLE".into())
    }
    pub fn register(&self, id: &str) -> Result<Instance, String> {
        if id.is_empty() || id.len() > 128 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b':')) {
            return Err("INVALID_WORKSPACE_ID".into());
        }
        let mut entries = self.entries.lock().map_err(|_| "REGISTRY_UNAVAILABLE")?;
        if entries.iter().any(|entry| entry.workspace_id == id) { return Err("WORKSPACE_EXISTS".into()); }
        if entries.len() >= MAX_WORKSPACES { return Err("WORKSPACE_CAPACITY".into()); }
        let instance = Instance { workspace_id: id.to_owned(), state: "UNBOUND" };
        entries.push(instance.clone());
        Ok(instance)
    }
    pub fn unregister(&self, id: &str) -> Result<(), String> {
        let mut entries = self.entries.lock().map_err(|_| "REGISTRY_UNAVAILABLE")?;
        let index = entries.iter().position(|entry| entry.workspace_id == id).ok_or("WORKSPACE_NOT_FOUND")?;
        if entries[index].state != "UNBOUND" { return Err("WORKSPACE_ACTIVE".into()); }
        entries.remove(index);
        Ok(())
    }
    pub fn active_preview_capacity(&self) -> usize { MAX_ACTIVE_PREVIEWS }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn workspace_registry_is_bounded() {
        let registry = InstanceRegistry::default();
        for i in 0..10 { assert!(registry.register(&format!("chat-{i}")).is_ok()); }
        assert!(registry.register("chat-10").is_err());
        assert!(registry.register("chat-0").is_err());
        assert_eq!(registry.active_preview_capacity(), 2);
    }
}
