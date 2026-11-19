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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
