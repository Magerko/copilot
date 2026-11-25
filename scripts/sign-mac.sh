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
if security find-certificate -c "$IDENTITY" >/dev/null 2>&1; then
  codesign --force --deep --options runtime --entitlements "$ENT" --sign "$IDENTITY" "$APP"
else
  echo "Нет сертификата «$IDENTITY» — подписываю ad-hoc, разрешения macOS будут слетать после пересборки" >&2
  codesign --force --deep --options runtime --entitlements "$ENT" --sign - "$APP"
fi
codesign --verify --deep "$APP"
codesign -d -r- "$APP" 2>&1 | tail -1
# Spotlight finds the app by "copilot" too, while its visible name stays Audio Monitor. The attribute sits on the
# bundle folder, outside the signature.
KW='<plist version="1.0"><array><string>Copilot</string><string>Копилот</string></array></plist>'
xattr -wx com.apple.metadata:kMDItemKeywords "$(printf '%s' "$KW" | plutil -convert binary1 -o - - | xxd -p | tr -d '\n')" "$APP"
