//! Client Ollama (local LLM).
//! Hỗ trợ kết nối IPv4 trực tiếp (tránh lỗi phân giải IPv6 localhost trên Windows),
//! tự động fallback khi model không hỗ trợ ảnh (Vision), tự động strip options nếu thiếu VRAM,
//! và hỗ trợ kích hoạt tiến trình Ollama nền khi chưa chạy.

use std::process::Command;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DEFAULT_HOST: &str = "http://127.0.0.1:11434";
const MAX_CTX_CAP: u64 = 8_192; // Giới hạn an toàn trên RAM/VRAM để không làm sập tiến trình

fn get_base_url() -> String {
    std::env::var("OLLAMA_HOST")
        .unwrap_or_else(|_| DEFAULT_HOST.to_string())
        .replace("localhost", "127.0.0.1")
}

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

pub fn spawn_ollama_process() -> Result<(), String> {
    let mut candidates = vec!["ollama".to_string()];
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates.push(format!("{local_app_data}\\Programs\\Ollama\\ollama.exe"));
    }

    for bin in candidates {
        let spawned = Command::new(&bin)
            .arg("serve")
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
        if spawned.is_ok() {
            return Ok(());
        }
    }
    Err("Không tìm thấy tệp ollama.exe để tự động khởi động. Vui lòng mở thủ công hoặc cài đặt Ollama.".to_string())
}

#[tauri::command(async)]
pub async fn start_ollama_server() -> Result<String, String> {
    let base = get_base_url();
    let c = client(2);

    // Nếu đã chạy rồi thì báo thành công luôn
    if c.get(format!("{base}/api/tags")).send().await.is_ok() {
        return Ok("Ollama đã sẵn sàng".to_string());
    }

    // Chưa chạy thì spawn tiến trình
    spawn_ollama_process()?;

    // Đợi tối đa 6 giây để server lên
    for _ in 0..12 {
        std::thread::sleep(Duration::from_millis(500));
        if c.get(format!("{base}/api/tags")).send().await.is_ok() {
            return Ok("Đã khởi động Ollama thành công".to_string());
        }
    }

    Ok("Đã gửi tín hiệu khởi động Ollama, vui lòng đợi vài giây để server nạp xong.".to_string())
}

async fn installed(c: &reqwest::Client) -> Result<Vec<ModelInfo>, String> {
    let base = get_base_url();
    let resp = c
        .get(format!("{base}/api/tags"))
        .send()
        .await
        .map_err(|e| format!("Không kết nối được Ollama ({base}): {e}"))?;
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

fn largest(models: &[ModelInfo]) -> Option<&ModelInfo> {
    models
        .iter()
        .filter(|m| !m.name.to_lowercase().contains("embed"))
        .max_by_key(|m| m.size_bytes)
}

async fn context_length(c: &reqwest::Client, model: &str) -> Option<u64> {
    let base = get_base_url();
    let v: Value = c
        .post(format!("{base}/api/show"))
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

fn make_options(model_ctx: Option<u64>) -> Value {
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let ctx = model_ctx.map_or(4096, |c| c.min(MAX_CTX_CAP));
    json!({
        "num_thread": threads,
        "num_ctx": ctx,
    })
}

async fn send_chat(c: &reqwest::Client, body: &Value) -> Result<Value, String> {
    let base = get_base_url();
    let resp = c
        .post(format!("{base}/api/chat"))
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Không kết nối được Ollama ({base}): {e}"))?;
    let status = resp.status();
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    if status.is_success() {
        Ok(v)
    } else {
        Err(v["error"].as_str().unwrap_or("Lỗi máy chủ Ollama").to_string())
    }
}

#[derive(Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub model: String,
    pub content: String,
    pub max_power: bool,
}

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
                .ok_or("Ollama chưa có model nào. Chạy lệnh: ollama pull <model>")?
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

    let mut body = json!({ "model": model, "messages": msgs, "stream": false, "keep_alive": -1 });
    let mut used_options = max_power.unwrap_or(false);
    if used_options {
        body["options"] = make_options(context_length(&c, &model).await);
    }

    // Lượt 1: Thử gửi bình thường
    let reply = match send_chat(&c, &body).await {
        Ok(v) => v,
        Err(err) => {
            eprintln!("[orbis] Lượt 1 thất bại ({err}), kiểm tra fallback...");
            
            // Nếu có ảnh mà model không hỗ trợ vision (ví dụ qwen2.5-coder, deepseek-r1):
            // Thử strip ảnh ra và chỉ gửi text
            let mut stripped_body = body.clone();
            let mut had_images = false;
            if let Some(arr) = stripped_body["messages"].as_array_mut() {
                for m in arr.iter_mut() {
                    if let Some(obj) = m.as_object_mut() {
                        if obj.remove("images").is_some() {
                            had_images = true;
                        }
                    }
                }
            }

            if had_images {
                eprintln!("[orbis] Đã gỡ bỏ ảnh để thử lại chế độ thuần văn bản...");
                match send_chat(&c, &stripped_body).await {
                    Ok(v) => v,
                    Err(err2) => {
                        // Thử gỡ tiếp options nếu lỗi VRAM
                        if let Some(obj) = stripped_body.as_object_mut() {
                            obj.remove("options");
                        }
                        used_options = false;
                        send_chat(&c, &stripped_body).await.map_err(|e| format!("{err2} -> {e}"))?
                    }
                }
            } else if used_options {
                // Gỡ options nếu lỗi VRAM
                if let Some(obj) = body.as_object_mut() {
                    obj.remove("options");
                }
                used_options = false;
                send_chat(&c, &body).await?
            } else {
                return Err(err);
            }
        }
    };

    let content = reply["message"]["content"]
        .as_str()
        .ok_or("Ollama không trả về nội dung text")?
        .to_string();

    Ok(ChatReply {
        model,
        content,
        max_power: used_options,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaStatus {
    pub models: Vec<ModelInfo>,
    pub largest: Option<String>,
    pub threads: usize,
    pub ctx_cap: u64,
}

#[tauri::command]
pub async fn ollama_status() -> Result<OllamaStatus, String> {
    let c = client(20); // 20s timeout cho máy CPU load model
    let models = installed(&c).await?;
    let largest = largest(&models).map(|m| m.name.clone());
    Ok(OllamaStatus {
        models,
        largest,
        threads: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        ctx_cap: MAX_CTX_CAP,
    })
}
