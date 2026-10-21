use std::path::{Path, PathBuf};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};

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

#[tauri::command]
pub async fn get_pet_video_base64(clip_name: String) -> Result<String, String> {
    let dir = get_pet_dir().ok_or_else(|| "Không tìm thấy thư mục video của pet trong com.fureverdock.pawsy".to_string())?;

    let clean_name = clip_name.trim().to_lowercase();
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
            let lower = file_name.to_lowercase();
            // Khớp tên chính xác hoặc khớp tên có tiền tố số (ví dụ: "01-idle-curled-deep-sleep.webm" khớp với "curled-deep-sleep")
            if lower == clean_name
                || lower == format!("{clean_name}.webm")
                || lower.ends_with(&format!("-{clean_name}.webm"))
                || lower.contains(&clean_name)
            {
                let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
                let b64 = BASE64.encode(&bytes);
                return Ok(format!("data:video/webm;base64,{b64}"));
            }
        }
    }

    Err(format!("Không tìm thấy video clip: {clip_name}"))
}
