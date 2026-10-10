use serde::Serialize;
use tauri::AppHandle;
use crate::{os, shell};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub is_admin: bool,
    pub idle_ms: u64,
    pub windows_build: u32,
    pub platform: String,
}

#[tauri::command]
pub async fn get_system_info() -> SystemInfo {
    let build = os::winver::ensure_windows_11().unwrap_or(0);
    SystemInfo {
        is_admin: os::elevation::is_admin(),
        idle_ms: os::idle::idle_ms(),
        windows_build: build,
        platform: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
pub async fn open_dashboard(app: AppHandle) -> Result<(), String> {
    shell::dashboard::show(&app).map_err(|e| e.to_string())
}
