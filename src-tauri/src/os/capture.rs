use dashmap::DashMap;
use image::{imageops, DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    io::Cursor,
    sync::{Arc, Mutex},
};
use uuid::Uuid;
use xcap::Monitor;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameRef {
    pub frame_id: String,
    pub width: u32,
    pub height: u32,
    pub origin_x: i32,
    pub origin_y: i32,
    pub monitor_scale: f32,
}

/// Five encoded frames; a reader can pin an Arc across eviction.
#[derive(Default)]
pub struct FrameCache {
    frames: DashMap<String, Arc<Vec<u8>>>,
    order: Mutex<VecDeque<String>>,
}

impl FrameCache {
    pub fn insert(&self, bytes: Vec<u8>) -> String {
        let id = format!("frm_{}", Uuid::new_v4());
        let mut order = self.order.lock().unwrap();
        self.frames.insert(id.clone(), Arc::new(bytes));
        order.push_back(id.clone());
        while order.len() > 5 {
            if let Some(old) = order.pop_front() {
                self.frames.remove(&old);
            }
        }
        id
    }
    pub fn get(&self, id: &str) -> Option<Arc<Vec<u8>>> {
        self.frames.get(id).map(|v| Arc::clone(v.value()))
    }
}

pub struct CapturedFrame {
    pub image: DynamicImage,
    pub reference: FrameRef,
}

pub fn capture(x: i32, y: i32, width: i32, height: i32) -> Result<CapturedFrame, String> {
    if width <= 0 || height <= 0 {
        return Err("Vùng chụp phải có kích thước dương".into());
    }
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .iter()
        .find(|m| {
            x >= m.x()
                && y >= m.y()
                && (x as i64) < m.x() as i64 + m.width() as i64
                && (y as i64) < m.y() as i64 + m.height() as i64
        })
        .ok_or("Gốc vùng chụp nằm ngoài các màn hình")?;
    let full = monitor.capture_image().map_err(|e| e.to_string())?;
    let cx = (x - monitor.x()) as u32;
    let cy = (y - monitor.y()) as u32;
    let cw = (width as u32).min(full.width().saturating_sub(cx));
    let ch = (height as u32).min(full.height().saturating_sub(cy));
    if cw == 0 || ch == 0 {
        return Err("Vùng chụp rỗng".into());
    }
    Ok(CapturedFrame {
        image: DynamicImage::ImageRgba8(imageops::crop_imm(&full, cx, cy, cw, ch).to_image()),
        reference: FrameRef {
            frame_id: String::new(),
            width: cw,
            height: ch,
            origin_x: x,
            origin_y: y,
            monitor_scale: monitor.scale_factor(),
        },
    })
}

pub fn cache_frame(mut frame: CapturedFrame, cache: &FrameCache) -> Result<FrameRef, String> {
    let mut buffer = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(frame.image.into_rgb8())
        .write_to(&mut buffer, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;
    frame.reference.frame_id = cache.insert(buffer.into_inner());
    Ok(frame.reference)
}

#[tauri::command(async)]
pub fn capture_screen_region(
    cache: tauri::State<'_, FrameCache>,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<FrameRef, String> {
    cache_frame(capture(x, y, width, height)?, &cache)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn eviction_preserves_pinned_readers() {
        let cache = FrameCache::default();
        let first = cache.insert(vec![42]);
        let pinned = cache.get(&first).unwrap();
        for _ in 0..5 {
            cache.insert(vec![0]);
        }
        assert!(cache.get(&first).is_none());
        assert_eq!(cache.frames.len(), 5);
        assert_eq!(*pinned, vec![42]);
    }
}
