use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::{os, shell};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub is_admin: bool,
    pub idle_ms: u64,
}

#[tauri::command]
pub async fn get_system_info() -> SystemInfo {
    SystemInfo {
        is_admin: os::elevation::is_admin(),
        idle_ms: os::idle::idle_ms(),
    }
}

// async để tạo window không chạy trên main thread (tránh deadlock trên Windows).
#[tauri::command]
pub async fn open_dashboard(app: AppHandle) -> Result<(), String> {
    shell::dashboard::show(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_ollama_daemon() -> Result<String, String> {
    os::ollama::ensure_ollama_daemon().await?;
    Ok("Ollama daemon online".to_string())
}

#[tauri::command]
pub async fn call_local_llm(
    messages: Vec<os::ollama::ChatMsg>,
    model: Option<String>,
    max_power: Option<bool>,
) -> Result<os::ollama::ChatReply, String> {
    os::ollama::ollama_chat(messages, model, max_power).await
}

#[tauri::command]
pub async fn trigger_n8n_webhook(
    webhook_url: Option<String>,
    action: String,
    payload: Option<Value>,
    auth_token: Option<String>,
) -> Result<Value, String> {
    let url = webhook_url
        .filter(|u| !u.trim().is_empty())
        .unwrap_or_else(|| "https://siloneedsleep.app.n8n.cloud/webhook/orbis-bridge".to_string());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(&url);
    if let Some(token) = auth_token.filter(|t| !t.trim().is_empty()) {
        req = req.header("Authorization", format!("Bearer {}", token.trim()));
    }

    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let body = json!({
        "action": action,
        "payload": payload.unwrap_or_else(|| json!({})),
        "source": "orbis-desktop",
        "timestampMs": timestamp_ms
    });

    let resp = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối tới n8n Webhook ({}): {}", url, e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if status.is_success() {
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            Ok(v)
        } else {
            Ok(json!({ "raw": text }))
        }
    } else {
        Err(format!("n8n Webhook trả về lỗi (HTTP {}): {}", status, text))
    }
}

fn parse_mcp_response(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Phản hồi từ MCP Server rỗng".to_string());
    }

    // Nếu trả về theo giao thức Server-Sent Events (SSE)
    if trimmed.starts_with("event:") || trimmed.contains("data:") {
        for line in trimmed.lines() {
            let line_trimmed = line.trim();
            if let Some(data_str) = line_trimmed.strip_prefix("data:") {
                let data_str = data_str.trim();
                if !data_str.is_empty() {
                    if let Ok(v) = serde_json::from_str::<Value>(data_str) {
                        if let Some(err) = v.get("error") {
                            return Err(format!("Lỗi MCP: {}", err));
                        }
                        return Ok(v);
                    }
                }
            }
        }
    }

    // Nếu trả về JSON trực tiếp
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        if let Some(err) = v.get("error") {
            return Err(format!("Lỗi MCP: {}", err));
        }
        return Ok(v);
    }

    Err(format!("Không thể phân tích dữ liệu trả về từ MCP Server: {}", trimmed))
}

#[tauri::command]
pub async fn test_mcp_connection(
    server_url: String,
    auth_token: Option<String>,
    custom_headers: Option<Value>,
) -> Result<Value, String> {
    let url = server_url.trim();
    if url.is_empty() {
        return Err("URL của MCP Server không được để trống".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(url)
        .header("Accept", "application/json, text/event-stream")
        .header("Content-Type", "application/json");

    if let Some(token) = auth_token.filter(|t| !t.trim().is_empty()) {
        let auth_val = if token.starts_with("Bearer ") {
            token
        } else {
            format!("Bearer {}", token.trim())
        };
        req = req.header("Authorization", auth_val);
    }

    if let Some(Value::Object(map)) = custom_headers {
        for (k, v) in map {
            if let Some(s) = v.as_str() {
                req = req.header(k, s);
            }
        }
    }

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    });

    let start = std::time::Instant::now();
    let resp = req.json(&body).send().await
        .map_err(|e| format!("Không thể kết nối đến MCP Server ({}): {}", url, e))?;

    let latency_ms = start.elapsed().as_millis();
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("MCP Server trả về HTTP {}: {}", status, text));
    }

    let parsed = parse_mcp_response(&text)?;
    let tools = parsed.get("result")
        .and_then(|r| r.get("tools"))
        .cloned()
        .unwrap_or_else(|| json!([]));

    let count = tools.as_array().map(|a| a.len()).unwrap_or(0);

    Ok(json!({
        "success": true,
        "latencyMs": latency_ms,
        "tools": tools,
        "count": count
    }))
}

#[tauri::command]
pub async fn call_mcp_tool(
    server_url: String,
    tool_name: String,
    arguments: Option<Value>,
    auth_token: Option<String>,
) -> Result<Value, String> {
    let url = server_url.trim();
    if url.is_empty() {
        return Err("URL của MCP Server không được để trống".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(url)
        .header("Accept", "application/json, text/event-stream")
        .header("Content-Type", "application/json");

    if let Some(token) = auth_token.filter(|t| !t.trim().is_empty()) {
        let auth_val = if token.starts_with("Bearer ") {
            token
        } else {
            format!("Bearer {}", token.trim())
        };
        req = req.header("Authorization", auth_val);
    }

    let body = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments.unwrap_or_else(|| json!({}))
        }
    });

    let resp = req.json(&body).send().await
        .map_err(|e| format!("Không thể gọi tool MCP ({}): {}", tool_name, e))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("MCP Tool trả về HTTP {}: {}", status, text));
    }

    let parsed = parse_mcp_response(&text)?;
    let result = parsed.get("result").cloned().unwrap_or(parsed);

    Ok(result)
}

#[tauri::command]
pub async fn read_system_mcp_config() -> Result<Value, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Không xác định được thư mục người dùng".to_string())?;

    let config_path = std::path::Path::new(&home)
        .join(".gemini")
        .join("config")
        .join("mcp_config.json");

    if !config_path.exists() {
        return Ok(json!({
            "exists": false,
            "path": config_path.to_string_lossy(),
            "servers": []
        }));
    }

    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Lỗi đọc file mcp_config.json: {}", e))?;

    let parsed: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Lỗi cú pháp JSON trong mcp_config.json: {}", e))?;

    let mut servers = Vec::new();
    if let Some(mcp_servers) = parsed.get("mcpServers").and_then(|s| s.as_object()) {
        for (name, cfg) in mcp_servers {
            let server_url = cfg.get("serverUrl").and_then(|u| u.as_str()).unwrap_or("").to_string();
            let auth_header = cfg.get("headers")
                .and_then(|h| h.get("Authorization"))
                .and_then(|a| a.as_str())
                .unwrap_or("")
                .replace("Bearer ", "")
                .trim()
                .to_string();

            let command = cfg.get("command").and_then(|c| c.as_str()).unwrap_or("").to_string();

            servers.push(json!({
                "id": format!("mcp-{}", name.to_lowercase()),
                "name": name,
                "serverUrl": server_url,
                "authToken": auth_header,
                "command": command,
                "type": if !server_url.is_empty() { "http" } else { "stdio" },
                "enabled": true
            }));
        }
    }

    Ok(json!({
        "exists": true,
        "path": config_path.to_string_lossy(),
        "servers": servers
    }))
}
