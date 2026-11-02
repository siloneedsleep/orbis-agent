use serde_json::{json, Value};

pub async fn request(
    config: &Value,
    system: &str,
    prompt: &str,
    schema: &Value,
    image: Option<String>,
) -> Result<Value, String> {
    let provider = config["provider"].as_str().ok_or("Thiếu provider")?;
    let key = config["apiKey"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("Chưa cấu hình API key")?;
    let model = config["cloudModel"]
        .as_str()
        .or(config["model"].as_str())
        .filter(|m| !m.is_empty() && *m != "auto")
        .ok_or("Hãy chọn model cloud trong Cài đặt")?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let (request, body) = match provider {
        "openai" | "deepseek" => {
            let mut content = vec![json!({"type":"text","text":prompt})];
            if provider == "openai" {
                if let Some(image) = image {
                    content.push(json!({"type":"image_url","image_url":{"url":format!("data:image/jpeg;base64,{image}")}}));
                }
            }
            let mut body = json!({"model":model,"messages":[{"role":"system","content":system},{"role":"user","content":content}]});
            if provider == "openai" {
                body["response_format"] = json!({"type":"json_schema","json_schema":{"name":"orbis_response","strict":true,"schema":schema}});
            } else {
                body["tools"] = json!([{"type":"function","function":{"name":"orbis_response","description":"Return the structured result","parameters":schema}}]);
                body["tool_choice"] =
                    json!({"type":"function","function":{"name":"orbis_response"}});
            }
            let url = if provider == "openai" {
                "https://api.openai.com/v1/chat/completions"
            } else {
                "https://api.deepseek.com/chat/completions"
            };
            (client.post(url).bearer_auth(key), body)
        }
        "gemini" => {
            let mut parts = vec![json!({"text":prompt})];
            if let Some(image) = image {
                parts.push(json!({"inlineData":{"mimeType":"image/jpeg","data":image}}));
            }
            (client.post(format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",model.trim_start_matches("models/"))).header("x-goog-api-key",key),
            json!({"systemInstruction":{"parts":[{"text":system}]},"contents":[{"role":"user","parts":parts}],"generationConfig":{"responseMimeType":"application/json","responseJsonSchema":schema,"temperature":0}}))
        }
        "claude" => {
            let mut content = vec![json!({"type":"text","text":prompt})];
            if let Some(image) = image {
                content.push(json!({"type":"image","source":{"type":"base64","media_type":"image/jpeg","data":image}}));
            }
            (
                client
                    .post("https://api.anthropic.com/v1/messages")
                    .header("x-api-key", key)
                    .header("anthropic-version", "2023-06-01"),
                json!({"model":model,"system":system,"max_tokens":4096,"messages":[{"role":"user","content":content}],"tools":[{"name":"orbis_response","description":"Return the structured result","input_schema":schema}],"tool_choice":{"type":"tool","name":"orbis_response"}}),
            )
        }
        _ => return Err("Provider không được hỗ trợ".into()),
    };
    let value = super::read_response(
        request
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?,
    )
    .await?;
    if provider == "claude" {
        return value["content"]
            .as_array()
            .and_then(|v| {
                v.iter()
                    .find(|v| v["type"] == "tool_use" && v["name"] == "orbis_response")
            })
            .map(|v| v["input"].clone())
            .ok_or("Claude không trả tool output")
            .map_err(str::to_owned);
    }
    let content = match provider {
        "gemini" => value["candidates"][0]["content"]["parts"]
            .as_array()
            .and_then(|p| p.iter().find_map(|p| p["text"].as_str())),
        "deepseek" => {
            value["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"].as_str()
        }
        _ => value["choices"][0]["message"]["content"].as_str(),
    }
    .ok_or("Model từ chối hoặc không trả structured output")?;
    serde_json::from_str(content).map_err(|e| format!("Cloud không tuân thủ schema: {e}"))
}
