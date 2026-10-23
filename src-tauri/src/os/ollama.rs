//! Client Ollama (local LLM) & Cloud LLM Bridge (DeepSeek, Gemini, OpenAI, Claude).
//! Hỗ trợ kết nối IPv4 trực tiếp (tránh lỗi phân giải IPv6 localhost trên Windows),
//! tự động kiểm tra port TCP 11434 trước khi spawn daemon (tránh xung đột tiến trình),
//! giới hạn num_ctx ở mức an toàn (4096) cho các model 14B tránh tràn RAM/VRAM,
//! tự động khớp model đã cài đặt và hỗ trợ gọi Cloud LLM trực tiếp từ Rust (không bị CORS).

use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const CREATE_NO_WINDOW: u32 = 0x08000000;
const DEFAULT_HOST: &str = "http://127.0.0.1:11434";
/// Mức context mặc định an toàn cho model 7B-14B trên RAM/iGPU (tránh tốn 6GB+ KV cache như 32768)
const DEFAULT_CTX: u64 = 4_096;
const FALLBACK_CTX: u64 = 2_048;

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

/// Kiểm tra nhanh cổng TCP 127.0.0.1:11434 đã có tiến trình Ollama lắng nghe hay chưa.
fn is_ollama_port_open() -> bool {
    let addr: SocketAddr = "127.0.0.1:11434".parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(800)).is_ok()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: String,
    pub size_bytes: u64,
}

pub fn spawn_ollama_process() -> Result<(), String> {
    // Nếu cổng 11434 đã mở (Ollama đang chạy hoặc đang bận nạp model), tuyệt đối không spawn trùng
    if is_ollama_port_open() {
        return Ok(());
    }

    let mut candidates = Vec::new();
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates.push(format!("{local_app_data}\\Programs\\Ollama\\ollama.exe"));
    }
    candidates.push("ollama.exe".to_string());
    candidates.push("ollama".to_string());

    for bin in candidates {
        let mut cmd = Command::new(&bin);
        cmd.arg("serve")
            .env("OLLAMA_ORIGINS", "*")
            .env("OLLAMA_HOST", "127.0.0.1:11434")
            .env("OLLAMA_IGPU_ENABLE", "1");
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        if cmd.spawn().is_ok() {
            return Ok(());
        }
    }
    Err("Không tìm thấy tệp ollama.exe để tự động khởi động. Vui lòng mở thủ công hoặc cài đặt Ollama.".to_string())
}

/// Kiểm tra kết nối tới daemon Ollama.
/// Nếu cổng 11434 chưa mở, tự động kích hoạt `ollama serve` và chờ tiến trình sẵn sàng.
pub async fn ensure_ollama_daemon() -> Result<(), String> {
    let base = get_base_url();
    let check_client = client(8);

    if is_ollama_port_open() {
        if check_client.get(&base).send().await.is_ok() {
            return Ok(());
        }
        // Cổng đã mở nhưng daemon đang bận nạp model -> vẫn coi là đang chạy
        return Ok(());
    }

    // Cổng chưa mở -> kích hoạt tiến trình nền ollama serve
    let _ = spawn_ollama_process();

    for _ in 0..8 {
        std::thread::sleep(Duration::from_millis(500));
        if is_ollama_port_open() {
            return Ok(());
        }
    }

    check_client
        .get(&base)
        .send()
        .await
        .map(|_| ())
        .map_err(|e| format!("Không thể kết nối tới tiến trình Ollama tại {base} sau khi thử tự khởi động: {e}"))
}

#[tauri::command(async)]
pub async fn start_ollama_server() -> Result<String, String> {
    ensure_ollama_daemon().await?;
    Ok("Ollama đã sẵn sàng hoạt động".to_string())
}

