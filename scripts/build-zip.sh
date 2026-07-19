#!/usr/bin/env bash
set -euo pipefail

SLUG="revify-custom-css-block"
VERSION="$(php -r '$f=file_get_contents("revify-custom-css-block.php"); preg_match("/Version:\\s*([^\\n]+)/", $f, $m); echo trim($m[1] ?? "0.0.0");')"
DIST_DIR="dist"
PACKAGE_DIR="${DIST_DIR}/${SLUG}"
ZIP_PATH="${DIST_DIR}/${SLUG}-${VERSION}.zip"

rm -rf "${DIST_DIR}"
mkdir -p "${PACKAGE_DIR}"

if [ -f composer.json ] && [ ! -d vendor ]; then
  if command -v composer >/dev/null 2>&1; then
    composer install --no-dev --prefer-dist --optimize-autoloader
  else
    echo "composer が見つかりません。plugin-update-checker を同梱するには composer install が必要です。" >&2
    exit 1
  fi
fi

rsync -a ./ "${PACKAGE_DIR}/" \
  --exclude=".git" \
  --exclude=".github" \
  --exclude="dist" \
  --exclude="scripts" \
  --exclude="node_modules" \
  --exclude=".DS_Store" \
  --exclude=".gitignore" \
  --exclude=".gitattributes" \
  --exclude=".distignore" \
  --exclude="composer.json" \
  --exclude="composer.lock" \
  --exclude="README.md"

(cd "${DIST_DIR}" && zip -qr "${SLUG}-${VERSION}.zip" "${SLUG}")
rm -rf "${PACKAGE_DIR}"

echo "Created: ${ZIP_PATH}"
