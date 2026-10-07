#[tauri::command]
pub fn capture_screen_region(x: i32, y: i32, width: i32, height: i32) -> String {
    println!("Capturing region: x:{}, y:{}, w:{}, h:{}", x, y, width, height);
    // Gọi DXGI Desktop Duplication API để chụp frame <5ms
    // Encode base64 trả về cho React hoặc gửi thẳng lên Cloud API
    "base64_encoded_image_stub".to_string()
}
