#!/usr/bin/env bash
# bundle-binaries.sh — Copy whisper-cli, ffmpeg, ffprobe to resources/bin/
#
# Usage:
#   bash scripts/bundle-binaries.sh               # auto-detects arch
#   bash scripts/bundle-binaries.sh arm64          # force arm64
#   bash scripts/bundle-binaries.sh x64            # force x64
#
# Outputs:
#   resources/bin/darwin-arm64/  whisper-cli ffmpeg ffprobe
#   resources/bin/darwin-x64/   whisper-cli ffmpeg ffprobe    (if x64 requested)
#
# Dev symlinks (no arch dir):
#   resources/bin/whisper-cli -> darwin-<native>/whisper-cli
#   resources/bin/ffmpeg      -> darwin-<native>/ffmpeg
#   resources/bin/ffprobe     -> darwin-<native>/ffprobe

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESOURCES_BIN="$PROJECT_ROOT/resources/bin"

# ── Resolve architecture ──────────────────────────────────────────────────────
NATIVE_ARCH=$(uname -m)
[[ "$NATIVE_ARCH" == "arm64" ]] && NATIVE_ARCH="arm64" || NATIVE_ARCH="x64"

if [[ ${1:-} == "arm64" ]]; then
  ARCH="arm64"
elif [[ ${1:-} == "x64" ]]; then
  ARCH="x64"
else
  ARCH="$NATIVE_ARCH"
fi

if [[ "$ARCH" != "$NATIVE_ARCH" ]]; then
  echo "⚠ Warning: bundling for $ARCH but running on $NATIVE_ARCH."
  echo "  The copied binaries will be $NATIVE_ARCH — they will not run on $ARCH."
  echo "  For a true cross-arch build, supply $ARCH binaries manually."
  echo ""
fi

TARGET_DIR="$RESOURCES_BIN/darwin-$ARCH"
mkdir -p "$TARGET_DIR"

echo "→ Bundling binaries for darwin-$ARCH into $TARGET_DIR"

# ── whisper-cli ───────────────────────────────────────────────────────────────
WHISPER_CLI="$PROJECT_ROOT/whisper.cpp/build/bin/whisper-cli"
if [[ ! -f "$WHISPER_CLI" ]]; then
  echo "✗ whisper-cli not found at $WHISPER_CLI"
  echo "  Run: cd whisper.cpp && cmake -B build -DWHISPER_METAL=ON && cmake --build build -j"
  exit 1
fi

cp "$WHISPER_CLI" "$TARGET_DIR/whisper-cli"
chmod +x "$TARGET_DIR/whisper-cli"
echo "✓ whisper-cli copied"

# ── ffmpeg ────────────────────────────────────────────────────────────────────
FFMPEG_PATH=$(command -v ffmpeg 2>/dev/null || true)
if [[ -z "$FFMPEG_PATH" ]]; then
  echo "✗ ffmpeg not found in PATH. Install with: brew install ffmpeg"
  exit 1
fi

cp "$(realpath "$FFMPEG_PATH")" "$TARGET_DIR/ffmpeg"
chmod +x "$TARGET_DIR/ffmpeg"
echo "✓ ffmpeg copied from $(realpath "$FFMPEG_PATH")"

# ── ffprobe ───────────────────────────────────────────────────────────────────
FFPROBE_PATH=$(command -v ffprobe 2>/dev/null || true)
if [[ -z "$FFPROBE_PATH" ]]; then
  echo "✗ ffprobe not found in PATH. Install with: brew install ffmpeg"
  exit 1
fi

cp "$(realpath "$FFPROBE_PATH")" "$TARGET_DIR/ffprobe"
chmod +x "$TARGET_DIR/ffprobe"
echo "✓ ffprobe copied from $(realpath "$FFPROBE_PATH")"

# ── Dev symlinks (no arch subdir — used by config.ts in dev mode) ─────────────
echo "→ Creating dev symlinks in resources/bin/"
ln -sf "darwin-$ARCH/whisper-cli" "$RESOURCES_BIN/whisper-cli"
ln -sf "darwin-$ARCH/ffmpeg"      "$RESOURCES_BIN/ffmpeg"
ln -sf "darwin-$ARCH/ffprobe"     "$RESOURCES_BIN/ffprobe"
echo "✓ Symlinks created"

# ── Binary info ───────────────────────────────────────────────────────────────
echo ""
echo "Binary sizes:"
du -sh "$TARGET_DIR"/*
echo ""
echo "Done. resources/bin/darwin-$ARCH/ is ready."