async fn installed(c: &reqwest::Client) -> Result<Vec<ModelInfo>, String> {
    ensure_ollama_daemon().await?;
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

/// Chọn model ưu tiên: bỏ qua model embedding, ưu tiên model tên chuẩn (không phải hf.co/) nếu có,
/// hoặc chọn model lớn nhất đã cài.
fn preferred_model(models: &[ModelInfo]) -> Option<&ModelInfo> {
    let non_embed: Vec<&ModelInfo> = models
        .iter()
        .filter(|m| !m.name.to_lowercase().contains("embed"))
        .collect();

    if non_embed.is_empty() {
        return models.first();
    }

    // Ưu tiên các model chính thống ngắn gọn (ví dụ qwen2.5-coder:14b) trước các bản hf.co/...
    if let Some(clean) = non_embed
        .iter()
        .filter(|m| !m.name.starts_with("hf.co/"))
        .max_by_key(|m| m.size_bytes)
    {
        return Some(*clean);
    }

    non_embed.into_iter().max_by_key(|m| m.size_bytes)
}

/// Khớp model được yêu cầu với danh sách model thực tế đang cài trong Ollama.
/// Nếu tên model không tồn tại trong Ollama (ví dụ bị dính tên model Cloud như "deepseek-chat" hay "llama3"),
/// tự động chuyển sang model tốt nhất hiện có trong máy.
async fn resolve_local_model(c: &reqwest::Client, requested: Option<String>) -> Result<String, String> {
    let all = installed(c).await?;
    if all.is_empty() {
        return Err("Ollama chưa có model nào. Hãy chạy lệnh: ollama pull qwen2.5-coder:14b".to_string());
    }

    if let Some(req) = requested {
        let req_trimmed = req.trim();
        if !req_trimmed.is_empty() && !req_trimmed.eq_ignore_ascii_case("auto") {
            // 1. Khớp chính xác hoặc không phân biệt hoa thường
            if let Some(found) = all.iter().find(|m| m.name.eq_ignore_ascii_case(req_trimmed)) {
                return Ok(found.name.clone());
            }
            // 2. Khớp theo tiền tố (ví dụ "qwen2.5-coder" khớp "qwen2.5-coder:14b")
            let req_lower = req_trimmed.to_lowercase();
            if let Some(found) = all.iter().find(|m| {
                let m_lower = m.name.to_lowercase();
                m_lower.starts_with(&req_lower) || m_lower.contains(&req_lower)
            }) {
                return Ok(found.name.clone());
            }
            eprintln!(
                "[orbis] Model '{}' không có trong Ollama, tự động chuyển sang model sẵn có trong máy.",
                req_trimmed
            );
        }
    }

    preferred_model(&all)
        .map(|m| m.name.clone())
        .ok_or_else(|| "Không tìm thấy model phù hợp trong Ollama".to_string())
}

fn make_options(ctx: u64) -> Value {
    json!({
        "num_gpu": 999,
        "num_ctx": ctx,
        "temperature": 0.2
    })
}

async fn send_chat(c: &reqwest::Client, body: &Value) -> Result<Value, String> {
    let base = get_base_url();
    let resp = match c.post(format!("{base}/api/chat")).json(body).send().await {
        Ok(r) => r,
        Err(e) => {
            if !is_ollama_port_open() {
                let _ = spawn_ollama_process();
                std::thread::sleep(Duration::from_millis(1500));
            }
            c.post(format!("{base}/api/chat"))
                .json(body)
                .send()
                .await
                .map_err(|e2| format!("Không kết nối được Ollama ({base}): {e} -> {e2}"))?
        }
    };
    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("Lỗi đọc phản hồi Ollama: {e}"))?;
    let v: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Lỗi giải mã JSON từ Ollama (HTTP {status}): {e} | Raw: {text}"))?;

    if status.is_success() {
        Ok(v)
    } else {
        Err(v["error"]
            .as_str()
            .unwrap_or(&format!("Lỗi máy chủ Ollama (HTTP {status})"))
            .to_string())
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
    let c = client(180);
    let resolved_model = resolve_local_model(&c, model).await?;
    let is_vision_model = {
        let lower = resolved_model.to_lowercase();
        lower.contains("vision")
            || lower.contains("-vl")
            || lower.contains("llava")
            || lower.contains("minicpm")
            || lower.contains("bakllava")
    };

    let msgs: Vec<Value> = messages
        .iter()
        .map(|m| {
            let mut o = json!({ "role": m.role, "content": m.content });
            // Chỉ đính kèm ảnh nếu model thực sự hỗ trợ Vision
            if !m.images.is_empty() && is_vision_model {
                o["images"] = json!(m.images);
            }
            o
        })
        .collect();

    let mut used_options = max_power.unwrap_or(true);
    let mut body = json!({
        "model": resolved_model,
        "messages": msgs,
        "stream": false,
        "format": "json",
        "keep_alive": "15m",
        "options": make_options(DEFAULT_CTX)
    });

    // Lượt 1: Gửi chuẩn với num_ctx = 4096 và format = "json"
    let reply = match send_chat(&c, &body).await {
        Ok(v) => v,
        Err(err) => {
            eprintln!("[orbis] Lượt 1 trên '{}' thất bại ({err}), thử fallback...", resolved_model);

            // Gỡ bỏ ảnh (nếu có) và hạ num_ctx xuống 2048
            if let Some(arr) = body["messages"].as_array_mut() {
                for m in arr.iter_mut() {
                    if let Some(obj) = m.as_object_mut() {
                        obj.remove("images");
                    }
                }
            }
            body["options"] = make_options(FALLBACK_CTX);
            used_options = false;

            match send_chat(&c, &body).await {
                Ok(v) => v,
                Err(err2) => {
                    // Lượt 3: Bỏ ép format: "json" nếu model không hỗ trợ grammar JSON
                    if let Some(obj) = body.as_object_mut() {
                        obj.remove("format");
                    }
                    send_chat(&c, &body)
                        .await
                        .map_err(|err3| format!("{err} -> {err2} -> {err3}"))?
                }
            }
        }
    };

    let content = reply["message"]["content"]
        .as_str()
        .or_else(|| reply["response"].as_str())
        .ok_or("Ollama không trả về nội dung văn bản hợp lệ")?
        .to_string();

    Ok(ChatReply {
        model: resolved_model,
        content,
        max_power: used_options,
    })
}

#[tauri::command]
pub async fn ollama_generate(
    prompt: String,
    system: Option<String>,
    model: Option<String>,
    images: Option<Vec<String>>,
) -> Result<ChatReply, String> {
    let c = client(180);
    let resolved_model = resolve_local_model(&c, model).await?;

    let mut body = json!({
        "model": resolved_model,
        "prompt": prompt,
        "stream": false,
        "format": "json",
        "keep_alive": "15m",
        "options": make_options(DEFAULT_CTX)
    });

    if let Some(sys_prompt) = system {
        body["system"] = json!(sys_prompt);
    }
    if let Some(imgs) = images {
        if !imgs.is_empty() {
            body["images"] = json!(imgs);
        }
    }

    let base = get_base_url();
    let resp = c
        .post(format!("{base}/api/generate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi gọi /api/generate trên Ollama: {e}"))?;

    let status = resp.status();
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(v["error"].as_str().unwrap_or("Lỗi máy chủ Ollama").to_string());
    }

    let content = v["response"]
        .as_str()
        .ok_or("Ollama /api/generate không trả về trường response")?
        .to_string();

    Ok(ChatReply {
        model: resolved_model,
        content,
        max_power: true,
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
    let c = client(15);
    let models = installed(&c).await?;
    let largest = preferred_model(&models).map(|m| m.name.clone());
    Ok(OllamaStatus {
        models,
        largest,
        threads: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
        ctx_cap: DEFAULT_CTX,
    })
}

// ============================================================================
// CLOUD LLM & API KEY VALIDATION (Thực thi trực tiếp ở Rust Backend tránh CORS)
// ============================================================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValidationResult {
    pub valid: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn validate_cloud_api_key(
    provider: String,
    api_key: String,
) -> Result<KeyValidationResult, String> {
    let clean_key = api_key.trim();
    if clean_key.is_empty() {
        return Ok(KeyValidationResult {
            valid: false,
            error: Some("Vui lòng nhập API Key.".to_string()),
        });
    }

    let c = client(12);
    let provider_lower = provider.trim().to_lowercase();

    let req = match provider_lower.as_str() {
        "gemini" => c.get("https://generativelanguage.googleapis.com/v1beta/models").query(&[("key", clean_key)]),
        "openai" => c
            .get("https://api.openai.com/v1/models")
            .header("Authorization", format!("Bearer {clean_key}")),
        "claude" => c
            .get("https://api.anthropic.com/v1/models")
            .header("x-api-key", clean_key)
            .header("anthropic-version", "2023-06-01"),
        "deepseek" => c
            .get("https://api.deepseek.com/models")
            .header("Authorization", format!("Bearer {clean_key}")),
        _ => {
            return Ok(KeyValidationResult {
                valid: false,
                error: Some(format!("Provider không hỗ trợ: {provider}")),
            });
        }
    };

    match req.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            if status == 200 {
                return Ok(KeyValidationResult {
                    valid: true,
                    error: None,
                });
            }
            if status == 400 || status == 401 || status == 403 {
                return Ok(KeyValidationResult {
                    valid: false,
                    error: Some("API Key không hợp lệ, sai định dạng hoặc đã hết hạn.".to_string()),
                });
            }
            if status == 402 {
                return Ok(KeyValidationResult {
                    valid: false,
                    error: Some("Tài khoản API đã hết số dư (HTTP 402 Insufficient Balance).".to_string()),
                });
            }
            if status == 429 {
                return Ok(KeyValidationResult {
                    valid: false,
                    error: Some("Đã chạm ngưỡng giới hạn tần suất (HTTP 429 Rate Limit).".to_string()),
                });
            }
            if let Ok(v) = resp.json::<Value>().await {
                if let Some(msg) = v["error"]["message"].as_str().or_else(|| v["message"].as_str()) {
                    return Ok(KeyValidationResult {
                        valid: false,
                        error: Some(msg.to_string()),
                    });
                }
            }
            Ok(KeyValidationResult {
                valid: false,
                error: Some(format!("Lỗi máy chủ API (HTTP {status}).")),
            })
        }
        Err(err) => {
            if err.is_timeout() {
                Ok(KeyValidationResult {
                    valid: false,
                    error: Some("Quá thời gian chờ phản hồi từ máy chủ (Timeout 12s).".to_string()),
                })
            } else {
                Ok(KeyValidationResult {
                    valid: false,
                    error: Some(format!("Không kết nối được đến máy chủ API: {err}")),
                })
            }
        }
    }
}

