use serde_json::Value;

// Consume an authenticated gateway response after the original request/IPC
// admission. Moving its owned object avoids a second JSON tree clone.
// This helper grants nothing and preserves prior error precedence and codes.
pub(crate) fn take_object_result(mut reply: Value, missing: &'static str) -> Result<Value, String> {
    if let Some(reason) = reply["error"]["message"].as_str() {
        return Err(reason.to_owned());
    }
    reply
        .as_object_mut()
        .and_then(|object| object.remove("result"))
        .filter(Value::is_object)
        .ok_or_else(|| missing.to_owned())
}

// Code Mode is a distinct private result contract: the upstream gateway
// returns status/structuredContent under "result", not an arbitrary object.
// Preserve its original failure classification while moving the owned result
// rather than cloning a potentially large structured payload.
pub(crate) fn take_code_mode_content(mut reply: Value) -> Result<Value, String> {
    let mut result = reply
        .as_object_mut()
        .and_then(|object| object.remove("result"))
        .ok_or("CODE_MODE_RESULT_MISSING")?;
    if result["status"] == "ERROR" {
        let reason = result["code"].as_str().unwrap_or("CODE_MODE_FAILED");
        return Err(if reason.starts_with("CODE_MODE_") && reason.len() <= 80 {
            reason.to_owned()
        } else {
            "CODE_MODE_FAILED".to_owned()
        });
    }
    if result["status"] != "OK" || !result["structuredContent"].is_object() {
        return Err("CODE_MODE_RESULT_INVALID".into());
    }
    result
        .as_object_mut()
        .and_then(|object| object.remove("structuredContent"))
        .ok_or_else(|| "CODE_MODE_RESULT_INVALID".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn code_mode_content_is_moved_without_promoting_an_error() {
        let payload = json!({"mode":"READ_ONLY","value":{"state":"STOPPED"},
            "nextPromptAllowed":false});
        let success = json!({"result":{"status":"OK",
            "structuredContent":payload.clone()}});
        assert_eq!(take_code_mode_content(success).unwrap(), payload);
        assert_eq!(take_code_mode_content(json!({})).unwrap_err(),
            "CODE_MODE_RESULT_MISSING");
        for invalid in [
            json!({"result":null}),
            json!({"result":{"status":"WAITING","structuredContent":{}}}),
            json!({"result":{"status":"OK","structuredContent":null}}),
            json!({"result":{"status":"OK","structuredContent":"raw model data"}}),
        ] {
            assert_eq!(take_code_mode_content(invalid).unwrap_err(),
                "CODE_MODE_RESULT_INVALID");
        }
        assert_eq!(take_code_mode_content(json!({"result":{
            "status":"ERROR","code":"CODE_MODE_EFFECT_RECONCILE_REQUIRED"}}))
            .unwrap_err(),"CODE_MODE_EFFECT_RECONCILE_REQUIRED");
        for code in ["SECRET_PROVIDER_ERROR", "CODE_MODE_"] {
            let value = json!({"result":{"status":"ERROR","code":code}});
            if code=="CODE_MODE_" {
                assert_eq!(take_code_mode_content(value).unwrap_err(),"CODE_MODE_");
            } else {
                assert_eq!(take_code_mode_content(value).unwrap_err(),"CODE_MODE_FAILED");
            }
        }
        let oversized_code = format!("CODE_MODE_{}", "X".repeat(80));
        assert_eq!(take_code_mode_content(json!({"result":{
            "status":"ERROR","code":oversized_code}}))
            .unwrap_err(),"CODE_MODE_FAILED");
    }

    #[test]
    fn move_result_preserves_nested_json_without_reinterpreting_payload() {
        let nested = json!({"status":"OK","objects":[{"n":1},{"n":2}],
            "qa":"NOT_EXECUTED","nextPromptAllowed":false});
        let result = take_object_result(
            json!({"jsonrpc":"2.0","id":7,"result":nested.clone()}),
            "RESULT_MISSING").unwrap();
        assert_eq!(result, nested);
    }

    #[test]
    fn error_precedes_result_and_missing_or_non_object_fails_closed() {
        let error = json!({"error":{"message":"NATIVE_DENIED"},"result":{"ok":true}});
        assert_eq!(take_object_result(error,"RESULT_MISSING").unwrap_err(), "NATIVE_DENIED");
        for reply in [json!({}),json!({"result":null}),
            json!({"result":[1]}),json!({"result":"ok"})] {
            assert_eq!(take_object_result(reply,"RESULT_MISSING").unwrap_err(),
                "RESULT_MISSING");
        }
        assert_eq!(take_object_result(json!({"result":{}}),"RESULT_MISSING").unwrap(),
            json!({}));
    }
}
