pub mod dag_swarm;
pub mod memory;
pub mod react_loop;
pub mod router;
pub mod schema;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tauri::{ipc::Channel, Manager};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRequest {
    pub goal: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub route: Option<String>,
}
fn default_mode() -> String {
    "computer_use".into()
}

pub struct EngineData {
    pub snapshot: Value,
    pub subscribers: HashMap<String, Channel<Value>>,
}
pub struct EngineInner {
    pub state: Mutex<EngineData>,
    pub active: Mutex<Option<CancellationToken>>,
    approvals: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub(crate) memory: memory::Memory,
    pub desktop: tokio::sync::Mutex<()>,
    pub operator: tokio::sync::Mutex<()>,
    pub mcp: crate::llm::mcp_client::McpClient,
}
#[derive(Clone)]
pub struct Engine(pub Arc<EngineInner>);

impl Engine {
    pub fn new(path: std::path::PathBuf) -> Result<Self, String> {
        let memory = memory::Memory::open(path)?;
        let mut history = memory.initial["workstream"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        for item in &mut history {
            if item["actionData"]["status"] == "running"
                || item["actionData"]["status"] == "pending_approval"
            {
                item["actionData"]["status"] = json!("error");
                item["actionData"]["result"] = json!("Tác vụ bị gián đoạn khi ứng dụng đóng");
            }
            item.as_object_mut().map(|v| v.remove("screenshot"));
        }
        let snapshot = json!({"seq":0,"status":"idle","stage":null,"route":"reflex","message":"Sẵn sàng","taskId":null,"lastFrame":null,"elements":[],"dag":[],"settings":memory.initial["settings"].as_object().cloned().unwrap_or_default(),"workstream":history});
        Ok(Self(Arc::new(EngineInner {
            state: Mutex::new(EngineData {
                snapshot,
                subscribers: HashMap::new(),
            }),
            active: Mutex::new(None),
            approvals: Mutex::new(HashMap::new()),
            memory,
            desktop: tokio::sync::Mutex::new(()),
            operator: tokio::sync::Mutex::new(()),
            mcp: Default::default(),
        })))
    }
    pub(crate) fn broadcast(data: &mut EngineData, mut event: Value) {
        let seq = data.snapshot["seq"].as_u64().unwrap_or(0) + 1;
        data.snapshot["seq"] = json!(seq);
        event["seq"] = json!(seq);
        data.subscribers
            .retain(|_, channel| channel.send(event.clone()).is_ok());
    }
    pub fn subscribe(&self, label: String, channel: Channel<Value>) -> Result<(), String> {
        let mut state = self.0.state.lock().unwrap();
        channel
            .send(json!({"type":"snapshot","snapshot":state.snapshot}))
            .map_err(|e| e.to_string())?;
        state.subscribers.insert(label, channel);
        Ok(())
    }
    pub fn update(&self, delta: Value) {
        let mut state = self.0.state.lock().unwrap();
        for (key, value) in delta.as_object().unwrap() {
            state.snapshot[key] = value.clone();
        }
        Self::broadcast(&mut state, json!({"type":"state","delta":delta}));
    }
    pub fn item(&self, mut item: Value) -> String {
        let id = item["id"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        item["id"] = json!(id);
        if item["timestamp"].is_null() {
            item["timestamp"] = json!(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
                .to_string());
        }
        let mut state = self.0.state.lock().unwrap();
        let history = state.snapshot["workstream"].as_array_mut().unwrap();
        if let Some(old) = history.iter_mut().find(|i| i["id"] == id) {
            *old = item.clone();
        } else {
            history.push(item.clone());
        }
        if history.len() > 300 {
            history.drain(..history.len() - 300);
        }
        Self::broadcast(&mut state, json!({"type":"item","item":item}));
        self.0.memory.save(&state.snapshot);
        id
    }
    pub fn setting(&self, key: &str) -> Option<String> {
        self.0.state.lock().unwrap().snapshot["settings"][key]
            .as_str()
            .map(str::to_owned)
    }
    pub fn config(&self, key: &str) -> Value {
        self.setting(key)
            .and_then(|v| serde_json::from_str(&v).ok())
            .unwrap_or(Value::Null)
    }
    pub fn put_setting(&self, key: String, value: Option<String>) -> Result<(), String> {
        if !key.starts_with("orbis_")
            || key.len() > 100
            || value.as_ref().is_some_and(|v| v.len() > 1024 * 1024)
        {
            return Err("Cấu hình vượt giới hạn".into());
        }
        let mut state = self.0.state.lock().unwrap();
        if let Some(value) = &value {
            state.snapshot["settings"][&key] = json!(value);
        } else {
            state.snapshot["settings"]
                .as_object_mut()
                .unwrap()
                .remove(&key);
        }
        Self::broadcast(
            &mut state,
            json!({"type":"setting","key":key,"value":value}),
        );
        self.0.memory.save(&state.snapshot);
        Ok(())
    }
    pub fn stop(&self) {
        crate::os::input::abort();
        if let Some(cancel) = self.0.active.lock().unwrap().as_ref() {
            cancel.cancel();
        }
        self.0.approvals.lock().unwrap().clear();
    }
    pub fn approve(&self, id: &str, approved: bool) -> Result<(), String> {
        self.0
            .approvals
            .lock()
            .unwrap()
            .remove(id)
            .ok_or("Yêu cầu đã hết hạn")?
            .send(approved)
            .map_err(|_| "Tác vụ đã kết thúc".into())
    }
    pub fn start(&self, app: tauri::AppHandle, request: TaskRequest) -> Result<String, String> {
        if request.goal.trim().is_empty() || request.goal.len() > 32_000 {
            return Err("Yêu cầu rỗng hoặc quá dài".into());
        }
        if !["computer_use", "sandbox", "chat"].contains(&request.mode.as_str()) {
            return Err("Chế độ không hợp lệ".into());
        }
        let mut active = self.0.active.lock().unwrap();
        if active.is_some() {
            return Err("Orbis đang thực hiện một tác vụ".into());
        }
        let token = CancellationToken::new();
        *active = Some(token.clone());
        crate::os::input::reset_abort();
        if request.mode == "computer_use" {
            if let Some(window) = app.get_webview_window("dashboard") {
                let _ = window.hide();
            }
        }
        let id = Uuid::new_v4().to_string();
        let route = router::route(&request);
        self.update(json!({"taskId":id,"status":"thinking","stage":"planning","route":route,"message":"Đang xử lý yêu cầu","dag":[]}));
        self.item(json!({"type":"user","content":request.goal}));
        let engine = self.clone();
        tauri::async_runtime::spawn(async move {
            let result = if route == "dag" {
                dag_swarm::run(&engine, &app, request, &token).await
            } else {
                react_loop::run(&engine, &app, &request.goal, &request.mode, &token).await
            };
            engine.0.approvals.lock().unwrap().clear();
            let (status, message) = if token.is_cancelled() {
                ("stopped", "Đã dừng tác vụ".to_owned())
            } else {
                match result {
                    Ok(message) => ("done", message),
                    Err(error) => ("error", error),
                }
            };
            let unfinished = {
                let state = engine.0.state.lock().unwrap();
                state.snapshot["workstream"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|item| {
                        item["actionData"]["status"] == "running"
                            || item["actionData"]["status"] == "pending_approval"
                    })
                    .cloned()
                    .collect::<Vec<_>>()
            };
            for mut item in unfinished {
                item["actionData"]["status"] = json!("error");
                item["actionData"]["result"] = json!(message);
                engine.item(item);
            }
            engine.item(json!({"type":"assistant","content":message}));
            // Holding active until the final event prevents overlapping runs.
            let snapshot = engine.0.state.lock().unwrap().snapshot.clone();
            if let Err(error) = engine.0.memory.flush(snapshot).await {
                engine.update(json!({"bridgeError":error}));
            }
            let mut active = engine.0.active.lock().unwrap();
            engine.update(json!({"status":status,"stage":null,"message":message}));
            *active = None;
            let hit = app.state::<crate::os::hit_test::HitTestState>();
            hit.suspended
                .store(false, std::sync::atomic::Ordering::SeqCst);
        });
        Ok(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::ipc::InvokeResponseBody;
    #[test]
    fn both_windows_receive_ordered_deltas_and_reopen_receives_history() {
        let directory = tempfile::tempdir().unwrap();
        let engine = Engine::new(directory.path().join("memory.json")).unwrap();
        fn channel() -> (Channel<Value>, Arc<Mutex<Vec<Value>>>) {
            let events = Arc::new(Mutex::new(Vec::new()));
            let captured = events.clone();
            (
                Channel::new(move |body| {
                    if let InvokeResponseBody::Json(body) = body {
                        captured
                            .lock()
                            .unwrap()
                            .push(serde_json::from_str(&body).unwrap());
                    }
                    Ok(())
                }),
                events,
            )
        }
        let (dashboard, dashboard_events) = channel();
        let (overlay, overlay_events) = channel();
        engine.subscribe("dashboard".into(), dashboard).unwrap();
        engine.subscribe("overlay".into(), overlay).unwrap();
        engine.update(json!({"status":"thinking"}));
        engine.item(json!({"type":"assistant","content":"test"}));
        assert_eq!(
            *dashboard_events.lock().unwrap(),
            *overlay_events.lock().unwrap()
        );
        let (reopened, reopened_events) = channel();
        engine.subscribe("dashboard".into(), reopened).unwrap();
        let reopened = reopened_events.lock().unwrap();
        assert_eq!(reopened[0]["snapshot"]["workstream"][0]["content"], "test");
        assert_eq!(reopened[0]["snapshot"]["seq"], 2);
    }
    #[tokio::test]
    async fn restart_settles_interrupted_approvals_and_drops_expired_frames() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("memory.json");
        std::fs::write(&path,json!({"settings":{},"workstream":[{"id":"a","type":"action","screenshot":"frm_expired","actionData":{"status":"pending_approval"}}]}).to_string()).unwrap();
        let engine = Engine::new(path).unwrap();
        let state = engine.0.state.lock().unwrap();
        assert_eq!(
            state.snapshot["workstream"][0]["actionData"]["status"],
            "error"
        );
        assert!(state.snapshot["workstream"][0]["screenshot"].is_null());
        assert_eq!(state.snapshot["status"], "idle");
    }
}
