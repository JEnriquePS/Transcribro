# Transcribro

Aplicación web para transcripción de video/audio usando whisper.cpp localmente.

## Stack

- **Backend**: Python 3.12.2, FastAPI 0.135.1, Pydantic 2.12.5 (frozen models), Uvicorn 0.41.0
- **Frontend**: React 19.2.4, Vite 6.4.1, Tailwind CSS 4.2.1, TypeScript 5.9.3, Node 22.13.1, Lucide React 0.460.0
- **Transcripción**: whisper.cpp compilado con Metal (Apple Silicon GPU)
- **Extracción de audio**: FFmpeg
- **Diagramas**: Mermaid en docs/

## Arquitectura

Clean Architecture — ver [ADR-004](docs/decisions/004-clean-architecture.md) y `~/.claude/rules/common/architecture/clean.md`

Dependencias apuntan hacia adentro: Infrastructure → Application → Domain.

## Estructura

```
backend/                        # FastAPI API (Clean Architecture)
  main.py                       # Entry point, lifespan
  config.py                     # Settings desde .env
  logger.py                     # Logging setup
  startup.py                    # Validación de dependencias
  domain/                       # Capa interna (cero dependencias externas)
    entities.py                 # JobMetadata, TranscriptResult, etc.
    interfaces.py               # Protocols: AudioExtractor, Transcriber, Formatter, JobRepository
    errors.py                   # DomainError, JobNotFoundError, etc.
    validation.py               # Validación de job_id (path traversal prevention)
  application/                  # Use cases, orquestadores
    job_manager.py              # Facade: cola asyncio + delegación a use cases
    use_cases/
      create_job.py             # Crear job + guardar archivo
      process_job.py            # Pipeline: extract → transcribe → format
      retry_job.py              # Retry/resume de jobs fallidos
  infrastructure/               # Mundo exterior
    http/
      dependencies.py           # Composition root (wiring DI)
      routes/
        transcription.py        # POST /api/transcribe
        jobs.py                 # CRUD /api/jobs
        models.py               # /api/models
    persistence/
      job_repository.py         # FileSystemJobRepository
    services/                   # Wrappers a herramientas externas
      audio_extractor.py        # FFmpegAudioExtractor
      transcriber.py            # WhisperTranscriber
      formatter.py              # WhisperFormatter
  tests/                        # pytest + httpx
frontend/src/                   # React SPA (Clean Architecture)
  index.css                     # Design tokens (@theme) + light/dark mode
  domain/                       # Types, validaciones
    types.ts
  application/                  # Hooks, services
    hooks/useJobPolling.ts
  infrastructure/               # Cliente HTTP
    api/client.ts
  ui/                           # Presentación
    components/                 # Componentes reutilizables
      ThemeToggle.tsx            # Toggle dark/light mode
      ConfirmDialog.tsx          # Modal de confirmación destructiva
      ErrorBoundary.tsx          # Error boundary con fallback UI
    pages/                      # Páginas
      NotFoundPage.tsx           # 404
    App.tsx
docs/                           # Documentación (setup, requisitos, C4, ADRs)
scripts/                        # setup.sh, dev.sh
data/models/                    # Modelos whisper (.bin) — gitignored
data/jobs/                      # Jobs en progreso — gitignored
```

## Comandos

```bash
# Desarrollo
bash scripts/dev.sh              # Levanta backend (8000) + frontend (5173)

# Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000
ruff check . --exclude .venv     # Lint
ruff format .                    # Format
python -m pytest tests/ -v       # Tests (27)

# Frontend
cd frontend
npm run dev                      # Dev server
npx eslint .                     # Lint
npx prettier --check .           # Format check
npx vitest run                   # Tests (23)
npx tsc --noEmit                 # Type check
```

## Convenciones

- **Inmutabilidad**: Pydantic models usan `frozen=True`, nunca mutar objetos
- **Dependency Injection**: use cases reciben Protocols por constructor, se componen en `dependencies.py` — ver [ADR-006](docs/decisions/006-domain-interfaces-di.md)
- **Design tokens**: colores semánticos en `index.css` via `@theme`, dark/light mode — ver [ADR-005](docs/decisions/005-design-tokens-theming.md)
- **Formatos soportados**: .mp4, .mkv, .avi, .mov, .webm, .mp3, .wav, .flac, .ogg, .m4a
- **Job pipeline**: PENDING → EXTRACTING → TRANSCRIBING → FORMATTING → COMPLETED/FAILED
- **Polling HTTP**: el frontend usa polling (no WebSockets) para actualizaciones
- **Cola secuencial**: los jobs se procesan uno a la vez via asyncio.Queue
- **API prefix**: todos los endpoints bajo `/api/`
- **Env config**: backend usa `.env` (nunca commitear)
- **Validación de inputs**: job_id validado con regex `^[a-f0-9]{32}$`, file size enforced contra `max_file_size`
- **Errores sanitizados**: logs internos detallan, API responde mensajes genéricos (nunca paths del sistema)
