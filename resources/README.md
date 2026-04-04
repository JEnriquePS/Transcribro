# resources/

This directory holds static assets bundled with the packaged app via electron-builder's `extraResources`.

## Structure

```
resources/
├── bin/
│   ├── darwin-arm64/    ← whisper-cli + ffmpeg + ffprobe (Apple Silicon)
│   └── darwin-x64/      ← whisper-cli + ffmpeg + ffprobe (Intel Mac)
├── entitlements.mac.plist
└── icon.icns
```

## Populating binaries (Phase 6)

Run the bundle script to copy the locally compiled binaries:

```bash
bash scripts/bundle-binaries.sh
```

Or manually:
```bash
mkdir -p resources/bin/darwin-arm64
cp whisper.cpp/build/bin/whisper-cli resources/bin/darwin-arm64/
cp "$(which ffmpeg)" resources/bin/darwin-arm64/
cp "$(which ffprobe)" resources/bin/darwin-arm64/
chmod +x resources/bin/darwin-arm64/*
```
