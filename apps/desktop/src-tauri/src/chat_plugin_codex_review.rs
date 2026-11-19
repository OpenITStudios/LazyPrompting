// Trusted native Rust-only receiver for an UNTRUSTED ChatGPT report.
// NO Tauri command, public MCP tool, worker dispatch, ledger, network IO
// or ChatGPT send is exposed. This prepares a review, never a grant.
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const BRIEF_LIMIT: usize = 16 * 1024;
const FINGERPRINT_DOMAIN: &[u8] =
    b"lazyprompting/chatgpt-to-codex/review-only/v1\n";
const INVALID: &str = "CHAT_PLUGIN_CODEX_BRIEF_INVALID";
const MISMATCH: &str = "CHAT_PLUGIN_CODEX_BRIEF_SCOPE_MISMATCH";

fn exact_keys(raw: &Value, keys: &[&str]) -> bool {
    raw.as_object().is_some_and(|fields| {
        fields.len() == keys.len() && keys.iter().all(|key| fields.contains_key(*key))
    })
}

fn hex_digest(value: &Value) -> bool {
    value.as_str().is_some_and(|text| {
        text.len() == 64
            && text.bytes().any(|byte| byte != b'0')
            && text
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    })
}

fn single_line(value: &Value, maximum_utf16: usize) -> bool {
    value.as_str().is_some_and(|text| {
        !text.trim().is_empty()
            && text.encode_utf16().count() <= maximum_utf16
            && !text.chars().any(|ch| {
                matches!(
                    ch,
                    '\u{0000}'..='\u{001f}'
                        | '\u{007f}'
                        | '\u{0085}'
                        | '\u{2028}'
                        | '\u{2029}'
                )
            })
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BriefScope<'a> {
    workspace_id: &'a str,
    goal_digest: &'a str,
    conversation_digest: &'a str,
    epoch: u64,
}

#[derive(Serialize)]
struct EvidenceRef<'a> {
    kind: &'a str,
    #[serde(rename = "ref")]
    reference: &'a str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BriefProposal<'a> {
    outcome: &'a str,
    summary: &'a str,
    next_action: Option<&'a str>,
    evidence_refs: Vec<EvidenceRef<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BriefCore<'a> {
    schema_version: u8,
    kind: &'static str,
    scope: BriefScope<'a>,
    proposal: BriefProposal<'a>,
}

// Serialize typed structs in the same explicit field order as the
// bridge's JSON.stringify(core). serde_json::Value object-key sorting
// alone would create a DIFFERENT hash and falsely reject all reports.
fn parse_core(raw: &Value) -> Result<BriefCore<'_>, String> {
    let scope = &raw["scope"];
    let proposal = &raw["proposal"];
    if !exact_keys(
        scope,
        &["workspaceId", "goalDigest", "conversationDigest", "epoch"],
    ) || !exact_keys(
        proposal,
        &["outcome", "summary", "nextAction", "evidenceRefs"],
    ) || !hex_digest(&scope["goalDigest"])
        || !hex_digest(&scope["conversationDigest"])
        || !single_line(&proposal["summary"], 600)
    {
        return Err(INVALID.into());
    }
    let workspace_id = scope["workspaceId"].as_str().ok_or(INVALID)?;
    if crate::embedded_webview::label_for(workspace_id).is_err() {
        return Err(INVALID.into());
    }
    let epoch = scope["epoch"].as_u64().filter(|value| {
        *value > 0 && *value <= 9_007_199_254_740_991
    }).ok_or(INVALID)?;
    let outcome = proposal["outcome"].as_str().ok_or(INVALID)?;
    if !matches!(outcome, "CONTINUE" | "DONE_PROPOSED" | "BLOCKED" | "NEEDS_REVIEW") {
        return Err(INVALID.into());
    }
    let next_action = if proposal["nextAction"].is_null() {
        None
    } else if outcome == "CONTINUE" && single_line(&proposal["nextAction"], 200) {
        Some(proposal["nextAction"].as_str().ok_or(INVALID)?)
    } else {
        return Err(INVALID.into());
    };
    let refs = proposal["evidenceRefs"].as_array().ok_or(INVALID)?;
    if refs.len() > 8 {
        return Err(INVALID.into());
    }
    let mut evidence_refs = Vec::with_capacity(refs.len());
    for entry in refs {
        if !exact_keys(entry, &["kind", "ref"]) ||
            !single_line(&entry["ref"], 200)
        {
            return Err(INVALID.into());
        }
        let kind = entry["kind"].as_str().ok_or(INVALID)?;
        if !matches!(kind, "COMMIT" | "QA_RECEIPT" | "ARTIFACT" | "DOCUMENT") {
            return Err(INVALID.into());
        }
        evidence_refs.push(EvidenceRef {
            kind,
            reference: entry["ref"].as_str().ok_or(INVALID)?,
        });
    }
    Ok(BriefCore {
        schema_version: 1,
        kind: "CHATGPT_CODEX_REVIEW_PROPOSAL",
        scope: BriefScope {
            workspace_id,
            goal_digest: scope["goalDigest"].as_str().ok_or(INVALID)?,
            conversation_digest: scope["conversationDigest"].as_str().ok_or(INVALID)?,
            epoch,
        },
        proposal: BriefProposal {
            outcome,
            summary: proposal["summary"].as_str().ok_or(INVALID)?,
            next_action,
            evidence_refs,
        },
    })
}

fn source_matches(run_id: &str, goal: &Value) -> bool {
    goal["source"] == "NATIVE_CODEX_V1_READ_ONLY_SCOPE"
        && goal["runId"].as_str() == Some(run_id)
        && goal["reviewState"] == "REVIEW_COMPLETE"
        && hex_digest(&goal["goalDigest"])
        && goal["baseSha"].as_str().is_some_and(|sha| {
            sha.len() == 40 && sha.bytes().all(|b| b.is_ascii_hexdigit())
        })
        && goal["operatorChatApproved"] == false
        && goal["pluginAuthorized"] == false
        && goal["qa"] == "NOT_VERIFIED"
        && goal["nextPromptAllowed"] == false
}

// This function is pure. Native goal/URL checks are done by the wrapper,
// not by model-supplied flags, strings or ChatGPT's transport metadata.
fn inspect_review(
    brief: &Value,
    workspace_id: &str,
    run_id: &str,
    native_goal: &Value,
    native_chat_digest: &str,
    expected_epoch: u64,
) -> Result<Value, String> {
    if !exact_keys(brief, &[
        "schemaVersion", "kind", "scope", "proposal", "source",
        "fingerprint", "evidenceVerified", "operatorReviewRequired",
        "codexDispatchAuthorized", "chatTurnVerified", "qa",
        "nextPromptAllowed",
    ]) || brief["schemaVersion"] != 1
        || brief["kind"] != "CHATGPT_CODEX_REVIEW_PROPOSAL"
        || brief["source"] != "UNTRUSTED_CHATGPT_TOOL_DATA"
        || brief["evidenceVerified"] != false
        || brief["operatorReviewRequired"] != true
        || brief["codexDispatchAuthorized"] != false
        || brief["chatTurnVerified"] != false
        || brief["qa"] != "NOT_VERIFIED"
        || brief["nextPromptAllowed"] != false
        || !hex_digest(&brief["fingerprint"])
        || serde_json::to_vec(brief).map_err(|_| INVALID)?.len() > BRIEF_LIMIT
    {
        return Err(INVALID.into());
    }
    if expected_epoch == 0 || expected_epoch > 9_007_199_254_740_991
        || !source_matches(run_id, native_goal)
        || !hex_digest(&json!(native_chat_digest))
    {
        return Err(MISMATCH.into());
    }
    let core = parse_core(brief)?;
    if core.scope.workspace_id != workspace_id
        || core.scope.goal_digest != native_goal["goalDigest"].as_str().ok_or(MISMATCH)?
        || core.scope.conversation_digest != native_chat_digest
        || core.scope.epoch != expected_epoch
    {
        return Err(MISMATCH.into());
    }
    let mut hasher = Sha256::new();
    hasher.update(FINGERPRINT_DOMAIN);
    hasher.update(serde_json::to_vec(&core).map_err(|_| INVALID)?);
    let fingerprint = format!("{:x}", hasher.finalize());
    if brief["fingerprint"].as_str() != Some(fingerprint.as_str()) {
        return Err("CHAT_PLUGIN_CODEX_BRIEF_FINGERPRINT_MISMATCH".into());
    }
    // All report text remains UNTRUSTED. This is an on-demand candidate
    // for later review, not a Codex worker task or a ChatGPT turn receipt.
    Ok(json!({
        "source":"NATIVE_CHAT_PLUGIN_CODEX_REVIEW",
        "status":"REVIEW_REQUIRED",
        "workspaceId":workspace_id,
        "runId":run_id,
        "fingerprint":fingerprint,
        "proposal":brief["proposal"],
        "proposalTrust":"UNTRUSTED_CHATGPT_TOOL_DATA",
        "nativeSourceMatched":true,
        "nativeChatUrlMatched":true,
        "chatSessionVerified":false,
        "reportReceiptVerified":false,
        "operatorChatApproved":false,
        "codexDispatchAuthorized":false,
        "workerExecuted":false,
        "evidenceVerified":false,
        "qa":"NOT_VERIFIED",
        "nextPromptAllowed":false
    }))
}

// No caller exists before a separately verified OAuth principal and hosting
// ChatGPT conversation correlation. Do not expose as a Tauri command or
// public MCP capability. A future *trusted native* caller must own epoch
// and also check receipt/STOP atomically before any effect.
#[allow(dead_code)]
pub(crate) fn inspect_chat_plugin_codex_review(
    app: &tauri::AppHandle,
    workspace_id: &str,
    run_id: &str,
    expected_epoch: u64,
    brief: &Value,
) -> Result<Value, String> {
    if run_id.len() != 69 {
        return Err("CHAT_PLUGIN_RUN_ID_INVALID".into());
    }
    crate::embedded_webview::label_for(workspace_id)?;
    let native_goal = crate::goal_runs::chat_plugin_source_preflight(app, run_id)?;
    let native_chat = crate::chat_bookmarks::plugin_chat_digest(app, workspace_id)?;
    inspect_review(brief, workspace_id, run_id, &native_goal, &native_chat, expected_epoch)
}

#[cfg(test)]
mod tests {
    use super::*;

    const RUN: &str =
        "12345678-1234-1234-1234-123456789abc.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const GOAL: &str =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const CHAT: &str =
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    fn native_goal() -> Value {
        json!({
            "source":"NATIVE_CODEX_V1_READ_ONLY_SCOPE",
            "runId":RUN,"reviewState":"REVIEW_COMPLETE",
            "goalDigest":GO,
            "baseSha":"a".repeat(40),
            "operatorChatApproved":false,
            "pluginAuthorized":false,"qa":"NOT_VERIFIED",
            "nextPromptAllowed":false
        })
    }

    fn brief() -> Value {
        let mut raw = json!({
            "schemaVersion":1,"kind":"CHATGPT_CODEX_REVIEW_PROPOSAL",
            "scope":{
                "workspaceId":"workspace-01","goalDigest":GO,
                "conversationDigest":CHAT,"epoch":1
            },
            "proposal":{
                "outcome":"CONTINUE","summary":"Review the current source",
                "nextAction":"Inspect the test result",
                "evidenceRefs":[{"kind":"COMMIT","ref":"a".repeat(40)}]
            },
            "source":"UNTRUSTED_CHATGPT_TOOL_DATA",
            "fingerprint":"a".repeat(64),
            "evidenceVerified":false,
            "operatorReviewRequired":true,
            "codexDispatchAuthorized":false,
            "chatTurnVerified":false,
            "qa":"NOT_VERIFIED","nextPromptAllowed":false
        });
        let core = parse_core(&raw).unwrap();
        let encoded = serde_json::to_string(&core).unwrap();
        assert!(encoded.starts_with(
            r#"{"schemaVersion":1,"kind":"CHATGPT_CODEX_REVIEW_PROPOSAL","scope":{"workspaceId":"workspace-01""#
        ));
        let mut hasher = Sha256::new();
        hasher.update(FINGERPRINT_DOMAIN);
        hasher.update(encoded.as_bytes());
        raw["fingerprint"] = json!(format!("{:x}", hasher.finalize()));
        raw
    }

    #[test]
    fn native_brief_correlates_read_only_without_claiming_dispatch_or_qa() {
        let raw = brief();
        let view = inspect_review(&raw, "workspace-01", RUN, &native_goal(), CHAT, 1).unwrap();
        assert_eq!(view["source"], "NATIVE_CHAT_PLUGIN_CODEX_REVIEW");
        assert_eq!(view["status"], "REVIEW_REQUIRED");
        assert_eq!(view["proposalTrust"], "UNTRUSTED_CHATGPT_TOOL_DATA");
        assert_eq!(view["proposal"]["nextAction"], "Inspect the test result");
        for field in [
            "chatSessionVerified", "reportReceiptVerified", "operatorChatApproved",
            "codexDispatchAuthorized", "workerExecuted",
            "evidenceVerified", "nextPromptAllowed",
        ] {
            assert_eq!(view[field], false);
        }
        assert_eq!(view["qa"], "NOT_VERIFIED");
        assert!(view.get("receipt").is_none());
        assert!(view.get("principalTag").is_none());
        assert!(view.get("accessToken").is_none());
    }

    #[test]
    fn native_brief_rejects_wrong_scope_stop_and_claims_of_authority() {
        let good = brief();
        let mut invalid = Vec::new();
        for (path, value) in [
            ("/scope/workspaceId", json!("workspace-02")),
            ("/scope/goalDigest", json!("c".repeat(64))),
            ("/scope/conversationDigest", json!("d".repeat(64))),
            ("/scope/epoch", json!(2)),
            ("/fingerprint", json!("b".repeat(64))),
            ("/source", json!("NATIVE_APPROVED")),
            ("/qa", json!("PASS")),
            ("/operatorReviewRequired", json!(false)),
            ("/codexDispatchAuthorized", json!(true)),
            ("/chatTurnVerified", json!(true)),
            ("/evidenceVerified", json!(true)),
            ("/nextPromptAllowed", json!(true)),
            ("/proposal/outcome", json!("DONE")),
            ("/proposal/summary", json!("includes\nnew line")),
            ("/proposal/nextAction", json!("execute\u{2028}without review")),
            ("/proposal/evidenceRefs", json!([{"kind":"COMMIT","ref":"a\n"}])),
        ] {
            let mut altered = good.clone();
            *altered.pointer_mut(path).unwrap() = value;
            invalid.push(altered);
        }
        let mut extra = good.clone();
        extra["receipt"] = json!("secret");
        invalid.push(extra);
        for item in invalid {
            assert!(inspect_review(&item, "workspace-01", RUN, &native_goal(), CHAT, 1).is_err());
        }
        for (source, state, approved) in [
            ("MODEL", "REVIEW_COMPLETE", false),
            ("NATIVE_CODEX_V1_READ_ONLY_SCOPE", "STOPPED", false),
            ("NATIVE_CODEX_V1_READ_ONLY_SCOPE", "REVIEW_COMPLETE", true),
        ] {
            let mut goal = native_goal();
            goal["source"] = json!(source);
            goal["reviewState"] = json!(state);
            goal["pluginAuthorized"] = json!(approved);
            assert!(inspect_review(&good, "workspace-01", RUN, &goal, CHAT, 1).is_err());
        }
        assert!(inspect_review(&good, "workspace-02", RUN, &native_goal(), CHAT, 1).is_err());
        assert!(inspect_review(&good, "workspace-01", RUN, &native_goal(), CHAT, 2).is_err());
        assert!(inspect_review(&good, "workspace-01", RUN, &native_goal(), "c", 1).is_err());
    }

    #[test]
    fn native_brief_refuses_unbounded_or_unknown_fields() {
        let good = brief();
        let mut oversized = good.clone();
        oversized["proposal"]["summary"] = json!("a".repeat(601));
        assert!(inspect_review(&oversized, "workspace-01", RUN, &native_goal(), CHAT, 1).is_err());
        let mut invalid_extra = good.clone();
        invalid_extra["proposal"]["runId"] = json!(RUN);
        assert!(inspect_review(&invalid_extra, "workspace-01", RUN, &native_goal(), CHAT, 1)
            .is_err());
        let mut invalid_scope = good.clone();
        invalid_scope["scope"]["approved"] = json!(true);
        assert!(inspect_review(&invalid_scope, "workspace-01", RUN, &native_goal(), CHAT, 1)
            .is_err());
        let mut wrong_code = good;
        wrong_code["proposal"]["nextAction"] = json!(["run code"]);
        assert!(inspect_review(&wrong_code, "workspace-01", RUN, &native_goal(), CHAT, 1)
            .is_err());
    }
}
