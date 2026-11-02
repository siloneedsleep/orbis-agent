use rmcp::{
    model::CallToolRequestParam,
    service::{RoleClient, RunningService},
    transport::{
        sse_client::SseClientConfig, streamable_http_client::StreamableHttpClientTransportConfig,
        SseClientTransport, StreamableHttpClientTransport, TokioChildProcess,
    },
    ServiceExt,
};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

type Session = RunningService<RoleClient, ()>;
#[derive(Default)]
pub struct McpClient {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
}

impl McpClient {
    async fn connect(&self, config: &Value) -> Result<Arc<Session>, String> {
        let key = json!({"type":config["type"],"serverUrl":config["serverUrl"],"command":config["command"],"args":config["args"],"headers":config["headers"],"authToken":config["authToken"]}).to_string();
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get(&key) {
            return Ok(session.clone());
        }
        let session = if config["type"] == "stdio" {
            let executable = config["command"]
                .as_str()
                .filter(|s| !s.trim().is_empty())
                .ok_or("Thiếu chương trình MCP STDIO")?;
            let mut command = tokio::process::Command::new(executable);
            if let Some(args) = config["args"].as_array() {
                for arg in args {
                    command.arg(arg.as_str().ok_or("MCP args phải là chuỗi")?);
                }
            }
            command.creation_flags(0x08000000);
            command.kill_on_drop(true);
            let transport = TokioChildProcess::new(command).map_err(|e| e.to_string())?;
            ().serve(transport).await.map_err(|e| e.to_string())?
        } else {
            let url = config["serverUrl"].as_str().ok_or("Thiếu URL MCP")?;
            let mut headers = reqwest::header::HeaderMap::new();
            if let Some(custom) = config["headers"].as_object() {
                for (key, value) in custom {
                    headers.insert(
                        reqwest::header::HeaderName::from_bytes(key.as_bytes())
                            .map_err(|e| e.to_string())?,
                        value
                            .as_str()
                            .ok_or("Header phải là chuỗi")?
                            .parse::<reqwest::header::HeaderValue>()
                            .map_err(|e| e.to_string())?,
                    );
                }
            }
            if let Some(token) = config["authToken"].as_str().filter(|s| !s.is_empty()) {
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {token}")
                        .parse()
                        .map_err(|e: reqwest::header::InvalidHeaderValue| e.to_string())?,
                );
            }
            let client = reqwest::Client::builder()
                .default_headers(headers)
                .build()
                .map_err(|e| e.to_string())?;
            if config["type"] == "sse" {
                let transport = SseClientTransport::start_with_client(
                    client,
                    SseClientConfig {
                        sse_endpoint: url.to_owned().into(),
                        ..Default::default()
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
                ().serve(transport).await.map_err(|e| e.to_string())?
            } else {
                let transport = StreamableHttpClientTransport::with_client(
                    client,
                    StreamableHttpClientTransportConfig::with_uri(url.to_owned()),
                );
                ().serve(transport).await.map_err(|e| e.to_string())?
            }
        };
        let session = Arc::new(session);
        sessions.insert(key, session.clone());
        Ok(session)
    }
    pub async fn list(&self, config: &Value) -> Result<Value, String> {
        let session = self.connect(config).await?;
        let started = std::time::Instant::now();
        let tools = session.list_all_tools().await.map_err(|e| e.to_string())?;
        Ok(
            json!({"success":true,"count":tools.len(),"latencyMs":started.elapsed().as_millis() as u64,"tools":tools}),
        )
    }
    pub async fn call(
        &self,
        config: &Value,
        tool: String,
        arguments: Value,
    ) -> Result<Value, String> {
        let session = self.connect(config).await?;
        let result = session
            .call_tool(CallToolRequestParam {
                name: tool.into(),
                arguments: Some(
                    arguments
                        .as_object()
                        .ok_or("MCP arguments phải là object")?
                        .clone(),
                ),
            })
            .await
            .map_err(|e| e.to_string())?;
        if result.is_error == Some(true) {
            return Err(format!(
                "MCP tool báo lỗi: {}",
                serde_json::to_string(&result.content)
                    .unwrap_or_default()
                    .chars()
                    .take(2000)
                    .collect::<String>()
            ));
        }
        serde_json::to_value(result).map_err(|e| e.to_string())
    }
}
