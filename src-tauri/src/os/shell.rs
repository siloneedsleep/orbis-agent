use serde::Serialize;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShellResult {
    pub stdout: String, pub stderr: String, pub exit_code: i32, pub timed_out: bool,
}

const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_OUTPUT_BYTES: usize = 512 * 1024;

async fn read_capped<R: AsyncReadExt + Unpin>(mut r: R) -> Vec<u8> {
    let mut buf = Vec::with_capacity(8 * 1024);
    let mut chunk = [0u8; 4096];
    loop {
        match r.read(&mut chunk).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                if buf.len() + n > MAX_OUTPUT_BYTES {
                    buf.extend_from_slice(&chunk[..MAX_OUTPUT_BYTES - buf.len()]);
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
            }
        }
    }
    buf
}

#[tauri::command]
pub async fn shell_exec(
    cmd: String, cwd: Option<String>, timeout_ms: Option<u64>,
) -> Result<ShellResult, String> {
    if cmd.trim().is_empty() { return Err("Lệnh rỗng.".into()); }
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    #[cfg(windows)]
    let mut command = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut c = Command::new("cmd");
        c.args(["/C", &cmd]);
        c.creation_flags(CREATE_NO_WINDOW);
        c
    };
    #[cfg(not(windows))]
    let mut command = { let mut c = Command::new("sh"); c.args(["-c", &cmd]); c };

    if let Some(dir) = cwd.as_deref() { command.current_dir(dir); }
    command.stdin(Stdio::null()).stdout(Stdio::piped())
        .stderr(Stdio::piped()).kill_on_drop(true);

    let mut child = command.spawn().map_err(|e| format!("spawn: {e}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let fut = async {
        let so_fut = async { match stdout { Some(r) => read_capped(r).await, None => Vec::new() } };
        let se_fut = async { match stderr { Some(r) => read_capped(r).await, None => Vec::new() } };
        let (so, se, status) = tokio::join!(so_fut, se_fut, child.wait());
        (so, se, status)
    };

    match tokio::time::timeout(timeout, fut).await {
        Ok((so, se, status)) => {
            let status = status.map_err(|e| format!("wait: {e}"))?;
            Ok(ShellResult {
                stdout: String::from_utf8_lossy(&so).into_owned(),
                stderr: String::from_utf8_lossy(&se).into_owned(),
                exit_code: status.code().unwrap_or(-1), timed_out: false,
            })
        }
        Err(_) => Ok(ShellResult {
            stdout: String::new(),
            stderr: format!("Timeout {} ms.", timeout.as_millis()),
            exit_code: -1, timed_out: true,
        }),
    }
}
