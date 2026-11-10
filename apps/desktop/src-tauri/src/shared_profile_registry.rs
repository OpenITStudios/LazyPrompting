use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Mutex;

// Logical view identity only. One browser-owned profile, never per-chat credentials.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewBinding {
    pub workspace_id: String,
    pub conversation_id: String,
    pub selected: bool,
    pub pending: bool,
}

#[derive(Default)]
struct State {
    views: BTreeMap<String, ViewBinding>,
    selected: Option<String>,
}

#[derive(Default)]
pub struct SharedProfileRegistry {
    state: Mutex<State>,
}

impl SharedProfileRegistry {
    pub fn snapshot(&self) -> Result<Vec<ViewBinding>, String> {
        self.state
            .lock()
            .map(|s| s.views.values().cloned().collect())
            .map_err(|_| "REGISTRY_UNAVAILABLE".into())
    }
    pub fn bind(&self, workspace_id: &str, conversation_id: &str) -> Result<(), String> {
        if !valid_workspace(workspace_id) || !valid(conversation_id) {
            return Err("INVALID_BINDING".into());
        }
        let mut s = self.state.lock().map_err(|_| "REGISTRY_UNAVAILABLE")?;
        if !s.views.contains_key(workspace_id) && s.views.len() >= 10 {
            return Err("WORKSPACE_CAPACITY".into());
        }
        if s.views
            .iter()
            .any(|(w, v)| w != workspace_id && v.conversation_id == conversation_id)
        {
            return Err("CONVERSATION_ALREADY_BOUND".into());
        }
        if s.views
            .get(workspace_id)
            .is_some_and(|v| v.pending && v.conversation_id != conversation_id)
        {
            return Err("PENDING_WORKSPACE_CANNOT_REBIND".into());
        }
        let selected = s.selected.as_deref() == Some(workspace_id);
        let pending = s.views.get(workspace_id).is_some_and(|v| v.pending);
        s.views.insert(
            workspace_id.into(),
            ViewBinding {
                workspace_id: workspace_id.into(),
                conversation_id: conversation_id.into(),
                selected,
                pending,
            },
        );
        Ok(())
    }
    pub fn select(&self, workspace_id: &str) -> Result<(), String> {
        if !valid_workspace(workspace_id) {
            return Err("INVALID_WORKSPACE".into());
        }
        let mut s = self.state.lock().map_err(|_| "REGISTRY_UNAVAILABLE")?;
        if !s.views.contains_key(workspace_id) {
            return Err("WORKSPACE_NOT_BOUND".into());
        }
        s.selected = Some(workspace_id.into());
        for (id, v) in &mut s.views {
            v.selected = id == workspace_id;
        }
        Ok(())
    }
    pub fn unbind(&self, workspace_id: &str) -> Result<(), String> {
        if !valid_workspace(workspace_id) {
            return Err("INVALID_WORKSPACE".into());
        }
        let mut s = self.state.lock().map_err(|_| "REGISTRY_UNAVAILABLE")?;
        let v = s.views.get(workspace_id).ok_or("WORKSPACE_NOT_BOUND")?;
        if v.pending {
            return Err("PENDING_WORKSPACE_REQUIRES_RECONCILIATION".into());
        }
        s.views.remove(workspace_id);
        if s.selected.as_deref() == Some(workspace_id) {
            s.selected = None;
        }
        Ok(())
    }
}
fn valid_workspace(s: &str) -> bool {
    matches!(
        s,
        "workspace-01"
            | "workspace-02"
            | "workspace-03"
            | "workspace-04"
            | "workspace-05"
            | "workspace-06"
            | "workspace-07"
            | "workspace-08"
            | "workspace-09"
            | "workspace-10"
    )
}
fn valid(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b':' | b'-' | b'_'))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_profile_keeps_distinct_conversations() {
        let r = SharedProfileRegistry::default();
        r.bind("workspace-01", "c1").unwrap();
        r.bind("workspace-02", "c2").unwrap();
        assert!(r.bind("workspace-03", "c1").is_err());
        r.select("workspace-02").unwrap();
        assert_eq!(
            r.snapshot().unwrap().iter().filter(|x| x.selected).count(),
            1
        );
        r.unbind("workspace-01").unwrap();
    }
}
