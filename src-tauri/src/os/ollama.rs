//! Client Ollama (local LLM). Mặc định chạy ở chế độ "max power":
//! full GPU offload, toàn bộ luồng CPU, giữ model nằm trong RAM/VRAM, và tự chọn model lớn nhất đã cài.
//!
//! Gọi từ Rust thay vì từ webview: origin của Tauri trên Windows (`http://tauri.localhost`)
//! không nằm trong danh sách CORS mặc định của Ollama nên fetch từ frontend sẽ bị chặn.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const BASE_URL: &str = "http://localhost:11434";

/// Trần context ở chế độ max. Context càng lớn càng ngốn VRAM (KV cache); vượt VRAM thì Ollama
/// đẩy layer sang CPU và chậm đi nhiều lần. Nâng số này nếu máy còn dư VRAM.
const MAX_CTX_CAP: u64 = 32_768;

fn client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_default()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: String,
    pub size_bytes: u64,
}

async fn installed(c: &reqwest::Client) -> Result<Vec<ModelInfo>, String> {
    let resp = c
        .get(format!("{BASE_URL}/api/tags"))
        .send()
        .await
        .map_err(|e| format!("Không kết nối được Ollama ({BASE_URL}): {e}"))?;
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(v["models"]
        .as_array()
        .map(|list| {
            list.iter()
                .filter_map(|m| {
                    Some(ModelInfo {
                        name: m["name"].as_str()?.to_string(),
                        size_bytes: m["size"].as_u64().unwrap_or(0),
                    })
                })
                .collect()
        })
        .unwrap_or_default())
}

/// "Model lớn nhất" = file model nặng nhất đã cài (bỏ qua model embedding vì không chat được).
fn largest(models: &[ModelInfo]) -> Option<&ModelInfo> {
    models
        .iter()
        .filter(|m| !m.name.to_lowercase().contains("embed"))
        .max_by_key(|m| m.size_bytes)
}

/// Context tối đa mà model hỗ trợ (khoá `<arch>.context_length` trong model_info).
async fn context_length(c: &reqwest::Client, model: &str) -> Option<u64> {
    let v: Value = c
        .post(format!("{BASE_URL}/api/show"))
        .json(&json!({ "model": model }))
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;
    v["model_info"]
        .as_object()?
        .iter()
        .find(|(k, _)| k.ends_with(".context_length"))?
        .1
        .as_u64()
}

fn max_options(model_ctx: Option<u64>) -> Value {
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let ctx = model_ctx.map_or(MAX_CTX_CAP, |c| c.min(MAX_CTX_CAP));
    json!({
        "num_gpu": 999,      // đẩy toàn bộ layer lên GPU (Ollama tự cắt về số layer thật của model)
        "num_thread": threads,
        "num_ctx": ctx,
        "num_batch": 512,
    })
}

async fn send(c: &reqwest::Client, body: &Value) -> Result<Value, String> {
    let resp = c
        .post(format!("{BASE_URL}/api/chat"))
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Không kết nối được Ollama ({BASE_URL}): {e}"))?;
    let status = resp.status();
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    if status.is_success() {
        Ok(v)
    } else {
        Err(v["error"].as_str().unwrap_or("lỗi không rõ").to_string())
    }
}

#[derive(Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
    /// Ảnh base64 (không có tiền tố data:) cho model vision.
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub model: String,
    pub content: String,
    /// false nếu cấu hình max bị lỗi (vd. hết VRAM) và đã tự lùi về mặc định của Ollama.
    pub max_power: bool,
}

/// `model`: None hoặc "auto" = model lớn nhất đã cài. `max_power`: mặc định true.
#[tauri::command]
pub async fn ollama_chat(
    messages: Vec<ChatMsg>,
    model: Option<String>,
    max_power: Option<bool>,
) -> Result<ChatReply, String> {
    let c = client(300);

    let requested = model.filter(|m| {
        let m = m.trim();
        !m.is_empty() && m != "auto"
    });
    let model = match requested {
        Some(m) => m,
        None => {
            let all = installed(&c).await?;
            largest(&all)
                .map(|m| m.name.clone())
                .ok_or("Ollama chưa có model nào. Chạy: ollama pull <tên model>")?
        }
    };

    let msgs: Vec<Value> = messages
        .iter()
        .map(|m| {
            let mut o = json!({ "role": m.role, "content": m.content });
            if !m.images.is_empty() {
                o["images"] = json!(m.images);
            }
            o
        })
        .collect();

    // keep_alive = -1: không bao giờ unload, lượt sau không phải nạp lại model.
    let mut body = json!({ "model": model, "messages": msgs, "stream": false, "keep_alive": -1 });
    let mut used_max = max_power.unwrap_or(true);
    if used_max {
        body["options"] = max_options(context_length(&c, &model).await);
    }

    let reply = match send(&c, &body).await {
        Ok(v) => v,
        Err(err) if used_max => {
            // Ép full GPU + context lớn có thể hết VRAM: thử lại một lần với mặc định của Ollama.
            eprintln!("[orbis] max-power thất bại ({err}), thử lại với cấu hình mặc định");
            if let Some(obj) = body.as_object_mut() {
                obj.remove("options");
            }
            used_max = false;
            send(&c, &body).await?
        }
        Err(err) => return Err(err),
    };

    let content = reply["message"]["content"]
        .as_str()
        .ok_or("Ollama không trả về nội dung")?
        .to_string();
    Ok(ChatReply { model, content, max_power: used_max })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub models: Vec<ModelInfo>,
    /// Model sẽ được chọn ở chế độ auto.
    pub largest: Option<String>,
    pub threads: usize,
    pub ctx_cap: u64,
}

#[tauri::command]
pub async fn ollama_status() -> Result<OllamaStatus, String> {
    let c = client(8);
    let models = installed(&c).await?;
    let largest = largest(&models).map(|m| m.name.clone());
    Ok(OllamaStatus {
        models,
        largest,
        threads: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        ctx_cap: MAX_CTX_CAP,
    })
}
