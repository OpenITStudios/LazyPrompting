use serde_json::{json, Value};

// Installed Rust MCP discovery metadata; neither an approval nor a dispatch.
pub(crate) const CAPABILITIES: [(&str, &str); 25] = [
    ("code_mode.catalog", "Discover the bounded read-only Code Mode SDK and available tools"),
    ("code_mode.execute", "Compose bounded reads and, with native owner lease, stage one operator-reviewed manual draft; no ChatGPT send"),
    ("goal_run.start", "Review and persist a goal run scope in the Windows host"),
    ("goal_run.turn_receipt", "Read an approved Codex goal turn's correlated durable receipt (no QA or dispatch authority)"),
    ("goal_run.status", "Read the current status of a goal run"),
    ("goal_run.report", "Read the verified results of a goal run"),
    ("goal_run.control", "Control a goal run"),
    ("agent_run.prepare", "Ask the native operator to approve one provider-specific read-only v2 scope; does not dispatch"),
    ("agent_run.status", "Read the native v2 scope and approval state, not worker execution results"),
    ("agent_run.review_execution", "Record separate operator intent for future read-only execution; does not launch a worker"),
    ("agent_run.stop", "Permanently STOP a prepared v2 goal before provider dispatch"),
    ("workspace_goal.prepare", "Ask the native operator to approve a bounded ChatGPT goal contract; persist PAUSED / UNBOUND only, no dispatch"),
    ("workspace_goal.status", "Read the native-owned approved ChatGPT goal checkpoint for one leased workspace; never verify ChatGPT delivery"),
    (
        "workspace_browser.open",
        "Open the protected ChatGPT workspace; an external HTTP(S) address is offered to the operator for a supporting tab (not automatically loaded)",
    ),
    (
        "workspace_browser.navigate",
        "Navigate the operator-selected supporting browser tab; cannot navigate the protected ChatGPT main tab",
    ),
    (
        "workspace_browser.location",
        "Read the address of the native selected browser tab (query and fragment omitted)",
    ),
    ("workspace_browser.back", "Go back in the selected supporting tab; MCP cannot change ChatGPT main navigation"),
    (
        "workspace_browser.forward",
        "Go forward in the selected supporting tab; MCP cannot change ChatGPT main navigation",
    ),
    ("workspace_browser.reload", "Reload the selected supporting tab; MCP cannot reload ChatGPT main"),
    ("workspace_browser.release", "Release this MCP client's ownership of one workspace without closing its tab"),
    ("workspace_browser.observe", "Read one manually approved, token-bounded compact or delta accessibility snapshot from an active HTTPS supporting tab; never ChatGPT main"),
    ("workspace_chat.prepare_handoff", "Prepare an operator-reviewed ordinary ChatGPT prompt; manual copy only, no send or reply access"),
    ("workspace_chat.rollover_status", "Read operator-reported chat-length estimate and full-chat hold for one native workspace; no transcript or send grant"),
    ("workspace_chat.fixture_send", "Debug-only Send to owned localhost synthetic chat (not ChatGPT)"),
    ("workspace_chat.fixture_status", "Read debug-only synthetic chat observation; not a verified reply"),
];

