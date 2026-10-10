use serde::Serialize;
use std::path::{Path, PathBuf};
use tokio::fs as tfs;

const MAX_READ_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String, pub path: String, pub is_dir: bool, pub size_bytes: u64,
}

fn canonical(p: &str) -> Result<PathBuf, String> {
    PathBuf::from(p).canonicalize()
        .map_err(|e| format!("Không truy cập được '{p}': {e}"))
}

#[tauri::command]
pub async fn fs_read(path: String) -> Result<String, String> {
    let p = canonical(&path)?;
    let meta = tfs::metadata(&p).await.map_err(|e| format!("stat: {e}"))?;
    if meta.len() > MAX_READ_BYTES {
        return Err(format!("File quá lớn: {} bytes", meta.len()));
    }
    tfs::read_to_string(&p).await.map_err(|e| format!("read: {e}"))
}

#[tauri::command]
pub async fn fs_write(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        tfs::create_dir_all(parent).await.map_err(|e| format!("mkdir: {e}"))?;
    }
    tfs::write(&p, content).await.map_err(|e| format!("write: {e}"))
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn fs_list(path: String) -> Result<Vec<FsEntry>, String> {
    let p = canonical(&path)?;
    let mut rd = tfs::read_dir(&p).await.map_err(|e| format!("read_dir: {e}"))?;
    let mut out = Vec::new();
    while let Some(entry) = rd.next_entry().await.map_err(|e| format!("next_entry: {e}"))? {
        let md = match entry.metadata().await { Ok(m) => m, Err(_) => continue };
        out.push(FsEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: md.is_dir(), size_bytes: md.len(),
        });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(out)
}
