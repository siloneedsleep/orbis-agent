# Orbis Agent 1.0

Ứng dụng desktop Windows dùng Tauri v2, Rust, React 18 và TypeScript. Engine Rust quản lý tác vụ, lịch sử và cấu hình chung cho Dashboard và Overlay.

## Chạy và build

Yêu cầu Windows 10/11, Node.js 24+, Rust stable MSVC và WebView2. Cấu hình model Ollama đã cài hoặc API cloud trong Dashboard.

```powershell
npm ci
npm run tauri dev
```

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
npm run tauri build
```

## Các thay đổi chính

- Ảnh chụp trả về FrameRef; cache Rust giữ tối đa 5 frame. Ảnh và video dùng giao thức orbis thay vì chuỗi Base64 qua JSON IPC. HTTP response vẫn sở hữu buffer riêng.
- Hit-test native kiểm tra con trỏ mỗi 25 ms; frontend chỉ đăng ký vùng tương tác.
- UI Automation và nhãn Set-of-Mark hỗ trợ click_element/type_into_element. Kiểm tra lại runtime ID trước khi click.
- Vòng lặp agent và định tuyến Reflex/DAG chạy trong Rust. Các node phân tích độc lập chạy đồng thời; Operator dùng chung desktop chạy tuần tự.
- Tauri Channel gửi snapshot và delta cho hai cửa sổ. Cấu hình cũ được nhập từ localStorage một lần; bộ nhớ mới được lưu nguyên tử trong memory-v1.json tại app data.
- Ollama dùng JSON Schema; cloud dùng structured output/tool calling và kiểm tra kiểu trong Rust. Cloud fallback cần được bật trong Cài đặt.
- MCP HTTP, SSE và STDIO dùng rmcp. STDIO tách chương trình và mảng arguments, không chạy chuỗi lệnh qua shell.
- Ctrl+Alt+Space mở thanh lệnh; / chọn kỹ năng, @ chọn MCP. Avatar chuyển giữa CyberCat và Core; có Stealth Mode.
- Skill Studio nhập/xuất .orbis; kỹ năng nhập vào mặc định tắt. Mã quà tặng nằm trong mục mở rộng của Capsule.
- Nhấn Escape ba lần hoặc nút Dừng để hủy tác vụ và thao tác nhập native.

## Sandbox và giới hạn

Lệnh Sandbox chạy bằng Windows Sandbox thật; không có phương án thay thế chạy PowerShell trên host. Cần bật Windows Sandbox và ảo hóa. Workspace là thư mục chia sẻ có quyền ghi; checkpoint/rollback chỉ áp dụng cho thư mục này, không phải snapshot/VSS của toàn hệ thống. Tác vụ từ xa đã gửi tới MCP hoặc n8n có thể tiếp tục ở server sau khi hủy phía client.

UIA phụ thuộc mức hỗ trợ accessibility của ứng dụng. Các giao diện canvas có thể cần tọa độ fallback. Không có cam kết về độ chính xác hay tốc độ suy luận; cần kiểm thử với model, DPI và màn hình thực tế. Các adapter cloud, MCP và Windows Sandbox cần cấu hình để kiểm chứng end-to-end.

Bản debug hỗ trợ biến ORBIS_DATA_DIR để dùng bộ nhớ và WebView profile kiểm thử riêng. Không commit dữ liệu kiểm thử, API key, node_modules, dist hoặc target.

Mã nguồn v0.2.0 ban đầu được sao chép từ E:/Users/truon/OneDrive/Desktop/orbis-agent-main; bản gốc được giữ nguyên.
