# Đóng góp cho Orbis Agent

Cảm ơn bạn đã muốn đóng góp cho dự án Orbis Agent.

## Mục tiêu dự án

Orbis Agent là ứng dụng desktop Tauri + React + Rust, tập trung vào trải nghiệm overlay, tray, hotkey và các chức năng tự động hỗ trợ người dùng trên Windows.

## Quy trình đóng góp

### 1. Fork và tạo nhánh

- Fork repository về tài khoản cá nhân.
- Tạo nhánh mới theo mô tả rõ ràng, ví dụ: `feature/overlay-hotkey` hoặc `fix/tray-state`.

### 2. Thiết lập môi trường

Yêu cầu:

- Node.js 20+
- Rust stable
- Toolchain MSVC trên Windows
- WebView2 runtime

Cài đặt:

```bash
npm install
npm run tauri dev
```

### 3. Viết code

- Giữ patch nhỏ, rõ mục tiêu và dễ review.
- Thêm hoặc cập nhật test nếu có liên quan.
- Không commit dữ liệu nhạy cảm hoặc secret.
- Hạn chế thay đổi không liên quan trong cùng PR.

### 4. Kiểm tra trước khi tạo PR

Trước khi mở pull request, hãy đảm bảo:

- Build hoặc chạy app thành công.
- Không có lỗi TypeScript lớn.
- Không có log debug nhạy cảm hoặc tạm thời chưa xóa.
- Mô tả thay đổi rõ ràng trong PR.

### 5. Tạo Pull Request

Mô tả PR nên bao gồm:

- Vấn đề cần giải quyết
- Mục tiêu thay đổi
- Các file chính đã sửa
- Nếu có, ảnh chụp hoặc video demo

## Quy tắc chất lượng

- Tôn trọng cấu trúc dự án hiện có.
- Tránh sửa code không cần thiết trong cùng một PR.
- Nếu thay đổi hành vi người dùng hoặc UX, nên giải thích rõ trong mô tả.
- Ưu tiên sự rõ ràng, dễ đọc và dễ bảo trì.

## Báo cáo lỗi

Nếu phát hiện lỗi, vui lòng mở issue với mô tả:

- Môi trường (Windows version, laptop/desktop, cấu hình monitor)
- Bước tái hiện
- Kết quả mong đợi và thực tế
- Log hoặc screenshot nếu cần

## Hợp tác

Chúng tôi hoan nghênh các đóng góp về:

- Cải thiện UX
- Sửa lỗi
- Tối ưu hiệu năng
- Bảo mật và độ tin cậy
- Làm rõ tài liệu

Cảm ơn bạn đã góp phần xây dựng Orbis Agent.
