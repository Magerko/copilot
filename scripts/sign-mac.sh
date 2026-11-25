#!/bin/sh
# macOS ties privacy permissions (microphone, screen & system audio) to the code signature. An ad-hoc
# signature changes with every build, so permissions break. With a self-signed "Copilot Dev" code-signing
# certificate in the login keychain the signature stays the same across rebuilds.
set -e
APP="${1:-release/mac-arm64/Audio Monitor.app}"
IDENTITY="Copilot Dev"
# The hardened runtime blocks DYLD_INSERT_LIBRARIES and debugger attachment, so other processes can't borrow the
# app's microphone, screen and Keychain access.
ENT="$(dirname "$0")/../resources/entitlements.mac.plist"
# Activity Monitor shows CFBundleName (Audio Monitor), while Finder, Launchpad, Spotlight and the Dock show the
# folder name (Copilot). A CFBundleDisplayName would override both, so the bundle has none.
/usr/libexec/PlistBuddy -c "Delete :CFBundleDisplayName" "$APP/Contents/Info.plist" 2>/dev/null || true
if security find-certificate -c "$IDENTITY" >/dev/null 2>&1; then
  codesign --force --deep --options runtime --entitlements "$ENT" --sign "$IDENTITY" "$APP"
else
  echo "Нет сертификата «$IDENTITY» — подписываю ad-hoc, разрешения macOS будут слетать после пересборки" >&2
  codesign --force --deep --options runtime --entitlements "$ENT" --sign - "$APP"
fi
codesign --verify --deep "$APP"
codesign -d -r- "$APP" 2>&1 | tail -1
# The folder name is outside the signature.
if [ "$(basename "$APP")" = "Audio Monitor.app" ]; then
  DEST="$(dirname "$APP")/Copilot.app"
  rm -rf "$DEST"
  mv "$APP" "$DEST"
  echo "$DEST"
fi
