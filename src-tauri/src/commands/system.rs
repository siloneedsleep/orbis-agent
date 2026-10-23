use serde::Serialize;
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

