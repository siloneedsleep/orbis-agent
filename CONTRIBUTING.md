# Đóng góp cho Orbis Agent / Contributing to Orbis Agent

**Ngôn ngữ / Language:** [Tiếng Việt](#vietnamese) | [English](#english)

---

## <a id="vietnamese">Tiếng Việt</a>

Cảm ơn bạn đã muốn đóng góp cho dự án Orbis Agent.

### Mục tiêu dự án

Orbis Agent là ứng dụng desktop Tauri + React + Rust, tập trung vào trải nghiệm overlay, tray, hotkey và các chức năng tự động hỗ trợ người dùng trên Windows.

### Quy trình đóng góp

#### 1. Fork và tạo nhánh

- Fork repository về tài khoản cá nhân.
- Tạo nhánh mới theo mô tả rõ ràng, ví dụ: `feature/overlay-hotkey` hoặc `fix/tray-state`.

#### 2. Thiết lập môi trường

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

#### 3. Viết code

- Giữ patch nhỏ, rõ mục tiêu và dễ review.
- Thêm hoặc cập nhật test nếu có liên quan.
- Không commit dữ liệu nhạy cảm hoặc secret.
- Hạn chế thay đổi không liên quan trong cùng PR.

#### 4. Kiểm tra trước khi tạo PR

Trước khi mở pull request, hãy đảm bảo:

- Build hoặc chạy app thành công.
- Không có lỗi TypeScript lớn.
- Không có log debug nhạy cảm hoặc tạm thời chưa xóa.
- Mô tả thay đổi rõ ràng trong PR.

#### 5. Tạo Pull Request

Mô tả PR nên bao gồm:

- Vấn đề cần giải quyết
- Mục tiêu thay đổi
- Các file chính đã sửa
- Nếu có, ảnh chụp hoặc video demo

### Quy tắc chất lượng

- Tôn trọng cấu trúc dự án hiện có.
- Tránh sửa code không cần thiết trong cùng một PR.
- Nếu thay đổi hành vi người dùng hoặc UX, nên giải thích rõ trong mô tả.
- Ưu tiên sự rõ ràng, dễ đọc và dễ bảo trì.

### Báo cáo lỗi

Nếu phát hiện lỗi, vui lòng mở issue với mô tả:

- Môi trường (Windows version, laptop/desktop, cấu hình monitor)
- Bước tái hiện
- Kết quả mong đợi và thực tế
- Log hoặc screenshot nếu cần

### Hợp tác

Chúng tôi hoan nghênh các đóng góp về:

- Cải thiện UX
- Sửa lỗi
- Tối ưu hiệu năng
- Bảo mật và độ tin cậy
- Làm rõ tài liệu

Cảm ơn bạn đã góp phần xây dựng Orbis Agent.

---

## <a id="english">English</a>

Thank you for wanting to contribute to the Orbis Agent project.

### Project Objectives

Orbis Agent is a Tauri + React + Rust desktop application focused on delivering a superior overlay, tray, hotkey, and automation feature experience to support users on Windows.

### Contributing Process

#### 1. Fork and Create a Branch

- Fork the repository to your personal account.
- Create a new branch with a clear description, for example: `feature/overlay-hotkey` or `fix/tray-state`.

#### 2. Set Up Your Environment

Requirements:

- Node.js 20+
- Rust stable
- MSVC toolchain on Windows
- WebView2 runtime

Installation:

```bash
npm install
npm run tauri dev
```

#### 3. Write Code

- Keep patches small, targeted, and easy to review.
- Add or update tests if relevant.
- Do not commit sensitive data or secrets.
- Limit unrelated changes in a single PR.

#### 4. Verify Before Creating a PR

Before opening a pull request, make sure:

- The app builds or runs successfully.
- There are no major TypeScript errors.
- There are no sensitive or temporary debug logs left behind.
- Changes are clearly described in the PR.

#### 5. Create a Pull Request

Your PR description should include:

- The problem being addressed
- The goal of the changes
- Main files that were modified
- If applicable, screenshots or demo video

### Quality Standards

- Respect the existing project structure.
- Avoid unnecessary code changes in a single PR.
- If changes affect user behavior or UX, explain them clearly in the description.
- Prioritize clarity, readability, and maintainability.

### Bug Reporting

If you find a bug, please open an issue with:

- Environment details (Windows version, laptop/desktop, monitor configuration)
- Steps to reproduce
- Expected and actual results
- Logs or screenshots if needed

### What We Welcome

We welcome contributions in:

- UX improvements
- Bug fixes
- Performance optimization
- Security and reliability
- Documentation clarification

Thank you for contributing to building Orbis Agent.
