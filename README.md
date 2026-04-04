# Transcribro

App de escritorio para transcripción de video/audio usando whisper.cpp localmente. Procesamiento 100% local con aceleración Metal (Apple Silicon GPU). Sin servidores, sin APIs externas.

## Features

- Transcripción de archivos de audio y video (.mp4, .mkv, .avi, .mov, .webm, .mp3, .wav, .flac, .ogg, .m4a)
- Subida individual o por lotes (batch) con drag & drop
- Selección de idioma (español, inglés, auto-detección) y modelo de Whisper
- Progreso en tiempo real por etapa con transcripción parcial en vivo
- Exportación en 4 formatos: TXT, JSON, SRT, VTT
- Gestión de modelos: descarga, eliminación y selección de modelo por defecto
- Reintento y reanudación de trabajos fallidos

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron 41, Node.js |
| Renderer | React 19, Vite 6, Tailwind CSS 4, TypeScript 5 |
| Main Process | TypeScript, better-sqlite3, Drizzle ORM |
| Transcripción | whisper.cpp (Metal GPU) |
| Audio | FFmpeg (bundleado) |

## Instalación

```bash
bash scripts/setup.sh
```

Esto compila whisper.cpp, empaqueta los binarios en `resources/bin/` e instala las dependencias npm.

### Requisitos previos

| Herramienta | Versión mínima | Instalación (macOS) |
|-------------|---------------|---------------------|
| Node.js | 22 | `brew install node` |
| cmake | — | `brew install cmake` |

> FFmpeg y whisper-cli van **bundleados** dentro del `.app`. El usuario final no necesita instalar nada.

## Desarrollo

```bash
npm run dev
```

O equivalente:

```bash
bash scripts/dev.sh
```

## Distribución

```bash
npm run dist:mac
```

Genera un `.dmg` en `dist-app/` para arm64 y x64.

## Estructura del proyecto

```
src/
  shared/         # Tipos, schemas Zod, IPC channels (zero deps)
  main/           # Proceso principal Electron (Node.js)
    domain/       # Errores, validación
    application/  # Use cases, JobQueue
    infrastructure/
      db/         # SQLite + Drizzle ORM
      ipc/        # Handlers IPC
      services/   # FFmpeg, whisper-cli
      repositories/
  renderer/       # React UI
    ui/           # Components, pages
    application/  # Hooks
    infrastructure/ # IPC client
  preload/        # contextBridge
resources/
  bin/            # whisper-cli, ffmpeg, ffprobe (bundleados)
tests/            # Vitest (main + shared)
scripts/          # setup.sh, dev.sh, bundle-binaries.sh
docs/             # ADRs, guías, diagramas
```

## Pipeline de transcripción

```
PENDING → EXTRACTING → TRANSCRIBING → FORMATTING → COMPLETED
                                                  ↘ FAILED (retry/resume)
```

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
