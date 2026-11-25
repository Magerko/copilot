#!/bin/sh
# electron-builder names the app in the DMG after productName (Audio Monitor), so the DMG is built here to keep
# the Copilot.app folder name that Finder and Launchpad show.
set -e
APP="${1:-release/mac-arm64/Copilot.app}"
VERSION=$(node -p "require('./package.json').version")
OUT="release/Copilot-$VERSION-arm64.dmg"
STAGE=$(mktemp -d)
chmod 755 "$STAGE"
ditto "$APP" "$STAGE/Copilot.app"
ln -s /Applications "$STAGE/Applications"
rm -f "$OUT"
hdiutil create -quiet -volname "Copilot $VERSION" -srcfolder "$STAGE" -format UDZO -ov "$OUT"
rm -rf "$STAGE"
echo "$OUT"
