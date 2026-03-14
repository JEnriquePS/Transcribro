# Transcribro

Aplicacion web para transcripcion de video/audio usando whisper.cpp localmente. Procesamiento 100% local con aceleracion Metal (Apple Silicon GPU).

## Features

- Transcripcion de archivos de audio y video (.mp4, .mkv, .avi, .mov, .webm, .mp3, .wav, .flac, .ogg, .m4a)
- Subida individual o por lotes (batch) con drag & drop
- Seleccion de idioma (espanol, ingles, auto-deteccion) y modelo de Whisper
- Progreso en tiempo real por etapa con transcripcion parcial en vivo
- Exportacion en 4 formatos: TXT, JSON, SRT, VTT
- Gestion de modelos: descarga, eliminacion y seleccion de modelo por defecto
- Reintento y reanudacion de trabajos fallidos

## Stack

| Capa | Tecnologia |
|------|-----------|
| Backend | Python==3.12.2, FastAPI==0.135.1, Pydantic==2.12.5, Uvicorn==0.41.0 |
| Frontend | React==19.2.4, Vite==6.4.1, Tailwind CSS==4.2.1, TypeScript==5.9.3, Lucide React==0.460.0 |
| Transcripcion | whisper.cpp (Metal GPU) |
| Audio | FFmpeg |

## Instalacion rapida

```bash
bash scripts/setup.sh
```

Esto compila whisper.cpp, descarga modelos, instala dependencias de backend y frontend, y configura el `.env`.

### Requisitos previos

| Herramienta | Version minima | Instalacion (macOS) |
|-------------|---------------|---------------------|
| Python | 3.12.2 | `brew install python` |
| Node.js | 22.13.1 | `brew install node` |
| FFmpeg | -- | `brew install ffmpeg` |
| cmake | -- | `brew install cmake` |

## Uso

```bash
bash scripts/dev.sh
```

Esto levanta backend (puerto 8000) y frontend (puerto 5173) simultaneamente.

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |
| Health Check | http://localhost:8000/api/health |

## Estructura del proyecto

```
backend/                        # FastAPI API (Clean Architecture)
  domain/                       # Entidades, enums
  application/                  # Use cases, orquestadores
  infrastructure/
    http/routes/                # Endpoints HTTP
    services/                   # FFmpeg, whisper.cpp, formatter
  tests/
frontend/src/                   # React SPA (Clean Architecture)
  domain/                       # Types, validaciones
  application/                  # Hooks, services
  infrastructure/               # Cliente HTTP
  ui/                           # Components, pages
docs/                           # Documentacion
scripts/                        # setup.sh, dev.sh
```

Arquitectura: Clean Architecture con dependencias hacia adentro (Infrastructure -> Application -> Domain). Ver [ADR-004](docs/decisions/004-clean-architecture.md).

## Pipeline de transcripcion

```
PENDING -> EXTRACTING -> TRANSCRIBING -> FORMATTING -> COMPLETED
                                                    -> FAILED (retry/resume)
```

## Desarrollo

```bash
# Backend
cd backend && source .venv/bin/activate
python -m pytest tests/ -v       # Tests
ruff check . --exclude .venv     # Lint
ruff format .                    # Format

# Frontend
cd frontend
npx vitest run                   # Tests
npx eslint .                     # Lint
npx prettier --check .           # Format check
npx tsc --noEmit                 # Type check
```

## Licencia

Uso privado.
