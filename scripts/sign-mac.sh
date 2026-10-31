#!/bin/sh
# macOS ties privacy permissions (microphone, screen & system audio) to the code signature. An ad-hoc
# signature changes with every build, so permissions break. With a self-signed "Copilot Dev" code-signing
# certificate in the login keychain the signature stays the same across rebuilds.
set -e
APP="${1:-release/mac-arm64/Copilot.app}"
IDENTITY="Copilot Dev"
if security find-certificate -c "$IDENTITY" >/dev/null 2>&1; then
  codesign --force --deep --sign "$IDENTITY" "$APP"
else
  echo "Нет сертификата «$IDENTITY» — подписываю ad-hoc, разрешения macOS будут слетать после пересборки" >&2
  codesign --force --deep --sign - "$APP"
fi
codesign --verify --deep "$APP"
codesign -d -r- "$APP" 2>&1 | tail -1
