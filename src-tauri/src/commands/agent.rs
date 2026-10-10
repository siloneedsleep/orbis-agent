use crate::os::edit::{apply_edit_blocks, ApplyResult, EditBlock};
use crate::os::fs::{fs_exists, fs_list, fs_read, fs_write, FsEntry};
use crate::os::repo_map::{build_repo_map, RepoMapEntry};
use crate::os::shell::{shell_exec, ShellResult};

#[tauri::command]
pub async fn agent_fs_read(path: String) -> Result<String, String> { fs_read(path).await }

#[tauri::command]
pub async fn agent_fs_write(path: String, content: String) -> Result<(), String> {
    fs_write(path, content).await
}

#[tauri::command]
pub async fn agent_fs_exists(path: String) -> Result<bool, String> { fs_exists(path).await }

#[tauri::command]
pub async fn agent_fs_list(path: String) -> Result<Vec<FsEntry>, String> { fs_list(path).await }

#[tauri::command]
pub async fn agent_shell_exec(
    cmd: String, cwd: Option<String>, timeout_ms: Option<u64>,
) -> Result<ShellResult, String> {
    shell_exec(cmd, cwd, timeout_ms).await
}

#[tauri::command]
pub async fn agent_build_repo_map(
    root: String, token_budget: Option<usize>,
) -> Result<Vec<RepoMapEntry>, String> {
    build_repo_map(root, token_budget).await
}

#[tauri::command]
pub async fn agent_apply_edits(
    blocks: Vec<EditBlock>, dry_run: bool,
) -> Result<Vec<ApplyResult>, String> {
    apply_edit_blocks(blocks, dry_run).await
}
