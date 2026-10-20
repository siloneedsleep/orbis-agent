# Orbis Agent (scaffold)

Tauri v2 + React + Tailwind + Framer Motion. **Chỉ Windows** (WebView2, Win32 API).

## Chạy

Cần: Node 20+, Rust stable (toolchain MSVC), WebView2 runtime.

```bash
npm install
npm run tauri dev
```

- `Ctrl+Alt+Space` hoặc click trái tray icon: The Core bay từ dock lên tâm màn chính / lặn xuống dock.
- Chuột phải tray → **Open dashboard**: bảng thử Thinking / Idle / bay sang màn kế tiếp.
- Đổi hotkey ở `src-tauri/src/lib.rs`.
- Icon hiện tại là placeholder. Tạo bộ icon thật: `npx tauri icon duong-dan/icon-1024.png`.

## Cấu trúc

```text
overlay.html / dashboard.html     entry cho 2 cửa sổ (Vite multi-page)
src/
  core/TheCore/                   TheCore.tsx (idle|thinking|flying), arcPath.ts
  state/coreMachine.ts            reducer: toggle, think, idle, flyTo, landed
  state/geometry.ts               đổi toạ độ monitor, chọn điểm đến chuyến bay
  ipc/                            wrapper có type cho invoke() và event
  windows/overlay/                OverlayApp: host The Core
  windows/dashboard/              DashboardApp: bảng thử nghiệm
src-tauri/
  capabilities/                   overlay chỉ có quyền event; dashboard tương tự
  src/shell/                      overlay.rs, dashboard.rs, tray.rs
  src/os/                         idle.rs (GetLastInputInfo), elevation.rs (IsUserAnAdmin)
  src/commands/                   get_overlay_layout, get_system_info, open_dashboard
```

## Đã có / chưa có

Đã có: overlay trong suốt click-through phủ mọi màn hình, tray, global hotkey,
The Core 3 state, bay cong giữa các màn, màu Cyan/Vàng theo quyền Admin.

Chưa có (theo spec): onboarding, chat bubble và input bar, DXGI capture,
`SendInput` + Bézier/keystroke engine, panic Esc×3, RBAC Tier 3/4, brain Local/Cloud,
Privacy Guard, Handoff modal/toast.

## Giới hạn đã biết

- Overlay hoàn toàn click-through. Muốn bubble/input tương tác phải thêm hit-region
  polling (`window.cursor_position()` + bật/tắt `set_ignore_cursor_events`).
- Overlay là một window phủ cả virtual desktop, đổi px vật lý sang CSS px bằng
  `devicePixelRatio`. Nhiều màn khác DPI scale sẽ bị lệch toạ độ.
- Cắm/rút monitor lúc đang chạy: phải khởi động lại app.
- Overlay không hiện trên game fullscreen exclusive.
