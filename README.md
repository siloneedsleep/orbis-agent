# Orbis Agent

Tauri v2 + React + Vite + Tailwind + Framer Motion. Ứng dụng chạy trên Windows, có overlay dạng "The Core" và dashboard thị trường / thử nghiệm trạng thái hệ thống.

## Mục tiêu

- Wake/sleep overlay bằng hotkey toàn cục: `Ctrl + Alt + Space`
- Tray icon để bật/tắt Core và mở dashboard
- Overlay window phủ toàn màn hình và có thể ẩn/hiện theo trạng thái
- The Core có nhiều trạng thái animation và logic bay di chuyển giữa màn hình
- Dashboard đọc thông tin hệ thống như quyền admin / thời gian idle và điều khiển demo

## Yêu cầu

- Windows 10/11
- Node.js 20+
- Rust stable + toolchain MSVC
- WebView2 runtime
- Tauri dependencies được cài qua `npm install`

## Chạy app

```bash
npm install
npm run tauri dev
```

- Click trái tray icon: wake / sleep The Core
- Menu tray: `Open dashboard`
- Hotkey mặc định: `Ctrl+Alt+Space`

## Cấu trúc repo

```text
.
├── README.md
├── dashboard.html
├── overlay.html
├── package.json
├── src/
│   ├── core/
│   │   └── TheCore/
│   │       ├── TheCore.tsx
│   │       ├── CoreMover.tsx
│   │       ├── arcPath.ts
│   │       └── index.ts
│   ├── hooks/
│   │   └── useVoicePulse.ts
│   ├── ipc/
│   │   ├── commands.ts
│   │   └── events.ts
│   ├── state/
│   │   ├── coreMachine.ts
│   │   └── geometry.ts
│   ├── windows/
│   │   ├── dashboard/
│   │   │   ├── DashboardApp.tsx
│   │   │   └── main.tsx
│   │   └── overlay/
│   │       ├── OverlayApp.tsx
│   │       ├── OnboardingFlow.tsx
│   │       ├── ChatBar.tsx
│   │       └── main.tsx
│   └── vite-env.d.ts
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   ├── icons/
│   └── src/
│       ├── lib.rs
│       ├── main.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── overlay.rs
│       │   └── system.rs
│       ├── os/
│       │   ├── capture.rs
│       │   ├── elevation.rs
│       │   ├── idle.rs
│       │   ├── input.rs
│       │   ├── mod.rs
│       │   ├── ollama.rs
│       │   └── sandbox.rs
│       └── shell/
│           ├── dashboard.rs
│           ├── mod.rs
│           ├── overlay.rs
│           └── tray.rs
├── vite.config.ts
└── tsconfig.json
```

## Về logic chính

### 1) The Core state machine
File: `src/state/coreMachine.ts`

- `CoreState`: `spawning`, `idle`, `docked`, `listening`, `thinking`, `executing`, `sonic_flying`, `shielded`, `glitched`, `quarantine`, `time_rewind`, `sleeping`
- Có reducer `coreReducer` để xử lý:
  - wake / sleep
  - chuyển trạng thái `thinking`
  - bay đến target màn hình
  - landed / sleep

### 2) Overlay + dashboard UI
File: `src/windows/overlay/OverlayApp.tsx`

- Lắng nghe event wake từ backend
- Tính toán `dock` và `home` theo monitor hiện tại
- Hiển thị `TheCore` trong overlay
- Có onboarding flow và chat bar
- Click vào Core có thể mở chat / interactive mode

File: `src/windows/dashboard/DashboardApp.tsx`

- Hiển thị dashboard trạng thái hệ thống
- Đọc `get_overlay_layout()` và `get_system_info()`
- Gửi demo events như `think`, `idle`, `fly`

### 3) Geometry / monitor positioning
File: `src/state/geometry.ts`

- Chuyển đổi monitor layout sang CSS coordinate
- Tính vị trí docking / home / target cho The Core

### 4) Rust / Tauri backend
File: `src-tauri/src/lib.rs`

- Đăng ký hotkey global `Ctrl+Alt+Space`
- Tạo tray icon và overlay window khi app khởi động
- Đăng ký các Tauri command:
  - `get_overlay_layout`
  - `set_overlay_interactive`
  - `get_system_info`
  - `open_dashboard`
  - `move_mouse_bezier`
  - `move_mouse_normalized`
  - `mouse_click`
  - `send_keystroke`
  - `setup_panic_hook`
  - `capture_screen_region`

File: `src-tauri/src/shell/tray.rs`

- Tạo tray icon
- Menu bao gồm:
  - `Wake / sleep The Core`
  - `Open dashboard`
  - `Quit`

### 5) Windows OS helpers
File: `src-tauri/src/os/*.rs`

- `idle.rs`: đo thời gian không hoạt động
- `elevation.rs`: kiểm tra quyền admin
- `input.rs`: mô phỏng chuột/keyboard
- `capture.rs`: capture vùng màn hình
- `ollama.rs`: tích hợp Ollama / model inference
- `sandbox.rs`: sandbox-related logic
- `input.rs` cũng có logic `setup_panic_hook` (3x ESC → exit)

## Tính năng đã có trong code hiện tại

- Overlay có thể bật/tắt bằng hotkey và tray
- Dashboard demo controller
- The Core animation + flight movement
- Lấy thông tin monitor / layout
- Gắn `isAdmin` để đổi màu core (admin = vàng, user = cyan)
- Idle detection
- Mouse/keyboard automation trong Windows
- Capture screen region
- Onboarding flow và chat UI trong overlay

## Lưu ý

- Repo hiện đang là phiên bản desktop prototype / demo, không phải full agent runtime hoàn chỉnh.
- Một số module như `ollama`, `capture`, `input`, `sandbox` đã có trong code nhưng cần được tích hợp sâu hơn vào flow thực tế của app.

## Kết luận

Đây là một ứng dụng desktop Windows, tập trung vào "The Core" overlay và dashboard thử nghiệm, với phần frontend React/Tailwind và phần backend Tauri/Rust đang được xây dựng cùng lúc.
