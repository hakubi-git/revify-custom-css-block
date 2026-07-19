#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/revify-custom-css-block"
DIST_DIR="$ROOT_DIR/dist"
ZIP_NAME="revify-custom-css-block-3.0.0.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
cd "$ROOT_DIR"
zip -r "$DIST_DIR/$ZIP_NAME" "revify-custom-css-block" \
  -x "*/.DS_Store" \
  -x "*/node_modules/*"

echo "$DIST_DIR/$ZIP_NAME"
