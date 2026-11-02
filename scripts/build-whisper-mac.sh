#!/usr/bin/env bash
# Builds whisper-server with Metal for Apple Silicon and installs it where Copilot looks first:
#   ~/Library/Application Support/copilot/asr/metal/whisper-server
# Alternative without building: brew install whisper-cpp
set -euo pipefail

TAG="${WHISPER_TAG:-b5454}"
DEST="${HOME}/Library/Application Support/copilot/asr/metal"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

command -v cmake >/dev/null || { echo "Нужен cmake: brew install cmake" >&2; exit 1; }

git clone --depth 1 --branch "$TAG" https://github.com/ggml-org/whisper.cpp "$WORK/whisper.cpp"
cmake -S "$WORK/whisper.cpp" -B "$WORK/build" -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_EXAMPLES=ON
cmake --build "$WORK/build" --config Release -j --target whisper-server

mkdir -p "$DEST"
install -m 755 "$WORK/build/bin/whisper-server" "$DEST/whisper-server"
echo "Готово: $DEST/whisper-server"
