use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{
    fs,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::Command,
};
use tokio_util::sync::CancellationToken;

fn root() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Orbis Agent")
        .join("Sandbox")
}
fn workspace() -> Result<PathBuf, String> {
    let path = root().join("Workspace");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}
fn xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
fn executable() -> Result<PathBuf, String> {
    let path = PathBuf::from(r"C:\Windows\System32\WindowsSandbox.exe");
    if !path.is_file() {
        return Err("Máy chưa có Windows Sandbox. Bật Windows Sandbox trong Windows Features; Orbis sẽ không chạy lệnh thay thế trên máy chủ.".into());
    }
    Ok(path)
}
fn configuration(workspace: &Path, jobs: Option<&Path>) -> String {
    let work = xml(&workspace.to_string_lossy());
    let job = jobs.map(|p| format!("<MappedFolder><HostFolder>{}</HostFolder><SandboxFolder>C:\\OrbisJobs</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>",xml(&p.to_string_lossy()))).unwrap_or_default();
    let logon = if jobs.is_some() {
        "<LogonCommand><Command>powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\\OrbisJobs\\run.ps1</Command></LogonCommand>"
    } else {
        ""
    };
    format!("<Configuration><VGpu>Disable</VGpu><Networking>Disable</Networking><ClipboardRedirection>Disable</ClipboardRedirection><MappedFolders><MappedFolder><HostFolder>{work}</HostFolder><SandboxFolder>C:\\OrbisWorkspace</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>{job}</MappedFolders>{logon}</Configuration>")
}

#[tauri::command(async)]
pub fn start_sandbox_vm() -> Result<String, String> {
    let exe = executable()?;
    let work = workspace()?;
    let path = root().join("OrbisSandbox.wsb");
    fs::write(&path, configuration(&work, None)).map_err(|e| e.to_string())?;
    Command::new(exe)
        .arg(path)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Không khởi chạy được Windows Sandbox: {e}"))?;
    Ok("Đã yêu cầu mở Windows Sandbox; chỉ thư mục Workspace được chia sẻ với máy ảo".into())
}

pub async fn execute_guest(command: String, cancel: &CancellationToken) -> Result<String, String> {
    let exe = executable()?;
    let work = workspace()?;
    let jobs = root().join("Jobs").join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&jobs).map_err(|e| e.to_string())?;
    let utf16: Vec<u8> = command.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let encoded = STANDARD.encode(utf16);
    let script = format!("$ErrorActionPreference = 'Stop'\ntry {{\n Set-Location C:\\OrbisWorkspace\n & powershell.exe -NoProfile -NonInteractive -EncodedCommand '{encoded}' *> C:\\OrbisJobs\\output.txt\n $result = @{{exitCode=$LASTEXITCODE}} | ConvertTo-Json -Compress\n [IO.File]::WriteAllText('C:\\OrbisJobs\\result.json', $result)\n}} catch {{\n [IO.File]::WriteAllText('C:\\OrbisJobs\\output.txt', $_.ToString())\n [IO.File]::WriteAllText('C:\\OrbisJobs\\result.json', '{{\"exitCode\":1}}')\n}} finally {{ shutdown.exe /s /t 1 }}\n");
    fs::write(jobs.join("run.ps1"), script).map_err(|e| e.to_string())?;
    let config = jobs.join("job.wsb");
    fs::write(&config, configuration(&work, Some(&jobs))).map_err(|e| e.to_string())?;
    let mut child = tokio::process::Command::new(exe)
        .arg(config)
        .creation_flags(0x08000000)
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| e.to_string())?;
    let started = std::time::Instant::now();
    loop {
        if cancel.is_cancelled() || started.elapsed() > std::time::Duration::from_secs(300) {
            let _ = child.kill().await;
            return Err("Đã dừng hoặc hết thời gian chờ Windows Sandbox; kiểm tra VM nếu lệnh vẫn đang chạy".into());
        }
        if let Ok(bytes) = fs::read(jobs.join("result.json")) {
            if let Ok(result) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let bytes = fs::read(jobs.join("output.txt")).unwrap_or_default();
                let output = if bytes.starts_with(&[0xff, 0xfe]) {
                    String::from_utf16_lossy(
                        &bytes[2..]
                            .chunks_exact(2)
                            .map(|b| u16::from_le_bytes([b[0], b[1]]))
                            .collect::<Vec<_>>(),
                    )
                } else {
                    String::from_utf8_lossy(&bytes).to_string()
                };
                if result["exitCode"].as_i64() != Some(0) {
                    return Err(format!("Sandbox command failed: {output}"));
                }
                return Ok(output.chars().take(12000).collect());
            }
        }
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            if !status.success() {
                return Err(format!("Windows Sandbox không khởi động được ({status}). Kiểm tra Windows Features và ảo hóa."));
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
}

fn checkpoint(name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || name.len() > 100
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Tên checkpoint không hợp lệ".into());
    }
    Ok(root().join("Checkpoints").join(name))
}
fn copy_tree(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Checkpoint không hỗ trợ symlink/junction".into());
        }
        if metadata.is_dir() {
            copy_tree(&entry.path(), &to.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), to.join(entry.file_name())).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
#[tauri::command(async)]
pub fn create_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let target = checkpoint(&snapshot_name)?;
    if target.exists() {
        return Err("Checkpoint đã tồn tại; hãy chọn tên khác".into());
    }
    copy_tree(&workspace()?, &target)?;
    Ok(format!(
        "Đã lưu checkpoint thư mục Workspace: {snapshot_name}"
    ))
}
#[tauri::command(async)]
pub fn rollback_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let source = checkpoint(&snapshot_name)?;
    if !source.is_dir() {
        return Err("Không tìm thấy checkpoint".into());
    }
    let work = workspace()?.canonicalize().map_err(|e| e.to_string())?;
    let allowed = root().canonicalize().map_err(|e| e.to_string())?;
    if work.parent() != Some(allowed.as_path())
        || work.file_name().and_then(|s| s.to_str()) != Some("Workspace")
    {
        return Err("Đường dẫn Workspace không hợp lệ".into());
    }
    // Stage the complete restored copy before touching the current workspace.
    let staged = root().join(format!("restore_{}", uuid::Uuid::new_v4()));
    copy_tree(&source, &staged)?;
    let backup = root().join(format!("before_restore_{}", uuid::Uuid::new_v4()));
    fs::rename(&work, &backup).map_err(|e| e.to_string())?;
    if let Err(error) = fs::rename(&staged, &work) {
        let _ = fs::rename(&backup, &work);
        return Err(error.to_string());
    }
    Ok(format!(
        "Đã phục hồi Workspace; bản trước đó còn ở {}",
        backup.display()
    ))
}
#[tauri::command]
pub async fn exec_in_sandbox(guest_cmd: String) -> Result<String, String> {
    execute_guest(guest_cmd, &CancellationToken::new()).await
}
#[tauri::command(async)]
pub fn place_vm_on_secondary_screen() -> Result<String, String> {
    start_sandbox_vm()
}
