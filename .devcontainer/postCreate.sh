#!/usr/bin/env bash
set -euo pipefail
echo "[orbis] Cài Linux deps cho Tauri build (không bắt buộc để chạy Vite)…"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libssl-dev pkg-config build-essential curl wget file \
  || echo "[orbis] Bỏ qua nếu apt fail — vẫn dev Vite được."
npm install
echo "[orbis] postCreate xong."
