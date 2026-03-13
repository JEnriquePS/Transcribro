#!/bin/bash
# scripts/setup.sh — Setup completo para macOS con Apple Silicon

set -e

echo "=== 1. Verificando dependencias del sistema ==="
command -v ffmpeg >/dev/null 2>&1 || { echo "Instalando ffmpeg..."; brew install ffmpeg; }
command -v cmake >/dev/null 2>&1 || { echo "Instalando cmake..."; brew install cmake; }

echo "=== 2. Compilando whisper.cpp con Metal ==="
if [ ! -d "whisper.cpp" ]; then
    git clone https://github.com/ggml-org/whisper.cpp.git
fi
cd whisper.cpp
cmake -B build -DWHISPER_METAL=ON
cmake --build build -j --config Release
cd ..

echo "=== 3. Descargando modelos ==="
mkdir -p data/models
cd whisper.cpp
bash models/download-ggml-model.sh large-v3
bash models/download-ggml-model.sh medium
bash models/download-ggml-model.sh small
cp models/ggml-large-v3.bin ../data/models/
cp models/ggml-medium.bin ../data/models/
cp models/ggml-small.bin ../data/models/
cd ..

echo "=== 4. Setup Backend ==="
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

echo "=== 5. Setup Frontend ==="
cd frontend
npm install
cd ..

echo "=== 6. Creando .env ==="
cat > backend/.env << EOF
WHISPER_CLI=../whisper.cpp/build/bin/whisper-cli
MODELS_DIR=../data/models
JOBS_DIR=../data/jobs
DEFAULT_MODEL=large-v3
DEFAULT_LANGUAGE=es
WHISPER_THREADS=8
EOF

echo "=== 7. Configurando git hooks ==="
git config core.hooksPath .githooks

echo ""
echo "=== Setup completo ==="
echo "Ejecuta: bash scripts/dev.sh"
