use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Done {
        message: String,
    },
    ClickElement {
        #[serde(rename = "targetId")]
        target_id: u32,
        button: String,
    },
    TypeIntoElement {
        #[serde(rename = "targetId")]
        target_id: u32,
        text: String,
    },
    MouseMove {
        x: i32,
        y: i32,
    },
    MouseClick {
        x: i32,
        y: i32,
        button: String,
    },
    KeyboardType {
        text: String,
    },
    SandboxExec {
        command: String,
    },
    McpCall {
        server: String,
        tool: String,
        arguments: Value,
    },
    N8nExecute {
        workflow: String,
        payload: Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AgentStep {
    pub summary: String,
    pub action: Action,
}

pub fn step_schema() -> Value {
    let variants = vec![
        ("done", json!({"message":{"type":"string"}})),
        (
            "click_element",
            json!({"targetId":{"type":"integer","minimum":1},"button":{"type":"string","enum":["left","right","middle","double"]}}),
        ),
        (
            "type_into_element",
            json!({"targetId":{"type":"integer","minimum":1},"text":{"type":"string"}}),
        ),
        (
            "mouse_move",
            json!({"x":{"type":"integer"},"y":{"type":"integer"}}),
        ),
        (
            "mouse_click",
            json!({"x":{"type":"integer"},"y":{"type":"integer"},"button":{"type":"string","enum":["left","right","middle","double"]}}),
        ),
        ("keyboard_type", json!({"text":{"type":"string"}})),
        ("sandbox_exec", json!({"command":{"type":"string"}})),
        (
            "mcp_call",
            json!({"server":{"type":"string"},"tool":{"type":"string"},"arguments":{"type":"string","description":"JSON object encoded as a string"}}),
        ),
        (
            "n8n_execute",
            json!({"workflow":{"type":"string"},"payload":{"type":"string","description":"JSON object encoded as a string"}}),
        ),
    ];
    let actions: Vec<Value> = variants.into_iter().map(|(kind, mut props)| {
        props["type"] = json!({"type":"string","enum":[kind]});
        let required: Vec<_> = props.as_object().unwrap().keys().cloned().collect();
        json!({"type":"object","properties":props,"required":required,"additionalProperties":false})
    }).collect();
    json!({"type":"object","properties":{"summary":{"type":"string","description":"Brief user-facing progress summary, no private reasoning"},"action":{"anyOf":actions}},"required":["summary","action"],"additionalProperties":false})
}

pub fn parse_step(mut value: Value) -> Result<AgentStep, String> {
    for key in ["arguments", "payload"] {
        if let Some(text) = value["action"][key].as_str().map(str::to_owned) {
            let parsed: Value = serde_json::from_str(&text).map_err(|e| format!("{key}: {e}"))?;
            if !parsed.is_object() {
                return Err(format!("{key} phải là JSON object"));
            }
            value["action"][key] = parsed;
        }
    }
    serde_json::from_value(value).map_err(|e| format!("Đầu ra agent không hợp lệ: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn malformed_actions_never_turn_into_success() {
        assert!(parse_step(json!({"summary":"ok","action":{"type":"surprise"}})).is_err());
        assert!(parse_step(json!({"summary":"ok","action":{"type":"click_element"}})).is_err());
        assert!(parse_step(json!({"summary":"ok","action":{"type":"mcp_call","server":"s","tool":"t","arguments":"[]"}})).is_err());
    }
}
