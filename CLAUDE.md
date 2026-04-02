# Transcribro

App web para transcribir video/audio usando whisper.cpp localmente (sin APIs externas).

## Stack

- **Backend**: Python 3.12, FastAPI, Pydantic v2, Uvicorn
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4+, Lucide React (Icons), Axios, React Router, Sonner (toasts)
- **Transcripción**: whisper.cpp compilado con Metal (Apple Silicon GPU)
- **Audio**: FFmpeg
- **Tests**: pytest + httpx (backend), Vitest (frontend)

## Arquitectura

Clean Architecture — dependencias apuntan hacia adentro:

```
Infrastructure → Application → Domain
```

```
backend/
  domain/           # Entidades, Protocols, errores, validación (cero deps externas)
  application/      # Use cases + JobManager (orquestador de cola asyncio)
    use_cases/      # create_job, process_job, retry_job
  infrastructure/
    http/
      dependencies.py   # Composition root — único lugar con tipos concretos
      routes/           # transcription.py, jobs.py, models.py
    persistence/        # FileSystemJobRepository
    services/           # FFmpegAudioExtractor, WhisperTranscriber, WhisperFormatter

frontend/src/
  domain/           # types.ts
  application/      # hooks/useJobPolling.ts
  infrastructure/   # api/client.ts
  ui/
    components/     # ThemeToggle, ConfirmDialog, ErrorBoundary
    pages/          # NotFoundPage
    App.tsx
```

## Comandos

```bash
# Desarrollo (levanta backend :8000 + frontend :5173)
bash scripts/dev.sh

# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000
ruff check . --exclude .venv    # lint
ruff format .                   # format
python -m pytest tests/ -v      # tests

# Frontend
cd frontend
npm run dev
npx eslint .
npx vitest run
npx tsc --noEmit
```

## Convenciones

- **Inmutabilidad**: `frozen=True` en todos los Pydantic models; `readonly` en TypeScript
- **DI**: use cases reciben Protocols por constructor; se componen en `dependencies.py`
- **Servicios son hojas**: nunca se llaman entre sí; los use cases los orquestan
- **job_id**: siempre validar con `validate_job_id()` — regex `^[a-f0-9]{32}$`
- **API prefix**: todos los endpoints bajo `/api/`
- **Errores**: logs internos detallan; respuestas API usan mensajes genéricos (nunca paths del sistema)
- **Design tokens**: colores semánticos en `index.css` via `@theme`; nunca primitivos directos
- **Toasts**: usar `sonner` — `toast.success()`, `toast.error()`, `toast.promise()` — solo para resultados de API, nunca para errores de formulario (esos van inline)

## Pipeline de jobs

```
PENDING → EXTRACTING → TRANSCRIBING → FORMATTING → COMPLETED
                                                  ↘ FAILED
```

- Cola secuencial via `asyncio.Queue` — un job a la vez
- Frontend usa polling HTTP (no WebSockets)

## Formatos soportados

Video: `.mp4 .mkv .avi .mov .webm` | Audio: `.mp3 .wav .flac .ogg .m4a`

## Reglas adicionales

- UX y accesibilidad: @.claude/rules/ux.md

## Anti-patrones a evitar

- Lógica de negocio en routes — va en use cases
- Servicio que importa otro servicio — crear use case que los coordine
- Componente React que llama API directamente — pasar por hooks en application/
- Importar tipos concretos de infrastructure fuera de `dependencies.py`
