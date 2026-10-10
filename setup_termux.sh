#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
log()  { printf '\033[1;36m[orbis]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[orbis]\033[0m %s\n' "$*" >&2; exit 1; }
command -v pkg >/dev/null 2>&1 || die "Chỉ chạy trong Termux."

log "pkg update…"; pkg update -y && pkg upgrade -y
log "Cài toolchain…"
pkg install -y bash coreutils findutils git openssl ca-certificates \
  nodejs-lts python clang make cmake pkg-config rust \
  termux-api ripgrep fd jq
[ -d "$HOME/storage" ] || termux-setup-storage || true

mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
grep -q '.npm-global/bin' "$HOME/.bashrc" 2>/dev/null || \
  echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.npm-global/bin:$PATH"

[ -f package.json ] && npm install || true
log "Xong. Chạy: npm run dev"
