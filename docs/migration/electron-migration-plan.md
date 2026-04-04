# Transcribro → Electron Migration Plan

> Full TypeScript desktop app with 100% offline functionality.
> Feature parity with current Python FastAPI + React web app.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Target Project Structure](#target-project-structure)
- [Phase 0: Project Setup](#phase-0-project-setup)
- [Phase 1: Shared Layer](#phase-1-shared-layer)
- [Phase 2: Main Process — Domain + Services](#phase-2-main-process--domain--services)
- [Phase 3: Main Process — Database](#phase-3-main-process--database)
- [Phase 4: Main Process — Application Logic](#phase-4-main-process--application-logic)
- [Phase 5: Renderer Adaptation](#phase-5-renderer-adaptation)
- [Phase 6: Binary Bundling & Distribution](#phase-6-binary-bundling--distribution)
- [Phase 7: Data Migration](#phase-7-data-migration)
- [Appendix A: Python → TypeScript Mapping](#appendix-a-python--typescript-mapping)
- [Appendix B: IPC Channel Registry](#appendix-b-ipc-channel-registry)

---

## Architecture Overview

### Current (Web App)

```
Browser (React) ──HTTP REST──► FastAPI (Python) ──child_process──► whisper-cli / ffmpeg
                                     │
                                FileSystem JSON (data/jobs/)
```

### Target (Electron Desktop)

```
Renderer (React) ──Typed IPC──► Main Process (Node.js/TS) ──child_process──► whisper-cli / ffmpeg
                                        │
                                  SQLite (Drizzle ORM)
```

### Clean Architecture Layers (preserved)

```
┌─────────────────────────────────────────────────────┐
│  shared/       Domain types, Zod schemas, IPC types │  ← zero dependencies
├─────────────────────────────────────────────────────┤
│  main/domain/         Errors, validation            │  ← depends on shared/
├─────────────────────────────────────────────────────┤
│  main/application/    Use cases, JobQueue           │  ← depends on domain
├─────────────────────────────────────────────────────┤
│  main/infrastructure/ DB, IPC handlers, services    │  ← depends on all above
├─────────────────────────────────────────────────────┤
│  renderer/            React UI + Zustand stores     │  ← depends on shared/
└─────────────────────────────────────────────────────┘
```

---

## Target Project Structure

```
transcribro-desktop/
├── package.json                     # Root: Electron + shared deps
├── tsconfig.json                    # Root tsconfig (references)
├── electron-builder.yml             # Packaging config
├── .env.example
├── drizzle.config.ts                # Drizzle Kit config
│
├── src/
│   ├── shared/                      # Shared between main + renderer
│   │   ├── tsconfig.json
│   │   ├── types.ts                 # Domain entities (readonly)
│   │   ├── schemas.ts              # Zod schemas for IPC validation
│   │   ├── ipc-channels.ts         # Channel names + type map
│   │   ├── constants.ts            # File extensions, model names, limits
│   │   └── errors.ts               # Error codes enum
│   │
│   ├── main/                        # Electron main process
│   │   ├── tsconfig.json
│   │   ├── index.ts                 # Entry: create window, register IPC, start queue
│   │   ├── config.ts               # App paths, settings (electron-store)
│   │   │
│   │   ├── domain/
│   │   │   ├── errors.ts           # Domain error classes
│   │   │   └── validation.ts       # validate_job_id, file validation
│   │   │
│   │   ├── application/
│   │   │   ├── job-queue.ts        # Sequential queue (replaces asyncio.Queue)
│   │   │   └── use-cases/
│   │   │       ├── create-job.ts
│   │   │       ├── process-job.ts
│   │   │       └── retry-job.ts
│   │   │
│   │   └── infrastructure/
│   │       ├── ipc/
│   │       │   ├── register.ts     # Register all IPC handlers
│   │       │   ├── handlers/
│   │       │   │   ├── job-handlers.ts
│   │       │   │   ├── model-handlers.ts
│   │       │   │   └── app-handlers.ts
│   │       │   └── ipc-wrapper.ts  # Typed handler helper with Zod validation
│   │       │
│   │       ├── db/
│   │       │   ├── client.ts       # SQLite + Drizzle setup
│   │       │   ├── schema.ts       # Drizzle table definitions
│   │       │   ├── migrate.ts      # Run migrations on startup
│   │       │   └── migrations/     # Drizzle Kit generated SQL
│   │       │
│   │       ├── repositories/
│   │       │   └── drizzle-job-repository.ts
│   │       │
│   │       ├── services/
│   │       │   ├── ffmpeg-audio-extractor.ts
│   │       │   ├── whisper-transcriber.ts
│   │       │   └── whisper-formatter.ts
│   │       │
│   │       └── composition-root.ts  # DI wiring (like dependencies.py)
│   │
│   ├── renderer/                    # React app (Vite)
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── index.css               # Tailwind + design tokens (keep as-is)
│   │   ├── vite-env.d.ts
│   │   │
│   │   ├── infrastructure/
│   │   │   └── ipc-client.ts       # window.electronAPI wrapper
│   │   │
│   │   ├── application/
│   │   │   ├── stores/
│   │   │   │   ├── job-store.ts    # Zustand store for jobs
│   │   │   │   └── model-store.ts  # Zustand store for models
│   │   │   └── hooks/
│   │   │       └── use-job-polling.ts  # Adapted from current (IPC instead of HTTP)
│   │   │
│   │   └── ui/                     # Keep current UI mostly intact
│   │       ├── App.tsx
│   │       ├── components/         # All existing components
│   │       │   ├── ConfirmDialog.tsx
│   │       │   ├── DownloadButtons.tsx
│   │       │   ├── ErrorBoundary.tsx
│   │       │   ├── FileUploader.tsx
│   │       │   ├── JobCard.tsx
│   │       │   ├── LiveTranscript.tsx
│   │       │   ├── ProgressBar.tsx
│   │       │   ├── ThemeToggle.tsx
│   │       │   ├── TranscriptViewer.tsx
│   │       │   └── TranscriptionConfig.tsx
│   │       └── pages/
│   │           ├── UploadPage.tsx
│   │           ├── JobsPage.tsx
│   │           ├── JobDetailPage.tsx
│   │           ├── ModelsPage.tsx
│   │           └── NotFoundPage.tsx
│   │
│   └── preload/
│       ├── tsconfig.json
│       └── index.ts                # contextBridge.exposeInMainWorld
│
├── resources/                       # Bundled binaries
│   ├── bin/
│   │   ├── darwin-arm64/
│   │   │   ├── whisper-cli
│   │   │   └── ffmpeg
│   │   └── darwin-x64/
│   │       ├── whisper-cli
│   │       └── ffmpeg
│   └── icon.icns
│
├── drizzle/                         # Generated migrations
│   └── 0000_initial.sql
│
└── tests/
    ├── main/
    │   ├── services/
    │   │   ├── ffmpeg-audio-extractor.test.ts
    │   │   ├── whisper-transcriber.test.ts
    │   │   └── whisper-formatter.test.ts
    │   ├── use-cases/
    │   │   ├── create-job.test.ts
    │   │   ├── process-job.test.ts
    │   │   └── retry-job.test.ts
    │   ├── repositories/
    │   │   └── drizzle-job-repository.test.ts
    │   └── job-queue.test.ts
    ├── shared/
    │   └── schemas.test.ts
    └── renderer/
        └── components/
            └── FileUploader.test.tsx
```

---

## Phase 0: Project Setup

**Goal**: New Electron project with build tooling for main process, renderer (Vite + React), and shared types. Electron window loads Vite dev server in dev, built files in prod.

### Files to Create

| File | Purpose |
|------|---------|
| `package.json` | Root package with all dependencies |
| `tsconfig.json` | Root tsconfig with project references |
| `src/shared/tsconfig.json` | Shared types compilation |
| `src/main/tsconfig.json` | Main process compilation (Node.js target) |
| `src/renderer/tsconfig.json` | Renderer compilation (DOM target) |
| `src/preload/tsconfig.json` | Preload script compilation |
| `electron-builder.yml` | Packaging configuration |
| `vite.config.ts` | Vite for renderer only |
| `src/main/index.ts` | Electron entry point (skeleton) |
| `src/preload/index.ts` | Preload script (skeleton) |
| `src/renderer/index.html` | HTML entry (moved from frontend/) |
| `src/renderer/main.tsx` | React entry (moved from frontend/) |

### Dependencies

```jsonc
{
  "dependencies": {
    // Electron
    "electron-store": "^10.0.0",

    // Database
    "better-sqlite3": "^11.8.0",
    "drizzle-orm": "^0.39.0",

    // Validation
    "zod": "^3.24.0",

    // Renderer
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "zustand": "^5.0.0",
    "lucide-react": "^0.460.0",
    "sonner": "^2.0.7"
  },
  "devDependencies": {
    // Build
    "electron": "^34.0.0",
    "electron-builder": "^25.1.0",
    "@electron/rebuild": "^3.7.0",
    "vite": "^6.3.0",
    "@vitejs/plugin-react": "^4.7.0",
    "vite-plugin-electron": "^0.31.0",
    "vite-plugin-electron-renderer": "^0.14.0",

    // TypeScript
    "typescript": "^5.7.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",

    // CSS
    "tailwindcss": "^4.2.1",
    "@tailwindcss/vite": "^4.2.1",

    // Testing
    "vitest": "^3.2.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "jsdom": "^28.1.0",

    // Database tooling
    "drizzle-kit": "^0.30.0",

    // Linting
    "eslint": "^10.0.3",
    "prettier": "^3.8.1"
  }
}
```

### Key Implementation Details

**`vite.config.ts`**: Use `vite-plugin-electron` to handle main process + preload compilation alongside the renderer Vite build. In dev mode, the renderer runs on a Vite dev server; the main process loads it via URL. In production, it loads the built `index.html`.

**`src/main/index.ts`** (skeleton):
```typescript
import { app, BrowserWindow } from "electron";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for better-sqlite3 in preload
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
```

**`src/preload/index.ts`** (skeleton):
```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
});
```

**`electron-builder.yml`**:
```yaml
appId: com.transcribro.app
productName: Transcribro
directories:
  buildResources: resources
  output: dist-electron
files:
  - "dist/**/*"
  - "resources/**/*"
mac:
  target:
    - target: dmg
      arch: [arm64, x64]
  category: public.app-category.productivity
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
  extraResources:
    - from: "resources/bin/darwin-${arch}"
      to: "bin"
      filter: ["**/*"]
```

### TypeScript Config Strategy

```jsonc
// Root tsconfig.json — project references only
{
  "references": [
    { "path": "src/shared" },
    { "path": "src/main" },
    { "path": "src/renderer" },
    { "path": "src/preload" }
  ],
  "files": []
}

// src/shared/tsconfig.json — pure types, no runtime
{
  "compilerOptions": {
    "composite": true,
    "outDir": "../../dist/shared",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "noEmit": false
  },
  "include": ["./**/*.ts"]
}

// src/main/tsconfig.json — Node.js target
{
  "compilerOptions": {
    "composite": true,
    "outDir": "../../dist/main",
    "target": "ES2022",
    "module": "CommonJS",  // Electron main still CJS
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "references": [{ "path": "../shared" }],
  "include": ["./**/*.ts"]
}

// src/renderer/tsconfig.json — DOM target
{
  "compilerOptions": {
    "composite": true,
    "outDir": "../../dist/renderer",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "references": [{ "path": "../shared" }],
  "include": ["./**/*.ts", "./**/*.tsx"]
}
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `vite-plugin-electron` version incompatibility | Pin exact version, test build early |
| `better-sqlite3` native module needs rebuild for Electron | Use `@electron/rebuild` in postinstall |
| Preload + contextIsolation complexity | Keep preload minimal — only expose `invoke`/`on` |

### Done Criteria

- [ ] `npm run dev` opens Electron window loading Vite dev server
- [ ] `npm run build` produces packaged `.app` (macOS)
- [ ] Main process, preload, renderer, and shared all compile independently
- [ ] Hot reload works in renderer during dev
- [ ] Empty window renders React "Hello World"

---

## Phase 1: Shared Layer

**Goal**: Port all domain entities from Python Pydantic models to TypeScript readonly types + Zod schemas. Define typed IPC channel map.

### Files to Create

| File | Ported From | Purpose |
|------|-------------|---------|
| `src/shared/types.ts` | `backend/domain/entities.py` + `frontend/src/domain/types.ts` | All domain types (single source of truth) |
| `src/shared/schemas.ts` | (new) | Zod schemas for runtime IPC validation |
| `src/shared/ipc-channels.ts` | (new) | Type-safe IPC channel definitions |
| `src/shared/constants.ts` | `backend/config.py` (partial) | Shared constants |
| `src/shared/errors.ts` | `backend/domain/errors.py` | Error code enum |

### Key Implementation Details

**`src/shared/types.ts`** — merge current `entities.py` + `types.ts`:

```typescript
// All types are readonly (frozen=True equivalence)
export enum JobStatus {
  PENDING = "pending",
  EXTRACTING = "extracting",
  TRANSCRIBING = "transcribing",
  FORMATTING = "formatting",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface TranscriptionConfig {
  readonly model: string;
  readonly language: string;
  readonly threads?: number;
}

export interface JobMetadata {
  readonly id: string;           // was job_id — normalize to 'id'
  readonly originalFilename: string;  // camelCase
  readonly displayName: string | null;
  readonly status: JobStatus;
  readonly config: TranscriptionConfig;
  readonly error: string | null;
  readonly progress: number;
  readonly extractionProgress: number;
  readonly transcriptionProgress: number;
  readonly formattingProgress: number;
  readonly lastOffsetMs: number | null;
  readonly createdAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly durationSeconds: number | null;
}

export interface TranscriptSegment {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface TranscriptResult {
  readonly jobId: string;
  readonly originalFilename: string;
  readonly model: string;
  readonly language: string;
  readonly segments: readonly TranscriptSegment[];
  readonly fullText: string;
}

export interface ModelInfo {
  readonly name: string;
  readonly sizeMb: number;
  readonly available: boolean;
}

export interface PartialTranscript {
  readonly segments: readonly TranscriptSegment[];
  readonly text: string;
}
```

**`src/shared/schemas.ts`** — Zod schemas for IPC validation:

```typescript
import { z } from "zod";

export const jobIdSchema = z.string().regex(/^[a-f0-9]{32}$/);

export const transcriptionConfigSchema = z.object({
  model: z.string().default("large-v3"),
  language: z.string().default("es"),
  threads: z.number().int().positive().optional(),
});

export const createJobInput = z.object({
  filePath: z.string().min(1),     // Local file path (not upload)
  config: transcriptionConfigSchema,
});

export const createBatchInput = z.object({
  filePaths: z.array(z.string().min(1)).min(1),
  config: transcriptionConfigSchema,
});

export const renameJobInput = z.object({
  jobId: jobIdSchema,
  displayName: z.string().min(1).max(255),
});

export const downloadInput = z.object({
  jobId: jobIdSchema,
  format: z.enum(["txt", "json", "srt", "vtt"]),
});

export const retryJobInput = z.object({
  jobId: jobIdSchema,
  resume: z.boolean().default(false),
});

export const paginationInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
```

**`src/shared/ipc-channels.ts`** — typed channel map:

```typescript
import type { z } from "zod";
import type * as schemas from "./schemas";
import type { JobMetadata, ModelInfo, PartialTranscript, TranscriptResult } from "./types";

// Channel name constants
export const IPC = {
  // Jobs
  JOBS_CREATE: "jobs:create",
  JOBS_CREATE_BATCH: "jobs:createBatch",
  JOBS_LIST: "jobs:list",
  JOBS_GET: "jobs:get",
  JOBS_DELETE: "jobs:delete",
  JOBS_RENAME: "jobs:rename",
  JOBS_RETRY: "jobs:retry",
  JOBS_DOWNLOAD: "jobs:download",
  JOBS_PARTIAL_TRANSCRIPT: "jobs:partialTranscript",

  // Models
  MODELS_LIST: "models:list",
  MODELS_SET_DEFAULT: "models:setDefault",
  MODELS_DOWNLOAD: "models:download",
  MODELS_CANCEL_DOWNLOAD: "models:cancelDownload",
  MODELS_DELETE: "models:delete",
  MODELS_STATUS: "models:status",

  // App
  APP_HEALTH: "app:health",
  APP_SELECT_FILES: "app:selectFiles",

  // Events (main → renderer)
  JOB_PROGRESS: "job:progress",
  JOB_COMPLETED: "job:completed",
  JOB_FAILED: "job:failed",
} as const;

// Type map: channel → { input, output }
export interface IpcMap {
  [IPC.JOBS_CREATE]: {
    input: z.infer<typeof schemas.createJobInput>;
    output: JobMetadata;
  };
  [IPC.JOBS_CREATE_BATCH]: {
    input: z.infer<typeof schemas.createBatchInput>;
    output: JobMetadata[];
  };
  [IPC.JOBS_LIST]: {
    input: z.infer<typeof schemas.paginationInput>;
    output: { jobs: JobMetadata[]; total: number };
  };
  [IPC.JOBS_GET]: {
    input: { jobId: string };
    output: { metadata: JobMetadata; result: TranscriptResult | null };
  };
  [IPC.JOBS_DELETE]: {
    input: { jobId: string };
    output: void;
  };
  [IPC.JOBS_RENAME]: {
    input: z.infer<typeof schemas.renameJobInput>;
    output: JobMetadata;
  };
  [IPC.JOBS_RETRY]: {
    input: z.infer<typeof schemas.retryJobInput>;
    output: JobMetadata;
  };
  [IPC.JOBS_DOWNLOAD]: {
    input: z.infer<typeof schemas.downloadInput>;
    output: { filePath: string; fileName: string };
  };
  [IPC.JOBS_PARTIAL_TRANSCRIPT]: {
    input: { jobId: string };
    output: PartialTranscript;
  };
  [IPC.MODELS_LIST]: {
    input: void;
    output: { models: ModelInfo[]; default: string };
  };
  [IPC.MODELS_SET_DEFAULT]: {
    input: { name: string };
    output: void;
  };
  [IPC.MODELS_DOWNLOAD]: {
    input: { name: string };
    output: void;
  };
  [IPC.MODELS_CANCEL_DOWNLOAD]: {
    input: { name: string };
    output: void;
  };
  [IPC.MODELS_DELETE]: {
    input: { name: string };
    output: void;
  };
  [IPC.MODELS_STATUS]: {
    input: { name: string };
    output: { status: string; sizeMb?: number; progressMb?: number };
  };
  [IPC.APP_HEALTH]: {
    input: void;
    output: { status: string; whisperAvailable: boolean; ffmpegAvailable: boolean };
  };
  [IPC.APP_SELECT_FILES]: {
    input: void;
    output: string[];  // Selected file paths
  };
}
```

**`src/shared/constants.ts`**:

```typescript
export const ALLOWED_EXTENSIONS = new Set([
  ".mp4", ".mkv", ".avi", ".mov", ".webm",
  ".mp3", ".wav", ".flac", ".ogg", ".m4a",
]);

export const KNOWN_MODELS = [
  { name: "large-v3", sizeMb: 3094 },
  { name: "medium",   sizeMb: 1533 },
  { name: "small",    sizeMb: 488 },
  { name: "base",     sizeMb: 148 },
  { name: "tiny",     sizeMb: 77 },
] as const;

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
export const JOB_ID_REGEX = /^[a-f0-9]{32}$/;
export const DOWNLOAD_FORMATS = ["txt", "json", "srt", "vtt"] as const;
```

**`src/shared/errors.ts`**:

```typescript
export enum ErrorCode {
  JOB_NOT_FOUND = "JOB_NOT_FOUND",
  INVALID_JOB_STATE = "INVALID_JOB_STATE",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  FILE_SIZE_EXCEEDED = "FILE_SIZE_EXCEEDED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
  EXTRACTION_FAILED = "EXTRACTION_FAILED",
}
```

### Property Naming Convention Change

The migration normalizes from Python snake_case to TypeScript camelCase:

| Python | TypeScript |
|--------|-----------|
| `job_id` | `id` |
| `original_filename` | `originalFilename` |
| `display_name` | `displayName` |
| `extraction_progress` | `extractionProgress` |
| `last_offset_ms` | `lastOffsetMs` |
| `created_at` | `createdAt` |
| `full_text` | `fullText` |
| `size_mb` | `sizeMb` |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Renderer references old `job_id` / snake_case | Global find-replace in Phase 5; the DB layer maps column names |
| Zod validation overhead on every IPC call | Negligible; Zod is fast for simple shapes |

### Done Criteria

- [ ] All types compile with `tsc --noEmit`
- [ ] Zod schemas match type definitions (test round-trip)
- [ ] `IpcMap` covers every channel in `IPC` constant
- [ ] No runtime dependencies in shared/ (only Zod as peer)
- [ ] Unit tests for all Zod schemas (`tests/shared/schemas.test.ts`)

---

## Phase 2: Main Process — Domain + Services

**Goal**: Port Python services to TypeScript using `child_process.spawn`. Port domain errors and validation.

### Files to Create

| File | Ported From |
|------|-------------|
| `src/main/domain/errors.ts` | `backend/domain/errors.py` |
| `src/main/domain/validation.ts` | `backend/domain/validation.py` |
| `src/main/infrastructure/services/ffmpeg-audio-extractor.ts` | `backend/infrastructure/services/audio_extractor.py` |
| `src/main/infrastructure/services/whisper-transcriber.ts` | `backend/infrastructure/services/transcriber.py` |
| `src/main/infrastructure/services/whisper-formatter.ts` | `backend/infrastructure/services/formatter.py` |
| `src/main/config.ts` | `backend/config.py` |

### Key Implementation Details

**`src/main/domain/errors.ts`** — port from Python:

```typescript
import { ErrorCode } from "../../shared/errors";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class JobNotFoundError extends DomainError {
  constructor(public readonly jobId: string) {
    super(`Job not found: ${jobId}`, ErrorCode.JOB_NOT_FOUND);
  }
}

export class InvalidJobStateError extends DomainError {
  constructor(jobId: string, currentState: string, expectedStates: string[]) {
    super(
      `Job ${jobId} is in state ${currentState}, expected one of ${expectedStates.join(", ")}`,
      ErrorCode.INVALID_JOB_STATE,
    );
  }
}

export class ModelNotFoundError extends DomainError {
  constructor(modelName: string) {
    super(`Model not available: ${modelName}`, ErrorCode.MODEL_NOT_FOUND);
  }
}
// ... same pattern for UnsupportedFormatError, FileSizeExceededError
```

**`src/main/config.ts`** — uses `electron-store` + `app.getPath()`:

```typescript
import { app } from "electron";
import path from "node:path";
import Store from "electron-store";

const store = new Store<{ defaultModel: string; defaultLanguage: string; whisperThreads: number }>();

function getResourcePath(relativePath: string): string {
  // In dev: project root / resources
  // In prod: process.resourcesPath
  return app.isPackaged
    ? path.join(process.resourcesPath, relativePath)
    : path.join(__dirname, "../../resources", relativePath);
}

const arch = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";

export const config = {
  whisperCliPath: getResourcePath(`bin/whisper-cli`),
  ffmpegPath: getResourcePath(`bin/ffmpeg`),
  ffprobePath: getResourcePath(`bin/ffprobe`),
  modelsDir: path.join(app.getPath("userData"), "models"),
  dbPath: path.join(app.getPath("userData"), "transcribro.db"),
  jobFilesDir: path.join(app.getPath("userData"), "jobs"),

  get defaultModel() { return store.get("defaultModel", "large-v3"); },
  set defaultModel(v: string) { store.set("defaultModel", v); },
  get defaultLanguage() { return store.get("defaultLanguage", "es"); },
  get whisperThreads() { return store.get("whisperThreads", 8); },

  whisper: {
    noSpeechThold: 0.6,
    entropyThold: 2.4,
    logprobThold: -1.0,
    maxContext: 0,
  },
} as const;
```

**`src/main/infrastructure/services/ffmpeg-audio-extractor.ts`** — port from Python async subprocess to Node.js `child_process.spawn`:

```typescript
import { spawn } from "node:child_process";
import { config } from "../../config";

type ProgressCallback = (pct: number) => void;

export class FFmpegAudioExtractor {
  async getDuration(filePath: string): Promise<number> {
    // spawn ffprobe, parse JSON stdout — same logic as Python
  }

  async extract(
    inputPath: string,
    outputPath: string,
    totalDuration?: number,
    onProgress?: ProgressCallback,
  ): Promise<number> {
    // spawn ffmpeg with -progress pipe:1, parse stdout lines
    // Same regex: /out_time_us=(\d+)/
    // Use config.ffmpegPath instead of bare "ffmpeg"
  }
}
```

Key differences from Python port:
- `asyncio.create_subprocess_exec` → `child_process.spawn` (returns `ChildProcess`)
- `process.stdout.readline()` → read `.stdout` stream line by line with a line splitter
- `await process.wait()` → listen for `"close"` event, wrap in Promise
- Progress callbacks are sync (no `await`) since we're on Node.js event loop
- Use **bundled binary paths** from `config.ffmpegPath` instead of system-wide `ffmpeg`

**`src/main/infrastructure/services/whisper-transcriber.ts`** — most complex port:

Port preserves:
- Same regex patterns: `_PROGRESS_RE = /progress\s*=\s*(\d+)%/`, `_SEGMENT_RE` for timestamp parsing
- Same CLI flags: `--max-context 0`, `--no-speech-thold 0.6`, etc.
- Same dual-stream reading: stderr for progress, stdout for segments
- Same `_READLINE_TIMEOUT = 300_000` (5 min)
- Same `_ANSI_RE` cleanup
- Same `_deduplicate_consecutive` logic
- Same `parseWhisperJson` function
- Offset support with `--offset` flag

Key differences:
- `asyncio.create_task(_read_stdout())` → spawn returns streams you can `pipeline()` or read directly
- Two streams read concurrently with `readline` interface or manual line splitting
- Uses bundled `config.whisperCliPath`

**`src/main/infrastructure/services/whisper-formatter.ts`** — straightforward port:

```typescript
export function formatTimestampDisplay(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
               : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatEnrichedJson(result: TranscriptResult): string {
  // Same enrichment logic — add start_formatted, end_formatted to segments
  return JSON.stringify(enriched, null, 2);
}
```

### Service Interface Contracts

Keep the same Protocol pattern but as TypeScript interfaces in `src/main/domain/`:

```typescript
// These DON'T need a separate file in Phase 2 — the concrete classes implement them.
// But if you want to keep the Protocol pattern for DI:

export interface AudioExtractor {
  getDuration(filePath: string): Promise<number>;
  extract(
    inputPath: string,
    outputPath: string,
    totalDuration?: number,
    onProgress?: (pct: number) => void,
  ): Promise<number>;
}

export interface Transcriber {
  transcribe(opts: TranscribeOptions): Promise<TranscriptResult>;
}

export interface Formatter {
  format(result: TranscriptResult): string;
}
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Stderr parsing regex differences between platforms | Port regex verbatim; test with recorded whisper-cli output |
| `spawn` stream handling more complex than Python `readline()` | Use `readline.createInterface` on child streams |
| Bundled binaries not found in dev mode | `config.ts` handles dev vs packaged paths |
| 5-min timeout on readline needs careful Promise wrapper | Implement with `AbortController` + `setTimeout` |

### Done Criteria

- [ ] `FFmpegAudioExtractor` can get duration and extract audio from a test video
- [ ] `WhisperTranscriber` can transcribe a test WAV and return `TranscriptResult`
- [ ] Progress callbacks fire correctly during extraction and transcription
- [ ] Segment callbacks fire during transcription (stdout parsing)
- [ ] `WhisperFormatter` output matches Python formatter output byte-for-byte
- [ ] Domain errors throw correct error codes
- [ ] Unit tests for all services with mocked child processes
- [ ] Unit tests for all regex parsers with captured whisper-cli output samples

---

## Phase 3: Main Process — Database

**Goal**: Replace `FileSystemJobRepository` with SQLite via Drizzle ORM. Define schema, migrations, and repository implementation.

### Files to Create

| File | Purpose |
|------|---------|
| `src/main/infrastructure/db/schema.ts` | Drizzle table definitions |
| `src/main/infrastructure/db/client.ts` | SQLite connection setup |
| `src/main/infrastructure/db/migrate.ts` | Run migrations on app start |
| `src/main/infrastructure/repositories/drizzle-job-repository.ts` | Repository implementation |
| `drizzle.config.ts` | Drizzle Kit configuration |

### Dependencies

Already included in Phase 0: `better-sqlite3`, `drizzle-orm`, `drizzle-kit`.

### Key Implementation Details

**`src/main/infrastructure/db/schema.ts`**:

```typescript
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),              // 32-char hex
  originalFilename: text("original_filename").notNull(),
  displayName: text("display_name"),
  status: text("status").notNull().default("pending"),
  model: text("model").notNull().default("large-v3"),
  language: text("language").notNull().default("es"),
  threads: integer("threads"),
  error: text("error"),
  progress: real("progress").notNull().default(0),
  extractionProgress: real("extraction_progress").notNull().default(0),
  transcriptionProgress: real("transcription_progress").notNull().default(0),
  formattingProgress: real("formatting_progress").notNull().default(0),
  lastOffsetMs: integer("last_offset_ms"),
  createdAt: text("created_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  durationSeconds: real("duration_seconds"),
});

export const transcriptSegments = sqliteTable("transcript_segments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  start: real("start").notNull(),
  end: real("end").notNull(),
  text: text("text").notNull(),
  isPartial: integer("is_partial", { mode: "boolean" }).notNull().default(true),
});

export const transcriptResults = sqliteTable("transcript_results", {
  jobId: text("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  language: text("language").notNull(),
  fullText: text("full_text").notNull(),
  enrichedJson: text("enriched_json"),  // The formatted JSON output
});
```

Design decisions:
- **Segments in DB** instead of `partial_segments.json` → enables search across all transcriptions in the future
- **`isPartial` flag** on segments → partial segments (during transcription) vs final segments
- **`transcriptResults`** stores the final enriched JSON + metadata, separate from per-segment data
- **Cascade deletes** → deleting a job deletes all its segments and results
- **Output files** (SRT, VTT, TXT) still stored on filesystem in `config.jobFilesDir` — binary/text output files are better as files

**`src/main/infrastructure/db/client.ts`**:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "../../config";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const sqlite = new Database(config.dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
  }
  return db;
}
```

**`src/main/infrastructure/repositories/drizzle-job-repository.ts`**:

Port from `FileSystemJobRepository` — same interface, SQLite backend:

| FileSystem method | Drizzle equivalent |
|-------------------|--------------------|
| `save()` → write `metadata.json` | `db.insert(jobs).values(...)` |
| `get()` → read `metadata.json` | `db.select().from(jobs).where(eq(jobs.id, id))` |
| `list()` → scan dirs | `db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit().offset()` |
| `delete()` → `shutil.rmtree` | `db.delete(jobs).where(...)` + `fs.rm(jobDir)` |
| `update()` → read-modify-write JSON | `db.update(jobs).set(fields).where(...)` |
| `get_output_file()` → check file exists | Same — still filesystem |
| `save_file()` → write bytes to dir | Same — still filesystem |
| `get_partial_segments()` → read JSON | `db.select().from(transcriptSegments).where(...)` |
| `save_partial_segments()` → write JSON | `db.insert(transcriptSegments).values(...)` |

The repository still manages a `jobFilesDir` on the filesystem for:
- Input files (uploaded video/audio)
- Output files (transcript.srt, .vtt, .txt, .json)
- Extracted audio (audio.wav)

Only metadata and segments move to SQLite.

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `better-sqlite3` native module fails in Electron | Use `@electron/rebuild`; test in packaged app early |
| Schema migration breaking changes | Drizzle Kit generates migration SQL; test with migration from scratch |
| Concurrent writes from queue + IPC reads | SQLite WAL mode handles this; all writes happen in main process (single-threaded) |

### Done Criteria

- [ ] `drizzle-kit generate:sqlite` produces clean migration SQL
- [ ] Migrations run on app startup without errors
- [ ] CRUD operations work: create, read, list (paginated), update, delete
- [ ] Partial segments save/read correctly during transcription
- [ ] Cascade delete removes segments and results when job is deleted
- [ ] Integration tests with in-memory SQLite
- [ ] WAL mode confirmed active

---

## Phase 4: Main Process — Application Logic

**Goal**: Port job queue, use cases, and wire IPC handlers. This phase connects everything.

### Files to Create

| File | Ported From |
|------|-------------|
| `src/main/application/job-queue.ts` | `backend/application/job_manager.py` (queue part) |
| `src/main/application/use-cases/create-job.ts` | `backend/application/use_cases/create_job.py` |
| `src/main/application/use-cases/process-job.ts` | `backend/application/use_cases/process_job.py` |
| `src/main/application/use-cases/retry-job.ts` | `backend/application/use_cases/retry_job.py` |
| `src/main/infrastructure/ipc/ipc-wrapper.ts` | (new) Typed IPC handler helper |
| `src/main/infrastructure/ipc/handlers/job-handlers.ts` | `backend/infrastructure/http/routes/jobs.py` + `transcription.py` |
| `src/main/infrastructure/ipc/handlers/model-handlers.ts` | `backend/infrastructure/http/routes/models.py` |
| `src/main/infrastructure/ipc/handlers/app-handlers.ts` | (new) |
| `src/main/infrastructure/ipc/register.ts` | (new) Register all handlers |
| `src/main/infrastructure/composition-root.ts` | `backend/infrastructure/http/dependencies.py` |

### Key Implementation Details

**`src/main/application/job-queue.ts`** — replaces `asyncio.Queue`:

```typescript
// Sequential job queue using a simple array + processing lock
// Equivalent to Python's asyncio.Queue with single worker

export class JobQueue {
  private queue: string[] = [];
  private processing = false;
  private processJob: (jobId: string) => Promise<void>;

  constructor(processJob: (jobId: string) => Promise<void>) {
    this.processJob = processJob;
  }

  enqueue(jobId: string): void {
    this.queue.push(jobId);
    this.processNext(); // Fire-and-forget
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const jobId = this.queue.shift()!;
    try {
      await this.processJob(jobId);
    } catch (error) {
      // Error handling — job already marked FAILED by use case
    } finally {
      this.processing = false;
      this.processNext(); // Process next in queue
    }
  }
}
```

This is simpler than `asyncio.Queue` because Node.js is single-threaded — no need for explicit async queue primitives. The `processNext()` chain ensures sequential execution.

**`src/main/application/use-cases/process-job.ts`** — largest port:

Preserves:
- Same 3-stage pipeline: EXTRACTING (0.05→0.20) → TRANSCRIBING (0.20→0.90) → FORMATTING (0.90→1.00)
- Same resume logic: skip extraction if `extractionProgress >= 1.0` and audio exists
- Same 30s overlap offset: `Math.max(0, lastOffsetMs - 30_000)`
- Same partial segment filtering on resume
- Same `_make_stage_callback` / `_make_segment_callback` pattern
- Progress callbacks update DB via repository

Key change:
- Use **IPC send** to push progress events to renderer (replaces polling):

```typescript
// In the stage callback, additionally send to renderer:
mainWindow.webContents.send(IPC.JOB_PROGRESS, { jobId, progress, status });
```

This enables real-time progress in the renderer without polling (but we'll keep polling as fallback for stability in Phase 5).

**`src/main/infrastructure/ipc/ipc-wrapper.ts`** — typed handler with Zod validation:

```typescript
import { ipcMain } from "electron";
import { ZodSchema } from "zod";

export function handleIpc<TInput, TOutput>(
  channel: string,
  schema: ZodSchema<TInput> | null,  // null for void input
  handler: (input: TInput) => Promise<TOutput> | TOutput,
): void {
  ipcMain.handle(channel, async (_event, rawInput: unknown) => {
    try {
      const input = schema ? schema.parse(rawInput) : (undefined as TInput);
      return { success: true, data: await handler(input) };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error: { code: error.code, message: error.message } };
      }
      return { success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } };
    }
  });
}
```

Every IPC response is wrapped in `{ success, data } | { success, error }` — consistent error handling.

**`src/main/infrastructure/ipc/handlers/job-handlers.ts`**:

```typescript
// Maps each IPC channel to the appropriate use case / job queue method
// Same logic as routes/jobs.py + routes/transcription.py, but calling use cases directly

export function registerJobHandlers(manager: JobManager): void {
  handleIpc(IPC.JOBS_CREATE, createJobInput, async (input) => {
    // Read file from input.filePath (local path, not upload)
    const content = await fs.readFile(input.filePath);
    const filename = path.basename(input.filePath);
    const metadata = manager.createJob(filename, content, input.config);
    manager.enqueue(metadata.id);
    return metadata;
  });

  handleIpc(IPC.JOBS_LIST, paginationInput, (input) => {
    return manager.listJobs(input.limit, input.offset);
  });

  // ... etc for all job channels
}
```

**`src/main/infrastructure/ipc/handlers/model-handlers.ts`**:

Port from `routes/models.py`. Key change: model download uses `node:https` or bundled `curl` instead of `asyncio.create_subprocess_exec("curl", ...)`. Consider using `electron.net` module for downloads (handles proxy settings automatically).

**`src/main/infrastructure/composition-root.ts`** — same pattern as `dependencies.py`:

```typescript
import { config } from "../config";
import { FFmpegAudioExtractor } from "./services/ffmpeg-audio-extractor";
import { WhisperTranscriber } from "./services/whisper-transcriber";
import { WhisperFormatter } from "./services/whisper-formatter";
import { DrizzleJobRepository } from "./repositories/drizzle-job-repository";
import { CreateJobUseCase } from "../application/use-cases/create-job";
import { ProcessJobUseCase } from "../application/use-cases/process-job";
import { RetryJobUseCase } from "../application/use-cases/retry-job";
import { JobQueue } from "../application/job-queue";

const repo = new DrizzleJobRepository(getDb(), config.jobFilesDir);
const extractor = new FFmpegAudioExtractor(config.ffmpegPath, config.ffprobePath);
const transcriber = new WhisperTranscriber(config.whisperCliPath, config.modelsDir, config.whisper);
const formatter = new WhisperFormatter();

const createJobUc = new CreateJobUseCase(repo);
const processJobUc = new ProcessJobUseCase(repo, extractor, transcriber, formatter, config.whisperThreads);
const retryJobUc = new RetryJobUseCase(repo);

// The JobQueue replaces JobManager — simpler since we don't need the asyncio facade
export const jobQueue = new JobQueue((jobId) => processJobUc.execute(jobId));

export { repo, createJobUc, retryJobUc };
```

### Updated `src/main/index.ts` — full lifecycle:

```typescript
import { app, BrowserWindow } from "electron";
import { runMigrations } from "./infrastructure/db/migrate";
import { registerAllHandlers } from "./infrastructure/ipc/register";

app.whenReady().then(async () => {
  // 1. Run DB migrations
  await runMigrations();

  // 2. Register IPC handlers
  registerAllHandlers();

  // 3. Create window
  createWindow();
});
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Queue losing jobs on app crash | SQLite persists PENDING jobs; on restart, re-enqueue any non-terminal jobs |
| IPC handler errors not reaching renderer | Wrap all handlers in try/catch with structured error response |
| File read for large files (2GB) blocks main process | Use `fs.createReadStream` + pipe, or read in chunks |
| Model download tracking lost on restart | Track download state in SQLite; check partial files on startup |

### Done Criteria

- [ ] Create a job via IPC → file saved to disk, metadata in SQLite, job enqueued
- [ ] Process a job end-to-end: extract → transcribe → format → COMPLETED
- [ ] Progress events sent to renderer during processing
- [ ] Retry with/without resume works correctly
- [ ] List/get/delete/rename jobs via IPC
- [ ] Model list/download/cancel/delete via IPC
- [ ] Error responses use structured `{ success, error }` format
- [ ] Queue processes jobs sequentially (second job waits for first)
- [ ] Integration test: full pipeline from file path to completed transcript

---

## Phase 5: Renderer Adaptation

**Goal**: Replace axios HTTP client with IPC client. Add Zustand stores. Adapt UI for desktop (Electron file dialog instead of drag-and-drop upload via HTTP).

### Files to Modify (adapt from current frontend/)

| Current File | Action | Notes |
|--------------|--------|-------|
| `frontend/src/infrastructure/api/client.ts` | **Replace** → `renderer/infrastructure/ipc-client.ts` | IPC calls instead of axios |
| `frontend/src/application/hooks/useJobPolling.ts` | **Adapt** | Use IPC + optional push events |
| `frontend/src/domain/types.ts` | **Delete** | Use `shared/types.ts` instead |
| `frontend/src/ui/App.tsx` | **Adapt** | Remove `react-router-dom` if using single-window; or keep |
| `frontend/src/ui/components/FileUploader.tsx` | **Adapt** | Use Electron file dialog |
| All other UI components | **Move** | Copy to `renderer/ui/` — minimal changes |

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/infrastructure/ipc-client.ts` | Typed IPC wrapper replacing axios |
| `src/renderer/application/stores/job-store.ts` | Zustand store for job state |
| `src/renderer/application/stores/model-store.ts` | Zustand store for model state |

### Key Implementation Details

**`src/renderer/infrastructure/ipc-client.ts`** — replaces `api/client.ts`:

```typescript
import type { IpcMap, IPC } from "../../shared/ipc-channels";

interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function invoke<C extends keyof IpcMap>(
  channel: C,
  input?: IpcMap[C]["input"],
): Promise<IpcMap[C]["output"]> {
  const response: IpcResponse<IpcMap[C]["output"]> =
    await window.electronAPI.invoke(channel, input);

  if (!response.success) {
    throw new Error(response.error?.message ?? "Unknown error");
  }
  return response.data!;
}

// Public API — same function signatures as current client.ts
export const ipc = {
  createJob: (filePath: string, config: TranscriptionConfig) =>
    invoke(IPC.JOBS_CREATE, { filePath, config }),

  createBatch: (filePaths: string[], config: TranscriptionConfig) =>
    invoke(IPC.JOBS_CREATE_BATCH, { filePaths, config }),

  getJobs: (limit = 50, offset = 0) =>
    invoke(IPC.JOBS_LIST, { limit, offset }),

  getJob: (jobId: string) =>
    invoke(IPC.JOBS_GET, { jobId }),

  deleteJob: (jobId: string) =>
    invoke(IPC.JOBS_DELETE, { jobId }),

  renameJob: (jobId: string, displayName: string) =>
    invoke(IPC.JOBS_RENAME, { jobId, displayName }),

  retryJob: (jobId: string, resume = false) =>
    invoke(IPC.JOBS_RETRY, { jobId, resume }),

  downloadFile: (jobId: string, format: string) =>
    invoke(IPC.JOBS_DOWNLOAD, { jobId, format }),

  getPartialTranscript: (jobId: string) =>
    invoke(IPC.JOBS_PARTIAL_TRANSCRIPT, { jobId }),

  getModels: () => invoke(IPC.MODELS_LIST, undefined),

  selectFiles: () => invoke(IPC.APP_SELECT_FILES, undefined),
  // ... etc
};
```

**`src/renderer/application/stores/job-store.ts`** — Zustand:

```typescript
import { create } from "zustand";
import type { JobMetadata, TranscriptResult } from "../../../shared/types";
import { ipc } from "../../infrastructure/ipc-client";

interface JobState {
  readonly jobs: readonly JobMetadata[];
  readonly isLoading: boolean;
  readonly error: string | null;
  fetchJobs: () => Promise<void>;
  createJob: (filePath: string, config: TranscriptionConfig) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  // ... etc
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const { jobs } = await ipc.getJobs();
      set({ jobs, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  // ... etc
}));
```

**FileUploader adaptation**:

Current behavior: drag-and-drop File objects → FormData → HTTP POST.
New behavior:
1. **Electron file dialog**: click "Select files" → `ipc.selectFiles()` → main process opens `dialog.showOpenDialog` → returns file paths
2. **Drag-and-drop**: Electron allows getting file paths from drop events via `event.dataTransfer.files[i].path`
3. Both return `string[]` (file paths) → send to `ipc.createJob(filePath, config)`

```tsx
// In FileUploader.tsx — simplified
const handleFileSelect = async () => {
  const filePaths = await ipc.selectFiles();
  if (filePaths.length === 0) return;

  for (const filePath of filePaths) {
    await ipc.createJob(filePath, config);
  }
};

// Drag-and-drop still works:
const handleDrop = async (e: DragEvent) => {
  const files = Array.from(e.dataTransfer?.files ?? []);
  const filePaths = files.map((f) => (f as any).path).filter(Boolean);
  // ...
};
```

**Polling adaptation**:

Keep the 2s polling as the primary mechanism (simpler, proven). Optionally listen for IPC push events for instant feedback:

```typescript
// In useJobPolling — add IPC event listener
useEffect(() => {
  const cleanup = window.electronAPI.on(IPC.JOB_PROGRESS, (data) => {
    // Optimistic update from push event
    if (data.jobId === jobId) {
      setMetadata((prev) => prev ? { ...prev, progress: data.progress, status: data.status } : prev);
    }
  });
  return cleanup;
}, [jobId]);
```

### Property Renaming

All UI components need updating from `job_id` / snake_case to `id` / camelCase. Key renames:

| Old | New |
|-----|-----|
| `job.job_id` | `job.id` |
| `job.original_filename` | `job.originalFilename` |
| `job.display_name` | `job.displayName` |
| `job.extraction_progress` | `job.extractionProgress` |
| `job.transcription_progress` | `job.transcriptionProgress` |
| `job.formatting_progress` | `job.formattingProgress` |
| `job.last_offset_ms` | `job.lastOffsetMs` |
| `job.created_at` | `job.createdAt` |
| `job.started_at` | `job.startedAt` |
| `job.completed_at` | `job.completedAt` |
| `job.duration_seconds` | `job.durationSeconds` |
| `result.full_text` | `result.fullText` |
| `result.original_filename` | `result.originalFilename` |
| `model.size_mb` | `model.sizeMb` |

This is a global find-replace across all renderer files.

### Files to Remove (after migration)

- `frontend/src/infrastructure/api/client.ts` — replaced by `ipc-client.ts`
- `frontend/src/domain/types.ts` — moved to `shared/types.ts`
- axios dependency removed from `package.json`

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Property rename breaks UI in subtle ways | `tsc --noEmit` catches all; run after rename |
| `window.electronAPI` not typed | Add `global.d.ts` with type declaration |
| Drag-and-drop `file.path` is Electron-specific | Use type assertion; test in Electron |
| Download files → can't use browser blob download | IPC returns file path; use `shell.showItemInFolder` or `dialog.showSaveDialog` |

### Done Criteria

- [ ] All pages render correctly in Electron window
- [ ] File upload works via Electron dialog
- [ ] Drag-and-drop upload works
- [ ] Job list shows real-time progress updates
- [ ] Download files opens save dialog
- [ ] Theme toggle works
- [ ] All snake_case references eliminated from renderer
- [ ] No axios imports remain
- [ ] TypeScript compiles with zero errors

---

## Phase 6: Binary Bundling & Distribution

**Goal**: Bundle whisper-cli and ffmpeg binaries. Package as macOS DMG.

### Files to Create

| File | Purpose |
|------|---------|
| `scripts/bundle-binaries.sh` | Download/copy binaries to resources/ |
| `resources/entitlements.mac.plist` | macOS entitlements for hardened runtime |
| `resources/icon.icns` | App icon |

### Binary Strategy

**whisper-cli**: Already compiled locally at `whisper.cpp/build/bin/whisper-cli`. The bundle script copies it to `resources/bin/darwin-arm64/whisper-cli`.

**ffmpeg + ffprobe**: Download static builds for the target architecture:
- ARM64: from [ffmpeg.org static builds](https://evermeet.cx/ffmpeg/) or compile
- x64: same source, different arch

**Bundle script** (`scripts/bundle-binaries.sh`):

```bash
#!/bin/bash
ARCH=$(uname -m)
TARGET_DIR="resources/bin/darwin-${ARCH/x86_64/x64}"

mkdir -p "$TARGET_DIR"

# Copy locally compiled whisper-cli
cp whisper.cpp/build/bin/whisper-cli "$TARGET_DIR/"

# Copy system ffmpeg/ffprobe (or download static)
cp "$(which ffmpeg)" "$TARGET_DIR/"
cp "$(which ffprobe)" "$TARGET_DIR/"

chmod +x "$TARGET_DIR"/*
```

### electron-builder.yml (detailed)

```yaml
appId: com.transcribro.app
productName: Transcribro
copyright: "Copyright © 2025"
directories:
  buildResources: resources
  output: dist-electron

files:
  - "dist/**/*"
  - "!dist/**/*.map"

mac:
  target:
    - target: dmg
      arch: [arm64]  # Start with ARM64 only; add x64 later
  icon: resources/icon.icns
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist
  extraResources:
    - from: "resources/bin/darwin-${arch}"
      to: "bin"
      filter: ["**/*"]

dmg:
  title: "Transcribro"
  artifactName: "Transcribro-${version}-${arch}.dmg"
```

### `resources/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

Required for:
- `better-sqlite3` native module
- whisper-cli (Metal GPU access)

### Config Path Resolution

```typescript
// src/main/config.ts — binary path resolution
function getBinaryPath(name: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", name);
  }
  // Dev: use resources/ relative to project root
  const arch = process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  return path.join(__dirname, `../../resources/bin/${arch}/${name}`);
}
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Binary signing/notarization required for macOS distribution | Use `electron-notarize` with Apple Developer certificate |
| whisper-cli Metal requires specific entitlements | Include `cs.allow-unsigned-executable-memory` |
| ffmpeg static binary is large (~80MB) | Accept it; necessary for offline operation |
| x64 vs ARM64 binary mismatch | `arch` variable in electron-builder selects correct binary dir |
| `better-sqlite3` fails in packaged app | `@electron/rebuild` in postinstall; test packaged build |

### Done Criteria

- [ ] `npm run build` produces a DMG
- [ ] DMG installs and launches on macOS (Apple Silicon)
- [ ] Bundled whisper-cli runs and transcribes correctly
- [ ] Bundled ffmpeg extracts audio correctly
- [ ] App size is reasonable (<200MB without models)
- [ ] No "damaged app" or Gatekeeper warnings (with entitlements)

---

## Phase 7: Data Migration

**Goal**: On first launch, migrate existing `data/jobs/` filesystem data to SQLite.

### Files to Create

| File | Purpose |
|------|---------|
| `src/main/infrastructure/db/legacy-migration.ts` | Migrate filesystem JSON to SQLite |

### Migration Logic

```typescript
export async function migrateLegacyData(
  legacyJobsDir: string,  // Original data/jobs/ path
  repo: DrizzleJobRepository,
): Promise<{ migrated: number; failed: number }> {
  // 1. Check if migration already done (store flag in electron-store)
  if (store.get("legacyMigrationComplete")) return { migrated: 0, failed: 0 };

  // 2. Scan legacyJobsDir for job directories
  // 3. For each directory with metadata.json:
  //    a. Read metadata.json → parse as JobMetadata
  //    b. Insert into jobs table (map snake_case → camelCase)
  //    c. Read partial_segments.json → insert as transcript_segments
  //    d. Read transcript.json → insert as transcript_result
  //    e. Copy input.* and transcript.* files to config.jobFilesDir/{job_id}/
  // 4. Set legacyMigrationComplete = true

  return { migrated, failed };
}
```

Property mapping during migration:

```typescript
function mapLegacyJob(raw: Record<string, unknown>): InsertJob {
  return {
    id: raw.job_id as string,
    originalFilename: raw.original_filename as string,
    displayName: (raw.display_name as string) ?? null,
    status: raw.status as string,
    model: (raw.config as any)?.model ?? "large-v3",
    language: (raw.config as any)?.language ?? "es",
    threads: (raw.config as any)?.threads ?? null,
    error: (raw.error as string) ?? null,
    progress: (raw.progress as number) ?? 0,
    extractionProgress: (raw.extraction_progress as number) ?? 0,
    transcriptionProgress: (raw.transcription_progress as number) ?? 0,
    formattingProgress: (raw.formatting_progress as number) ?? 0,
    lastOffsetMs: (raw.last_offset_ms as number) ?? null,
    createdAt: (raw.created_at as string) ?? null,
    startedAt: (raw.started_at as string) ?? null,
    completedAt: (raw.completed_at as string) ?? null,
    durationSeconds: (raw.duration_seconds as number) ?? null,
  };
}
```

### Migration Trigger

Called in `src/main/index.ts` startup sequence:

```typescript
app.whenReady().then(async () => {
  await runMigrations();           // Drizzle schema migrations
  await migrateLegacyData(         // One-time data import
    path.join(__dirname, "../../data/jobs"),
    repo,
  );
  registerAllHandlers();
  createWindow();
});
```

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large number of jobs makes migration slow | Show progress dialog in window; run async |
| Corrupt metadata.json files | Skip with warning, count as failed |
| Migration runs on every launch | Guard with electron-store flag |
| File paths differ between dev and packaged | Use configurable `legacyJobsDir` parameter |

### Done Criteria

- [ ] Migration runs once and converts all existing jobs
- [ ] All job metadata appears correctly in the new app
- [ ] Completed jobs show their transcript results
- [ ] Partial segments are preserved
- [ ] Output files (SRT, VTT, TXT, JSON) accessible for download
- [ ] Migration is idempotent (running again does nothing)
- [ ] Corrupt jobs are skipped with warning log

---

## Appendix A: Python → TypeScript Mapping

| Python Module | TypeScript Module | Notes |
|---------------|-------------------|-------|
| `domain/entities.py` | `shared/types.ts` | Pydantic `frozen=True` → `readonly` |
| `domain/errors.py` | `main/domain/errors.ts` | Exception classes → Error classes with codes |
| `domain/validation.py` | `main/domain/validation.ts` + `shared/schemas.ts` | Regex stays same; Zod adds IPC validation |
| `domain/interfaces.py` | `main/domain/interfaces.ts` (optional) | Protocol → TypeScript interface |
| `application/use_cases/create_job.py` | `main/application/use-cases/create-job.ts` | Near-identical logic |
| `application/use_cases/process_job.py` | `main/application/use-cases/process-job.ts` | Same pipeline, same progress weights |
| `application/use_cases/retry_job.py` | `main/application/use-cases/retry-job.ts` | Near-identical logic |
| `application/job_manager.py` | `main/application/job-queue.ts` | `asyncio.Queue` → array + lock pattern |
| `infrastructure/services/audio_extractor.py` | `main/infrastructure/services/ffmpeg-audio-extractor.ts` | `asyncio.subprocess` → `child_process.spawn` |
| `infrastructure/services/transcriber.py` | `main/infrastructure/services/whisper-transcriber.ts` | Same regex, same flags, `spawn` |
| `infrastructure/services/formatter.py` | `main/infrastructure/services/whisper-formatter.ts` | Identical logic |
| `infrastructure/persistence/job_repository.py` | `main/infrastructure/repositories/drizzle-job-repository.ts` | Filesystem → SQLite |
| `infrastructure/http/dependencies.py` | `main/infrastructure/composition-root.ts` | Same DI pattern |
| `infrastructure/http/routes/transcription.py` | `main/infrastructure/ipc/handlers/job-handlers.ts` | HTTP → IPC |
| `infrastructure/http/routes/jobs.py` | `main/infrastructure/ipc/handlers/job-handlers.ts` | HTTP → IPC |
| `infrastructure/http/routes/models.py` | `main/infrastructure/ipc/handlers/model-handlers.ts` | HTTP → IPC |
| `config.py` | `main/config.ts` | `pydantic-settings` → `electron-store` |
| `startup.py` | Startup check in `main/index.ts` | Binary validation at launch |
| `frontend/src/infrastructure/api/client.ts` | `renderer/infrastructure/ipc-client.ts` | axios → `window.electronAPI.invoke` |
| `frontend/src/application/hooks/useJobPolling.ts` | `renderer/application/hooks/use-job-polling.ts` | IPC + push events |
| `frontend/src/domain/types.ts` | `shared/types.ts` | Single source of truth |

---

## Appendix B: IPC Channel Registry

| Channel | Direction | Input Schema | Response |
|---------|-----------|--------------|----------|
| `jobs:create` | renderer → main | `createJobInput` | `JobMetadata` |
| `jobs:createBatch` | renderer → main | `createBatchInput` | `JobMetadata[]` |
| `jobs:list` | renderer → main | `paginationInput` | `{ jobs, total }` |
| `jobs:get` | renderer → main | `{ jobId }` | `{ metadata, result }` |
| `jobs:delete` | renderer → main | `{ jobId }` | `void` |
| `jobs:rename` | renderer → main | `renameJobInput` | `JobMetadata` |
| `jobs:retry` | renderer → main | `retryJobInput` | `JobMetadata` |
| `jobs:download` | renderer → main | `downloadInput` | `{ filePath, fileName }` |
| `jobs:partialTranscript` | renderer → main | `{ jobId }` | `PartialTranscript` |
| `models:list` | renderer → main | `void` | `{ models, default }` |
| `models:setDefault` | renderer → main | `{ name }` | `void` |
| `models:download` | renderer → main | `{ name }` | `void` |
| `models:cancelDownload` | renderer → main | `{ name }` | `void` |
| `models:delete` | renderer → main | `{ name }` | `void` |
| `models:status` | renderer → main | `{ name }` | `{ status, sizeMb?, progressMb? }` |
| `app:health` | renderer → main | `void` | `{ status, whisperAvailable, ffmpegAvailable }` |
| `app:selectFiles` | renderer → main | `void` | `string[]` |
| `job:progress` | main → renderer | — | `{ jobId, progress, status }` |
| `job:completed` | main → renderer | — | `{ jobId }` |
| `job:failed` | main → renderer | — | `{ jobId, error }` |

---

## Execution Summary

| Phase | Est. Files | Dependencies On |
|-------|-----------|-----------------|
| **Phase 0**: Project Setup | ~12 | — |
| **Phase 1**: Shared Layer | 5 | Phase 0 |
| **Phase 2**: Domain + Services | 6 | Phase 1 |
| **Phase 3**: Database | 5 | Phase 1 |
| **Phase 4**: Application Logic | 8 | Phase 2 + 3 |
| **Phase 5**: Renderer | ~15 (mostly moves) | Phase 1 + 4 |
| **Phase 6**: Bundling | 3 | Phase 4 + 5 |
| **Phase 7**: Data Migration | 1 | Phase 3 |

**Parallelizable**: Phase 2 and Phase 3 can run in parallel (both depend only on Phase 1).

**Critical Path**: Phase 0 → Phase 1 → Phase 2 + 3 (parallel) → Phase 4 → Phase 5 → Phase 6.

---

## Decision Log

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| IPC pattern | Typed handlers + Zod | tRPC, raw ipcMain.on | Zod gives validation without tRPC overhead; typed map gives autocomplete |
| Database | SQLite + Drizzle | LevelDB, filesystem JSON | Enables search, proper queries, transactions; Drizzle is type-safe |
| State management | Zustand | Redux, Jotai, React Context | Minimal boilerplate, works well with async IPC |
| Job queue | Array + lock | Bull, better-queue | No Redis needed; single-process, single-threaded Node.js |
| File handling | Local path (no upload) | Electron drag-and-drop File | Desktop app reads files directly; no need for multipart upload |
| Binary bundling | extraResources | asar, compile into app | Binaries must be executable; asar doesn't support that |
| Property naming | camelCase throughout | Keep snake_case for DB | TypeScript convention; DB columns are snake_case via Drizzle mapping |
