import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;

// Multi-page: mỗi cửa sổ Tauri (overlay, dashboard) là một entry HTML riêng.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "chrome105", // WebView2 (Chromium)
    sourcemap: false,
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, "overlay.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
      },
    },
  },
});
