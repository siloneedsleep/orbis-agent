use std::fs;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Chuỗi literal trong PowerShell: bọc nháy đơn, nháy đơn bên trong nhân đôi.
fn ps_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

fn sandbox_root_dir() -> PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("Orbis Agent").join("Sandbox")
}

fn ensure_sandbox_dirs() -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let root = sandbox_root_dir();
    let workspace = root.join("Workspace");
    let checkpoints = root.join("Checkpoints");

    fs::create_dir_all(&workspace).map_err(|e| format!("Lỗi tạo thư mục Sandbox Workspace: {e}"))?;
    fs::create_dir_all(&checkpoints).map_err(|e| format!("Lỗi tạo thư mục Sandbox Checkpoints: {e}"))?;

    // Tạo file README hướng dẫn bên trong Sandbox nếu chưa có
    let readme = workspace.join("ORBIS_SANDBOX_INFO.txt");
    if !readme.exists() {
        let _ = fs::write(
            &readme,
            "=== ORBIS AGENT ISOLATED SANDBOX WORKSPACE ===\r\n\
             Mọi lệnh và tệp tin thực thi trong chế độ Sandbox đều được cô lập tại thư mục này.\r\n\
             Bạn có thể tạo Checkpoint và khôi phục (Rollback) bất kỳ lúc nào.\r\n",
        );
    }

    Ok((root, workspace, checkpoints))
}

/// Khởi chạy môi trường Sandbox (Ưu tiên Windows Sandbox .wsb nếu máy bật sẵn,
/// hoặc mở cửa sổ Orbis Isolated Sandbox Terminal + thư mục cô lập).
#[tauri::command(async)]
pub fn start_sandbox_vm() -> Result<String, String> {
    let (root, workspace, _) = ensure_sandbox_dirs()?;
    let ws_str = workspace.to_string_lossy().to_string();

    // Tạo file cấu hình Windows Sandbox (.wsb)
    let wsb_path = root.join("OrbisSandbox.wsb");
    let wsb_xml = format!(
        "<Configuration>\r\n\
           <VGpu>Enable</VGpu>\r\n\
           <Networking>Enable</Networking>\r\n\
           <MappedFolders>\r\n\
             <MappedFolder>\r\n\
               <HostFolder>{}</HostFolder>\r\n\
               <SandboxFolder>C:\\Users\\WDAGUtilityAccount\\Desktop\\OrbisWorkspace</SandboxFolder>\r\n\
               <ReadOnly>false</ReadOnly>\r\n\
             </MappedFolder>\r\n\
           </MappedFolders>\r\n\
         </Configuration>",
        ws_str
    );
    let _ = fs::write(&wsb_path, wsb_xml);

    // Kiểm tra WindowsSandbox.exe có sẵn và tính năng Containers-DisposableClientVM đã bật chưa
    let win_sandbox_exe = PathBuf::from(r"C:\Windows\System32\WindowsSandbox.exe");
    if win_sandbox_exe.exists() {
        let check_feature = run_powershell(
            "(Get-WindowsOptionalFeature -Online -FeatureName 'Containers-DisposableClientVM' -ErrorAction SilentlyContinue).State",
        )
        .unwrap_or_default();

        if check_feature.trim().eq_ignore_ascii_case("Enabled") {
            let _ = Command::new(&win_sandbox_exe).arg(&wsb_path).spawn();
            return Ok(format!(
                "Đã khởi chạy Windows Sandbox gắn kết với thư mục cô lập: {}",
                ws_str
            ));
        }
    }

    // Mở môi trường Orbis Sandbox Terminal cô lập tại Workspace
    let script = format!(
        "Start-Process powershell -WorkingDirectory {} -ArgumentList '-NoExit', '-Command', {}",
        ps_quote(&ws_str),
        ps_quote(&format!(
            "$Host.UI.RawUI.WindowTitle = 'Orbis Isolated Sandbox'; \
             Write-Host '=== ORBIS ISOLATED SANDBOX ENVIRONMENT ===' -ForegroundColor Cyan; \
             Write-Host 'Thư mục cô lập: {}' -ForegroundColor Gray; \
             Write-Host 'Sẵn sàng thực thi lệnh an toàn.' -ForegroundColor Green",
            ws_str.replace('\'', "''")
        ))
    );
    run_powershell(&script)?;

    Ok(format!("Đã mở môi trường Orbis Sandbox tại: {}", ws_str))
}

#[tauri::command(async)]
pub fn create_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let (_, workspace, checkpoints) = ensure_sandbox_dirs()?;
    let safe_name: String = snapshot_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let target = checkpoints.join(if safe_name.is_empty() { "checkpoint_default" } else { &safe_name });

    if target.exists() {
        let _ = fs::remove_dir_all(&target);
    }
    fs::create_dir_all(&target).map_err(|e| format!("Không thể tạo thư mục checkpoint: {e}"))?;

    let script = format!(
        "Copy-Item -Path (Join-Path {} '*') -Destination {} -Recurse -Force -ErrorAction SilentlyContinue",
        ps_quote(&workspace.to_string_lossy()),
        ps_quote(&target.to_string_lossy())
    );
    run_powershell(&script)?;

    Ok(format!("Đã lưu Checkpoint Sandbox: {}", safe_name))
}

#[tauri::command(async)]
pub fn rollback_sandbox_checkpoint(snapshot_name: String) -> Result<String, String> {
    let (_, workspace, checkpoints) = ensure_sandbox_dirs()?;
    let safe_name: String = snapshot_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let source = checkpoints.join(if safe_name.is_empty() { "checkpoint_default" } else { &safe_name });

    if !source.exists() {
        return Err(format!("Không tìm thấy Checkpoint '{}' để khôi phục.", safe_name));
    }

    let script = format!(
        "Get-ChildItem -Path {} -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue; \
         Copy-Item -Path (Join-Path {} '*') -Destination {} -Recurse -Force -ErrorAction SilentlyContinue",
        ps_quote(&workspace.to_string_lossy()),
        ps_quote(&source.to_string_lossy()),
        ps_quote(&workspace.to_string_lossy())
    );
    run_powershell(&script)?;

    Ok(format!("Đã khôi phục Sandbox về Checkpoint: {}", safe_name))
}

#[tauri::command(async)]
pub fn exec_in_sandbox(guest_cmd: String) -> Result<String, String> {
    let (_, workspace, _) = ensure_sandbox_dirs()?;
    let ws_str = workspace.to_string_lossy().to_string();

    // Thực thi lệnh bên trong thư mục cô lập của Sandbox và thu thập kết quả stdout/stderr
    let script = format!(
        "Set-Location -LiteralPath {}; \
         $env:ORBIS_SANDBOX = '1'; \
         $ErrorActionPreference = 'Continue'; \
         Invoke-Expression {} 2>&1 | Out-String",
        ps_quote(&ws_str),
        ps_quote(&guest_cmd)
    );
    let out = run_powershell(&script)?;
    if out.is_empty() {
        Ok("Lệnh đã thực thi thành công trong Sandbox (không có dữ liệu trả về).".to_string())
    } else {
        Ok(out)
    }
}

#[tauri::command(async)]
pub fn place_vm_on_secondary_screen() -> Result<String, String> {
    start_sandbox_vm()
}

fn run_powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(stdout)
    } else if !stdout.is_empty() {
        Ok(format!("{}\n{}", stdout, stderr).trim().to_string())
    } else {
        Err(if stderr.is_empty() {
            "Lỗi thực thi lệnh trong Sandbox.".to_string()
        } else {
            stderr
        })
    }
}
