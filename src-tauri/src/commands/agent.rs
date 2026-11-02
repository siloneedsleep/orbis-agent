use crate::agent::{Engine, TaskRequest};
use serde_json::Value;

#[tauri::command]
pub fn subscribe_agent(
    window: tauri::WebviewWindow,
    engine: tauri::State<'_, Engine>,
    channel: tauri::ipc::Channel<Value>,
) -> Result<(), String> {
    engine.subscribe(window.label().into(), channel)
}
#[tauri::command]
pub async fn put_setting(
    engine: tauri::State<'_, Engine>,
    key: String,
    value: Option<String>,
) -> Result<(), String> {
    engine.put_setting(key, value)?;
    let snapshot = engine.0.state.lock().unwrap().snapshot.clone();
    engine.0.memory.flush(snapshot).await
}
#[tauri::command]
pub async fn start_agent(
    app: tauri::AppHandle,
    engine: tauri::State<'_, Engine>,
    request: TaskRequest,
) -> Result<String, String> {
    engine.start(app, request)
}
#[tauri::command]
pub fn stop_agent(engine: tauri::State<'_, Engine>) {
    engine.stop();
}
#[tauri::command]
pub fn approve_action(
    engine: tauri::State<'_, Engine>,
    id: String,
    approved: bool,
) -> Result<(), String> {
    engine.approve(&id, approved)
}
#[tauri::command]
pub fn clear_workstream(engine: tauri::State<'_, Engine>) -> Result<(), String> {
    if engine.0.active.lock().unwrap().is_some() {
        return Err("Hãy dừng tác vụ trước khi xóa lịch sử".into());
    }
    engine.update(serde_json::json!({"workstream":[],"lastFrame":null,"elements":[],"dag":[]}));
    // Persist through the normal memory path.
    engine.put_setting("orbis_history_cleared".into(), Some("true".into()))
}
#[tauri::command]
pub async fn mcp_list(engine: tauri::State<'_, Engine>, config: Value) -> Result<Value, String> {
    tokio::time::timeout(
        std::time::Duration::from_secs(30),
        engine.0.mcp.list(&config),
    )
    .await
    .map_err(|_| "MCP connection timed out".to_owned())?
}
#[tauri::command]
pub async fn mcp_execute(
    engine: tauri::State<'_, Engine>,
    config: Value,
    tool: String,
    arguments: Value,
) -> Result<Value, String> {
    tokio::time::timeout(
        std::time::Duration::from_secs(60),
        engine.0.mcp.call(&config, tool, arguments),
    )
    .await
    .map_err(|_| "MCP tool timed out".to_owned())?
}

#[tauri::command]
pub fn import_legacy_settings(
    engine: tauri::State<'_, Engine>,
    values: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let mut state = engine.0.state.lock().unwrap();
    if state.snapshot["settings"]["orbis_migrated_v1"].is_string() {
        return Ok(());
    }
    for (key, value) in values {
        if key.starts_with("orbis_")
            && key.len() <= 100
            && value.len() <= 1024 * 1024
            && state.snapshot["settings"][&key].is_null()
        {
            state.snapshot["settings"][&key] = serde_json::json!(value);
            Engine::broadcast(
                &mut state,
                serde_json::json!({"type":"setting","key":key,"value":value}),
            );
        }
    }
    state.snapshot["settings"]["orbis_migrated_v1"] = serde_json::json!("true");
    Engine::broadcast(
        &mut state,
        serde_json::json!({"type":"setting","key":"orbis_migrated_v1","value":"true"}),
    );
    engine.0.memory.save(&state.snapshot);
    Ok(())
}
