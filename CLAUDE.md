# Transcribro

App de escritorio para transcribir video/audio usando whisper.cpp localmente (sin APIs externas). Electron + Node.js en el proceso principal, React en el renderer.

## Stack

- **Desktop**: Electron 41, vite-plugin-electron
- **Main Process**: Node.js, TypeScript, better-sqlite3, Drizzle ORM, electron-store
- **Renderer**: React 19, TypeScript, Vite, Tailwind CSS v4+, Lucide React, Zustand, Sonner (toasts)
- **Transcripción**: whisper.cpp compilado con Metal (Apple Silicon GPU) — bundleado en `resources/bin/`
- **Audio**: FFmpeg — bundleado en `resources/bin/`
- **Tests**: Vitest (main + shared + renderer)

## Arquitectura

Clean Architecture — dependencias apuntan hacia adentro:

```
Infrastructure → Application → Domain
```

```
src/
  shared/           # Tipos, schemas Zod, IPC channels (zero deps externas)
  main/             # Proceso principal Electron (Node.js)
    domain/         # Errores, validación
    application/
      use_cases/    # create-job, process-job, retry-job
      job-queue.ts  # Cola secuencial (reemplaza asyncio.Queue)
    infrastructure/
      ipc/          # Handlers IPC (reemplaza HTTP routes)
        handlers/   # job-handlers, model-handlers, app-handlers
      db/           # SQLite + Drizzle ORM (reemplaza FileSystemJobRepository)
      repositories/ # drizzle-job-repository
      services/     # ffmpeg-audio-extractor, whisper-transcriber, whisper-formatter
      composition-root.ts  # DI wiring (único lugar con tipos concretos)
  preload/          # contextBridge.exposeInMainWorld
  renderer/         # React UI
    infrastructure/ # ipc-client.ts (reemplaza axios)
    application/    # hooks/use-job-polling.ts
    ui/             # components/, pages/
```

## Comandos

```bash
# Desarrollo
npm run dev           # Electron con hot-reload
bash scripts/dev.sh   # Equivalente

# Build y distribución
npm run build         # Compila TypeScript + Vite
npm run dist:mac      # Genera .dmg para arm64 + x64

# Testing y calidad
npm test              # Vitest
npm run typecheck     # tsc --noEmit en todos los tsconfigs
npm run lint          # ESLint

# Base de datos
npm run db:generate   # Drizzle Kit generate
npm run db:migrate    # Drizzle Kit migrate

# Binarios
bash scripts/bundle-binaries.sh  # Copia whisper-cli/ffmpeg a resources/bin/
npm run rebuild                  # Recompila better-sqlite3 para Electron
```

## Convenciones

- **Inmutabilidad**: `readonly` en todos los TypeScript types; `as const` donde aplica
- **DI**: use cases reciben interfaces por constructor; se componen en `composition-root.ts`
- **Servicios son hojas**: nunca se llaman entre sí; los use cases los orquestan
- **job_id**: validar con `validateJobId()` — regex `^[a-f0-9]{32}$`
- **IPC**: todos los canales definidos en `src/shared/ipc-channels.ts`
- **Errores**: logs internos detallan; respuestas IPC usan mensajes genéricos (nunca paths del sistema)
- **Design tokens**: colores semánticos en `src/renderer/index.css` via `@theme`
- **Toasts**: usar `sonner` — solo para resultados de operaciones, nunca para errores de formulario

## Pipeline de jobs

```
PENDING → EXTRACTING → TRANSCRIBING → FORMATTING → COMPLETED
                                                  ↘ FAILED
```

- Cola secuencial via `JobQueue` (asyncio equivalente en Node.js)
- Renderer usa IPC push events (no polling HTTP)
- Progress weights: Extraction 0.05→0.20, Transcription 0.20→0.90, Formatting 0.90→1.00

## Paths de datos (userData)

- **DB**: `~/Library/Application Support/Transcribro/transcribro.db`
- **Jobs**: `~/Library/Application Support/Transcribro/jobs/<jobId>/`
- **Models**: `~/Library/Application Support/Transcribro/models/`
- **Binarios**: `resources/bin/` (bundleados en el `.app`)

## Formatos soportados

Video: `.mp4 .mkv .avi .mov .webm` | Audio: `.mp3 .wav .flac .ogg .m4a`

## Anti-patrones a evitar

- Lógica de negocio en IPC handlers — va en use cases
- Servicio que importa otro servicio — crear use case que los coordine
- Componente React que llama IPC directamente — pasar por hooks en renderer/application/
- Importar tipos concretos de infrastructure fuera de `composition-root.ts`
- Acceder a `process.resourcesPath` fuera de `config.ts`

