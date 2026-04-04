#!/bin/bash
# scripts/setup.sh — Setup inicial para Transcribro (Electron + whisper.cpp)

set -e

cd "$(dirname "$0")/.."

echo "=== 1. Verificando dependencias del sistema ==="
command -v cmake >/dev/null 2>&1 || { echo "Instalando cmake..."; brew install cmake; }
command -v node >/dev/null 2>&1 || { echo "Instala Node.js >= 22 desde https://nodejs.org"; exit 1; }

echo "=== 2. Instalando dependencias npm ==="
npm install

echo "=== 3. Compilando whisper.cpp con Metal ==="
if [ ! -d "whisper.cpp" ]; then
    git clone https://github.com/ggml-org/whisper.cpp.git
fi
cd whisper.cpp
cmake -B build -DWHISPER_METAL=ON
cmake --build build -j --config Release
cd ..

echo "=== 4. Empaquetando binarios en resources/ ==="
bash scripts/bundle-binaries.sh

echo "=== 5. Reconstruyendo módulos nativos para Electron ==="
npm run rebuild

echo ""
echo "Setup completo. Ejecuta 'npm run dev' para iniciar la app."


echo "=== 7. Configurando git hooks ==="
git config core.hooksPath .githooks

echo ""
echo "=== Setup completo ==="
echo "Ejecuta: bash scripts/dev.sh"
