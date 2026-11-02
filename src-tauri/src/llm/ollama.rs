use serde_json::{json, Value};

pub async fn request(
    config: &Value,
    system: &str,
    prompt: &str,
    schema: &Value,
    image: Option<String>,
) -> Result<Value, String> {
    crate::os::ollama::ensure_ollama_daemon().await?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let selected = config["localModel"]
        .as_str()
        .or(config["model"].as_str())
        .unwrap_or("auto");
    let model = if selected != "auto" && !selected.is_empty() {
        selected.to_owned()
    } else {
        let tags = super::read_response(
            client
                .get("http://127.0.0.1:11434/api/tags")
                .send()
                .await
                .map_err(|e| e.to_string())?,
        )
        .await?;
        let models = tags["models"].as_array().ok_or("Ollama chưa có model")?;
        let mut memory = windows_sys::Win32::System::SystemInformation::MEMORYSTATUSEX {
            dwLength: std::mem::size_of::<
                windows_sys::Win32::System::SystemInformation::MEMORYSTATUSEX,
            >() as u32,
            ..unsafe { std::mem::zeroed() }
        };
        unsafe {
            windows_sys::Win32::System::SystemInformation::GlobalMemoryStatusEx(&mut memory);
        }
        let mut candidates: Vec<_> = models
            .iter()
            .filter(|m| !m["name"].as_str().unwrap_or("").contains("embed"))
            .collect();
        candidates.sort_by_key(|m| m["size"].as_u64().unwrap_or(0));
        let fits: Vec<_> = candidates
            .iter()
            .copied()
            .filter(|m| m["size"].as_u64().unwrap_or(0) < memory.ullAvailPhys * 7 / 10)
            .collect();
        let pool = if fits.is_empty() { &candidates } else { &fits };
        pool.iter()
            .rev()
            .find(|m| is_vision(m["name"].as_str().unwrap_or("")))
            .or_else(|| pool.last())
            .and_then(|m| m["name"].as_str())
            .ok_or("Hãy cài một model Ollama trước")?
            .to_owned()
    };
    let mut user = json!({"role":"user","content":prompt});
    // Text-only models still receive exact UIA names and physical bounds.
    if is_vision(&model) {
        if let Some(image) = image {
            user["images"] = json!([image]);
        }
    }
    let body = json!({"model":model,"messages":[{"role":"system","content":system},user],"format":schema,"stream":false,"keep_alive":"5m","options":{"temperature":0,"num_ctx":8192}});
    let response = client
        .post("http://127.0.0.1:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let value = super::read_response(response).await?;
    let content = value["message"]["content"]
        .as_str()
        .ok_or("Ollama không trả nội dung")?;
    serde_json::from_str(content).map_err(|e| format!("Ollama không tuân thủ schema: {e}"))
}

fn is_vision(name: &str) -> bool {
    let name = name.to_lowercase();
    [
        "vision",
        "vl",
        "llava",
        "minicpm",
        "gemma3",
        "pixtral",
        "moondream",
    ]
    .iter()
    .any(|s| name.contains(s))
}
