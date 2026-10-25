#!/usr/bin/env bash
# Perbarui Gerah dari gerah.zip terbaru dengan SATU perintah:
#
#   bash ~/Downloads/gerah/update.sh
#
# Yang dilakukan:
#   1. mencari gerah.zip terbaru di folder induk proyek dan ~/Downloads
#      (termasuk "gerah(1).zip", dst.)
#   2. menyalin isinya ke folder gerah, TANPA menimpa .env Anda
#   3. membangun ulang image yang berubah dan menjalankan ulang container
#   4. menampilkan status dan log worker terakhir
# Database (volume Docker) tidak tersentuh.
set -euo pipefail

# Jalankan dari salinan sementara, karena skrip ini sendiri ikut diperbarui.
if [[ "${GERAH_UPDATE_COPY:-}" != "1" ]]; then
  tmp="$(mktemp /tmp/gerah-update.XXXXXX.sh)"
  cp "$0" "$tmp"
  GERAH_UPDATE_COPY=1 GERAH_DIR="$(cd "$(dirname "$0")" && pwd)" exec bash "$tmp" "$@"
fi

DIR="${GERAH_DIR}"
PARENT="$(dirname "$DIR")"

# Cari zip terbaru di: folder induk proyek (tempat zip biasa disimpan) dan ~/Downloads.
# Bisa juga ditentukan langsung: bash update.sh "/jalur/ke/gerah.zip"
if [[ -n "${1:-}" ]]; then
  ZIP="$1"
else
  ZIP="$(ls -t "$PARENT"/gerah*.zip "$HOME"/Downloads/gerah*.zip 2>/dev/null | head -1 || true)"
fi

[[ -n "$ZIP" && -f "$ZIP" ]] || {
  echo "✖ gerah.zip tidak ditemukan di:"
  echo "    $PARENT"
  echo "    $HOME/Downloads"
  exit 1; }
command -v unzip >/dev/null || { echo "✖ Pasang dulu: sudo apt install -y unzip"; exit 1; }

echo "▶ Memakai: $ZIP ($(date -r "$ZIP" '+%d-%m-%Y %H:%M'))"
work="$(mktemp -d)"
unzip -q "$ZIP" -d "$work"
[[ -d "$work/gerah" ]] || { echo "✖ Isi zip tidak berisi folder gerah/"; exit 1; }

# Salin semua file baru; .env dan folder hasil build lokal dibiarkan.
if command -v rsync >/dev/null; then
  rsync -a --exclude '.env' --exclude 'node_modules' --exclude 'dist' "$work/gerah/" "$DIR/"
else
  (cd "$work/gerah" && find . -type f ! -name .env -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$DIR/$(dirname "$f")"; cp "$f" "$DIR/$f"; done)
fi
rm -rf "$work"
echo "✔ File diperbarui (.env tetap milik Anda)"

cd "$DIR"
[[ -f .env ]] || { cp .env.example .env; echo "ℹ .env belum ada, dibuat dari .env.example. Isi POSTGRES_PASSWORD lalu jalankan ulang."; exit 1; }

echo "▶ Membangun ulang image (bagian yang tidak berubah memakai cache)…"
docker compose build api web
docker compose up -d --pull never

echo
docker compose ps
echo
echo "▶ Log worker terakhir:"
sleep 5
docker compose logs --tail=5 worker || true
echo
PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2 || true)"
echo "✔ Selesai. Buka http://localhost:${PORT:-8080} lalu tekan Ctrl+Shift+R."