fn sanitize_cloud_model(provider: &str, raw_model: Option<String>) -> String {
    let m = raw_model.unwrap_or_default().trim().to_string();
    let m_lower = m.to_lowercase();

    match provider {
        "deepseek" => {
            if m_lower.starts_with("deepseek-") {
                m
            } else {
                "deepseek-chat".to_string()
            }
        }
        "gemini" => {
            let stripped = m.trim_start_matches("models/").to_string();
            if stripped.to_lowercase().starts_with("gemini-") {
                stripped
            } else {
                "gemini-2.0-flash".to_string()
            }
        }
        "openai" => {
            if m_lower.starts_with("gpt-")
                || m_lower.starts_with("o1")
                || m_lower.starts_with("o3")
                || m_lower.starts_with("o4")
                || m_lower.starts_with("chatgpt-")
            {
                m
            } else {
                "gpt-4o-mini".to_string()
            }
        }
        "claude" => {
            if m_lower.starts_with("claude-") {
                m
            } else {
                "claude-3-5-sonnet-20241022".to_string()
            }
        }
        _ => m,
    }
}

#[tauri::command]
pub async fn cloud_llm_chat(
    provider: String,
    api_key: String,
    model: Option<String>,
    system_prompt: String,
    user_prompt: String,
    image_base64: Option<String>,
) -> Result<ChatReply, String> {
    let clean_key = api_key.trim();
    if clean_key.is_empty() {
        return Err(format!("Chưa cấu hình API Key cho {}", provider));
    }

    let provider_lower = provider.trim().to_lowercase();
    let resolved_model = sanitize_cloud_model(&provider_lower, model);
    let clean_img = image_base64
        .map(|s| {
            if let Some(idx) = s.find(";base64,") {
                s[(idx + 8)..].trim().to_string()
            } else {
                s.trim().to_string()
            }
        })
        .filter(|s| !s.is_empty());

    let c = client(60);

    match provider_lower.as_str() {
        "deepseek" => {
            let body_json = json!({
                "model": resolved_model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_prompt }
                ],
                "response_format": { "type": "json_object" },
                "temperature": 0.2
            });

            let resp = c
                .post("https://api.deepseek.com/chat/completions")
                .header("Authorization", format!("Bearer {clean_key}"))
                .header("Content-Type", "application/json")
                .json(&body_json)
                .send()
                .await
                .map_err(|e| format!("Lỗi mạng khi gọi DeepSeek API: {e}"))?;

            let status = resp.status().as_u16();
            if status == 429 {
                return Err("429 Rate Limit: DeepSeek API đã chạm giới hạn tần suất.".to_string());
            }
            if status == 402 {
                return Err("402 Insufficient Balance: Tài khoản DeepSeek đã hết số dư.".to_string());
            }

            let v: Value = resp.json().await.map_err(|e| format!("Lỗi đọc JSON từ DeepSeek: {e}"))?;
            if let Some(content) = v["choices"][0]["message"]["content"].as_str() {
                return Ok(ChatReply {
                    model: resolved_model,
                    content: content.to_string(),
                    max_power: true,
                });
            }

            // Fallback không dùng response_format nếu model như deepseek-reasoner không hỗ trợ json_object
            let fallback_body = json!({
                "model": resolved_model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_prompt }
                ],
                "temperature": 0.2
            });
            let resp2 = c
                .post("https://api.deepseek.com/chat/completions")
                .header("Authorization", format!("Bearer {clean_key}"))
                .header("Content-Type", "application/json")
                .json(&fallback_body)
                .send()
                .await
                .map_err(|e| format!("Lỗi mạng khi gọi DeepSeek API: {e}"))?;

            let v2: Value = resp2.json().await.map_err(|e| e.to_string())?;
            if let Some(err_msg) = v2["error"]["message"].as_str() {
                return Err(format!("DeepSeek API Error: {err_msg}"));
            }
            let content = v2["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("DeepSeek không trả về nội dung hợp lệ")?
                .to_string();

            Ok(ChatReply {
                model: resolved_model,
                content,
                max_power: true,
            })
        }

        "gemini" => {
            let mut parts = vec![json!({ "text": user_prompt })];
            if let Some(ref b64) = clean_img {
                parts.push(json!({
                    "inlineData": {
                        "mimeType": "image/png",
                        "data": b64
                    }
                }));
            }

            let body = json!({
                "systemInstruction": {
                    "parts": [{ "text": system_prompt }]
                },
                "contents": [{
                    "role": "user",
                    "parts": parts
                }],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            });

            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                resolved_model
            );
            let resp = c
                .post(&url)
                .query(&[("key", clean_key)])
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Lỗi mạng khi gọi Gemini API: {e}"))?;

            let status = resp.status().as_u16();
            if status == 429 {
                return Err("429 Rate Limit: Gemini API đã chạm giới hạn tần suất.".to_string());
            }

            let mut v: Value = resp.json().await.map_err(|e| format!("Lỗi đọc JSON từ Gemini: {e}"))?;
            let mut final_model = resolved_model.clone();

            // Nếu model (vd gemini-2.0-flash) bị lỗi 404/400, thử tự động với gemini-1.5-flash
            if v.get("error").is_some() && resolved_model != "gemini-1.5-flash" {
                final_model = "gemini-1.5-flash".to_string();
                let fallback_body = json!({
                    "systemInstruction": {
                        "parts": [{ "text": system_prompt }]
                    },
                    "contents": [{
                        "role": "user",
                        "parts": [{ "text": user_prompt }]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2
                    }
                });
                let fallback_url = format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                    final_model
                );
                if let Ok(r2) = c.post(&fallback_url).query(&[("key", clean_key)]).json(&fallback_body).send().await {
                    if let Ok(v2) = r2.json::<Value>().await {
                        v = v2;
                    }
                }
            }

            if let Some(err_msg) = v["error"]["message"].as_str() {
                return Err(format!("Gemini API Error ({status}): {err_msg}"));
            }

            let content = v["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .ok_or("Gemini API không trả về nội dung hợp lệ")?
                .to_string();

            Ok(ChatReply {
                model: final_model,
                content,
                max_power: true,
            })
        }

        "openai" => {
            let mut user_content = vec![json!({ "type": "text", "text": user_prompt })];
            if let Some(ref b64) = clean_img {
                user_content.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/png;base64,{b64}")
                    }
                }));
            }

            let body = json!({
                "model": resolved_model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_content }
                ],
                "response_format": { "type": "json_object" },
                "temperature": 0.2
            });

            let resp = c
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {clean_key}"))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Lỗi mạng khi gọi OpenAI API: {e}"))?;

            let status = resp.status().as_u16();
            if status == 429 {
                return Err("429 Rate Limit: OpenAI API đã chạm giới hạn tần suất.".to_string());
            }

            let v: Value = resp.json().await.map_err(|e| format!("Lỗi đọc JSON từ OpenAI: {e}"))?;
            if let Some(err_msg) = v["error"]["message"].as_str() {
                return Err(format!("OpenAI API Error: {err_msg}"));
            }

            let content = v["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("OpenAI API không trả về nội dung hợp lệ")?
                .to_string();

            Ok(ChatReply {
                model: resolved_model,
                content,
                max_power: true,
            })
        }

        "claude" => {
            let mut content_parts = Vec::new();
            if let Some(ref b64) = clean_img {
                content_parts.push(json!({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": b64
                    }
                }));
            }
            content_parts.push(json!({ "type": "text", "text": user_prompt }));

            let body = json!({
                "model": resolved_model,
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": [
                    { "role": "user", "content": content_parts }
                ]
            });

            let resp = c
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", clean_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Lỗi mạng khi gọi Claude API: {e}"))?;

            let status = resp.status().as_u16();
            if status == 429 {
                return Err("429 Rate Limit: Claude API đã chạm giới hạn tần suất.".to_string());
            }

            let v: Value = resp.json().await.map_err(|e| format!("Lỗi đọc JSON từ Claude: {e}"))?;
            if let Some(err_msg) = v["error"]["message"].as_str() {
                return Err(format!("Claude API Error: {err_msg}"));
            }

            let content = v["content"][0]["text"]
                .as_str()
                .ok_or("Claude API không trả về nội dung hợp lệ")?
                .to_string();

            Ok(ChatReply {
                model: resolved_model,
                content,
                max_power: true,
            })
        }

        _ => Err(format!("Provider không được hỗ trợ: {provider}")),
    }
}
