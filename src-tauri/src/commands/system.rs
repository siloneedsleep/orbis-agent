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
