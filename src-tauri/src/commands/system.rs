use serde::Serialize;
use serde_json::{json, Value};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
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
pub async fn trigger_n8n_webhook(
    webhook_url: Option<String>,
    action: String,
    payload: Option<Value>,
    auth_token: Option<String>,
) -> Result<Value, String> {
    let url = webhook_url
        .filter(|u| !u.trim().is_empty())
        .ok_or_else(|| "Chưa cấu hình URL webhook n8n".to_owned())?;

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
        Err(format!(
            "n8n Webhook trả về lỗi (HTTP {}): {}",
            status, text
        ))
    }
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
            let server_url = cfg
                .get("serverUrl")
                .and_then(|u| u.as_str())
                .unwrap_or("")
                .to_string();
            let headers_obj = cfg.get("headers").and_then(|h| h.as_object());
            let auth_header = headers_obj
                .and_then(|h| h.get("Authorization").or_else(|| h.get("authorization")))
                .and_then(|a| a.as_str())
                .unwrap_or("")
                .replace("Bearer ", "")
                .trim()
                .to_string();

            let mut extra_headers = serde_json::Map::new();
            if let Some(h_map) = headers_obj {
                for (hk, hv) in h_map {
                    if !hk.eq_ignore_ascii_case("authorization") {
                        extra_headers.insert(hk.clone(), hv.clone());
                    }
                }
            }

            let command = cfg
                .get("command")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();

            servers.push(json!({
                "id": format!("mcp-{}", name.to_lowercase()),
                "name": name,
                "serverUrl": server_url,
                "authToken": auth_header,
                "headers": Value::Object(extra_headers),
                "command": command,
                "args": cfg.get("args").cloned().unwrap_or_else(|| json!([])),
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