// Native catalog is the owner of effects for the installed MCP. Only
// metadata is exposed to the confined Code Mode; no grant or raw arguments.
fn code_mode_native_policy(name: &str) -> (&'static str, &'static str, Option<&'static str>) {
    match name {
        "code_mode.catalog" => ("READ", "HOST_CATALOG_ONLY", None),
        "code_mode.execute" => ("COMPOSITION_OR_HOST_DRAFT", "NATIVE_EFFECT_BROKER", None),
        "goal_run.status" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.status")),
        "goal_run.report" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.report")),
        "goal_run.turn_receipt" => ("READ", "OWNED_APPROVED_GOAL", Some("goal.receipt")),
        "goal_run.start" => ("DISPATCH", "NATIVE_GOAL_SCOPE_APPROVAL", None),
        "goal_run.control" => ("CONTROL", "NATIVE_GOAL_STOP_PAUSE_RESUME", None),
        "agent_run.status" => ("READ", "OWNED_AGENT_SCOPE", Some("agent.status")),
        "agent_run.prepare" => ("APPROVAL", "NATIVE_V2_SOURCE_REVIEW", None),
        "agent_run.review_execution" => ("APPROVAL", "NATIVE_V2_EXECUTION_REVIEW", None),
        "agent_run.stop" => ("CONTROL", "NATIVE_STOP", None),
        "workspace_goal.prepare" => ("APPROVAL", "NATIVE_GOAL_OPERATOR_REVIEW", None),
        "workspace_goal.status" => ("READ", "OWNED_WORKSPACE", Some("workspace_goal.status")),
        "workspace_browser.location" => ("READ", "OWNED_WORKSPACE", Some("workspace.location")),
        "workspace_browser.observe" => ("SENSITIVE_READ", "NATIVE_ONE_SHOT_OPERATOR_GRANT", None),
        "workspace_browser.open"
        | "workspace_browser.navigate"
        | "workspace_browser.back"
        | "workspace_browser.forward"
        | "workspace_browser.reload" => ("NAVIGATION", "OWNED_SUPPORTING_TAB", None),
        "workspace_browser.release" => ("CONTROL", "OWNED_WORKSPACE", None),
        "workspace_chat.prepare_handoff" => {
            ("DRAFT", "OWNED_MANUAL_HANDOFF", Some("handoff.prepare"))
        }
        "workspace_chat.rollover_status" => ("READ", "OWNED_WORKSPACE", None),
        "workspace_chat.fixture_send" => ("DEBUG", "NATIVE_DEBUG_TEST_ONLY", None),
        "workspace_chat.fixture_status" => ("DEBUG", "NATIVE_DEBUG_TEST_ONLY", None),
        _ => ("UNCLASSIFIED", "DENY", None),
    }
}
pub(crate) fn code_mode_native_catalog() -> Value {
    let items: Vec<Value> = CAPABILITIES
        .iter()
        .map(|(name, description)| {
            let (effect, permission, alias) = code_mode_native_policy(name);
            json!({"name":name,"description":description,"effect":effect,
               "permission":permission,"codeModeAlias":alias,
               "invocableFromCode":false})
        })
        .collect();
    json!({"source":"NATIVE_MCP_CATALOG","capabilities":items})
}

// Preserve existing all-term discovery semantics and catalog order.
pub(crate) fn search_capabilities(query: &str) -> Vec<Value> {
    let query = query.to_lowercase();
    let terms: Vec<&str> = query.split_whitespace().collect();
    CAPABILITIES
        .iter()
        .filter(|(name, description)| {
            // Avoid allocating lowercase descriptions for all-name matches.
            if terms.iter().all(|term| name.contains(*term)) {
                return true;
            }
            let lowercase = description.to_lowercase();
            terms
                .iter()
                .all(|term| name.contains(*term) || lowercase.contains(*term))
        })
        .map(|(name, description)| json!({"name":name,"description":description}))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_is_unique_classified_and_never_code_invocable() {
        use std::collections::HashSet;
        assert_eq!(CAPABILITIES.len(), 25);
        let mut names = HashSet::new();
        for (name, _) in CAPABILITIES {
            assert!(names.insert(name), "duplicate capability: {name}");
            let (effect, permission, _) = code_mode_native_policy(name);
            assert_ne!(effect, "UNCLASSIFIED");
            assert_ne!(permission, "DENY");
        }
        let catalog = code_mode_native_catalog();
        let items = catalog["capabilities"].as_array().unwrap();
        assert_eq!(items.len(), CAPABILITIES.len());
        assert!(items.iter().all(|item| item["invocableFromCode"] == false));
    }

    #[test]
    fn discovery_keeps_case_empty_query_and_source_order() {
        assert_eq!(search_capabilities("").len(), CAPABILITIES.len());
        assert_eq!(search_capabilities("  ").len(), CAPABILITIES.len());
        assert!(search_capabilities("absent-capability-name").is_empty());
        let matches = search_capabilities("CODE_MODE");
        let names: Vec<_> = matches
            .iter()
            .map(|item| item["name"].as_str().unwrap())
            .collect();
        assert_eq!(names, vec!["code_mode.catalog", "code_mode.execute"]);
        assert_eq!(search_capabilities("code_mode"), matches);
    }
}
