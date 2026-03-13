# Guía de Instalación

Transcribro — transcripción de audio/video con whisper.cpp, FastAPI y React.

## Requisitos previos

| Herramienta | Versión mínima | Instalación (macOS)     |
|-------------|----------------|-------------------------|
| Python      | 3.11+          | `brew install python`   |
| Node.js     | 18+            | `brew install node`     |
| ffmpeg      | —              | `brew install ffmpeg`   |
| cmake       | —              | `brew install cmake`    |
| Git         | —              | `brew install git`      |

> La compilación de whisper.cpp usa **Metal** (GPU de Apple Silicon). En máquinas Intel o Linux, ajustar las flags de CMake.

## Instalación rápida

Desde la raíz del proyecto:

```bash
bash scripts/setup.sh
```

Esto ejecuta todos los pasos descritos abajo de forma automática.

## Instalación manual

### 1. Compilar whisper.cpp

```bash
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -B build -DWHISPER_METAL=ON
cmake --build build -j --config Release
cd ..
```

### 2. Descargar modelos

```bash
mkdir -p data/models
cd whisper.cpp
bash models/download-ggml-model.sh large-v3
bash models/download-ggml-model.sh medium
bash models/download-ggml-model.sh small
cp models/ggml-large-v3.bin ../data/models/
cp models/ggml-medium.bin ../data/models/
cp models/ggml-small.bin ../data/models/
cd ..
```

Modelos disponibles: `tiny`, `base`, `small`, `medium`, `large-v3`. Más grande = más preciso, más lento.

### 3. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Frontend (React + Vite)

```bash
cd frontend
npm install
cd ..
```

### 5. Configurar variables de entorno

Crear `backend/.env`:

```env
WHISPER_CLI=../whisper.cpp/build/bin/whisper-cli
MODELS_DIR=../data/models
JOBS_DIR=../data/jobs
DEFAULT_MODEL=large-v3
DEFAULT_LANGUAGE=es
WHISPER_THREADS=8
```

| Variable          | Descripción                              | Default     |
|-------------------|------------------------------------------|-------------|
| `WHISPER_CLI`     | Ruta al binario de whisper-cli           | (requerido) |
| `MODELS_DIR`      | Carpeta con los modelos `.bin`           | (requerido) |
| `JOBS_DIR`        | Carpeta de trabajos de transcripción     | (requerido) |
| `DEFAULT_MODEL`   | Modelo a usar por defecto                | `large-v3`  |
| `DEFAULT_LANGUAGE`| Idioma de transcripción                  | `es`        |
| `WHISPER_THREADS` | Hilos de CPU para whisper                | `8`         |

## Levantar el proyecto

```bash
bash scripts/dev.sh
```

O manualmente en dos terminales:

**Terminal 1 — Backend:**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

## URLs

| Servicio       | URL                          |
|----------------|------------------------------|
| Frontend       | http://localhost:5173        |
| Backend API    | http://localhost:8000        |
| API Docs       | http://localhost:8000/docs   |
| Health Check   | http://localhost:8000/api/health |

## Estructura del proyecto

```
transcribro/
├── backend/                    # FastAPI + whisper.cpp (Clean Architecture)
│   ├── main.py                 # Entry point
│   ├── config.py               # Settings (env vars)
│   ├── domain/                 # Entidades y enums
│   │   └── entities.py
│   ├── application/            # Use cases y orquestadores
│   │   └── job_manager.py
│   ├── infrastructure/
│   │   ├── http/routes/        # Endpoints HTTP
│   │   └── services/           # FFmpeg, whisper.cpp, formatter
│   └── tests/
├── frontend/src/               # React + Vite + Tailwind (Clean Architecture)
│   ├── domain/                 # Types
│   ├── application/hooks/      # Custom hooks
│   ├── infrastructure/api/     # Cliente HTTP
│   └── ui/                     # Components y pages
├── data/
│   ├── models/                 # Whisper GGML models (.bin)
│   └── jobs/                   # Transcription job outputs
├── scripts/
│   ├── setup.sh                # Instalación automática
│   └── dev.sh                  # Levantar backend + frontend
└── whisper.cpp/                # Compilado desde source (ignorado en git)
```
