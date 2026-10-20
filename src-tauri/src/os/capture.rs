use xcap::Monitor;
use base64::{engine::general_purpose, Engine as _};
use image::{imageops, DynamicImage, ImageFormat};
use std::io::Cursor;

#[tauri::command(async)]
pub fn capture_screen_region(x: i32, y: i32, width: i32, height: i32) -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        return Err("No monitor found".to_string());
    }

    // Tìm monitor chứa điểm (x, y); nếu không tìm thấy lấy monitor đầu tiên
    let monitor = monitors
        .iter()
        .find(|m| {
            let mx = m.x();
            let my = m.y();
            let mw = m.width() as i32;
            let mh = m.height() as i32;
            x >= mx && x < mx + mw && y >= my && y < my + mh
        })
        .unwrap_or(&monitors[0]);

    let full_image = monitor.capture_image().map_err(|e| e.to_string())?;

    let mon_w = full_image.width();
    let mon_h = full_image.height();

    // Toạ độ tương đối so với góc trên-trái của monitor đó
    let rel_x = x - monitor.x();
    let rel_y = y - monitor.y();

    let crop_x = (rel_x.max(0) as u32).min(mon_w);
    let crop_y = (rel_y.max(0) as u32).min(mon_h);
    let crop_w = (width.max(1) as u32).min(mon_w.saturating_sub(crop_x));
    let crop_h = (height.max(1) as u32).min(mon_h.saturating_sub(crop_y));

    let cropped = imageops::crop_imm(&full_image, crop_x, crop_y, crop_w, crop_h).to_image();
    let dyn_image = DynamicImage::ImageRgba8(cropped);

    let mut buffer = Cursor::new(Vec::new());
    dyn_image
        .write_to(&mut buffer, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let base64_str = general_purpose::STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", base64_str))
}
