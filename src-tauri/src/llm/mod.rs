pub mod cloud;
pub mod mcp_client;
pub mod ollama;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use tauri::Manager;
use tokio_util::sync::CancellationToken;

pub async fn structured(
    app: &tauri::AppHandle,
    config: &Value,
    system: &str,
    prompt: &str,
    schema: Value,
    frame_id: Option<&str>,
    cancel: &CancellationToken,
) -> Result<Value, String> {
    let bytes = frame_id
        .map(|id| {
            app.state::<crate::os::capture::FrameCache>()
                .get(id)
                .ok_or("Frame expired")
        })
        .transpose()?;
    // Only the provider's HTTP payload is base64 encoded; media never crosses JS IPC.
    let image = bytes.as_ref().map(|b| STANDARD.encode(b.as_slice()));
    let provider = config["provider"].as_str().unwrap_or("ollama");
    let local = config["mode"] == "local" || config["type"] == "local" || provider == "ollama";
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err("Đã dừng tác vụ".into()),
        result = async {
            if local {
                match ollama::request(config, system, prompt, &schema, image.clone()).await {
                    Ok(output) => Ok(output),
                    Err(local_error) if config["fallbackEnabled"] == true => {
                        let engine = app.state::<crate::agent::Engine>();
                        let mut cloud_config = config.clone();
                        let provider = config["cloudProvider"].as_str().ok_or("Chưa chọn cloud fallback")?;
                        cloud_config["provider"] = serde_json::json!(provider);
                        cloud_config["apiKey"] = serde_json::json!(engine.setting(&format!("orbis_{provider}_key")).or_else(|| config["apiKey"].as_str().map(str::to_owned)).ok_or("Thiếu key cloud fallback")?);
                        engine.update(serde_json::json!({"message":"Local gặp lỗi; đang chuyển sang cloud fallback đã bật"}));
                        cloud::request(&cloud_config,system,prompt,&schema,image).await.map_err(|error| format!("Local: {local_error}; Cloud: {error}"))
                    },
                    Err(error) => Err(error),
                }
            }
            else { cloud::request(config, system, prompt, &schema, image).await }
        } => result,
    }
}

pub async fn read_response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|e| format!("Phản hồi JSON không hợp lệ: {e}"))?;
    if !status.is_success() {
        // Never echo whole provider payloads (may contain keys, screenshots, or input).
        return Err(format!(
            "LLM HTTP {}: {}",
            status.as_u16(),
            value["error"]["message"]
                .as_str()
                .unwrap_or("Yêu cầu bị từ chối")
                .chars()
                .take(250)
                .collect::<String>()
        ));
    }
    Ok(value)
}
