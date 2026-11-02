use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PetInfo {
    pub id: String,
    pub name: String,
    pub species: String,
    pub breed: String,
    pub is_available: bool,
    pub clips_count: usize,
}

fn get_pet_dir() -> Option<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = Path::new(&appdata)
            .join("com.fureverdock.pawsy")
            .join("pets")
            .join("3986bf7c-0bae-4763-bb35-f342393671f4")
            .join("keyed-videos");
        if p.exists() {
            return Some(p);
        }

        // Thử tìm bất kỳ pet nào trong thư mục pets nếu UUID khác
        let pets_dir = Path::new(&appdata)
            .join("com.fureverdock.pawsy")
            .join("pets");
        if let Ok(entries) = std::fs::read_dir(&pets_dir) {
            for entry in entries.flatten() {
                let kv = entry.path().join("keyed-videos");
                if kv.exists() {
                    return Some(kv);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn get_pet_info() -> Result<PetInfo, String> {
    let dir = get_pet_dir();
    let is_avail = dir.is_some();
    let clips_count = dir
        .as_ref()
        .and_then(|d| std::fs::read_dir(d).ok())
        .map(|rd| rd.count())
        .unwrap_or(0);

    Ok(PetInfo {
        id: "silo-cyber-cat".to_string(),
        name: "Silo (Cyber Cyan Cat)".to_string(),
        species: "cat".to_string(),
        breed: "Golden British Shorthair".to_string(),
        is_available: is_avail,
        clips_count,
    })
}

pub fn resolve_clip(clip_name: &str) -> Result<PathBuf, String> {
    let clean = clip_name.trim().to_lowercase();
    if clean.is_empty()
        || !clean
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
        || clean.contains("..")
    {
        return Err("Tên clip không hợp lệ".into());
    }
    let dir = get_pet_dir()
        .ok_or("Chưa có video CyberCat trên máy này")?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let name = clean.strip_suffix(".webm").unwrap_or(&clean);
    for entry in std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
    {
        let path = entry.path();
        let file = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if file == format!("{name}.webm") || file.ends_with(&format!("-{name}.webm")) {
            let resolved = path.canonicalize().map_err(|e| e.to_string())?;
            if resolved.starts_with(&dir) && resolved.is_file() {
                return Ok(resolved);
            }
        }
    }
    Err(format!("Không tìm thấy clip: {clip_name}"))
}
