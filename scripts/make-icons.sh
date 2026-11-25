#!/bin/sh
# Renders assets/icon-src/*.svg into the PNGs app.config.ts points at (macOS: uses sips).
set -e
cd "$(dirname "$0")/.."
for name in icon android-icon-foreground android-icon-background android-icon-monochrome splash-icon; do
  sips -s format png -z 1024 1024 "assets/icon-src/$name.svg" --out "assets/images/$name.png" >/dev/null
  echo "assets/images/$name.png"
done
