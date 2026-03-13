# Diagramas de Secuencia

## 1. Flujo principal: subir y transcribir un archivo

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend API
    participant Q as Job Queue
    participant FF as FFmpeg
    participant W as whisper-cli
    participant FS as File System

    U->>F: Selecciona archivo + configuración
    F->>B: POST /api/transcribe (file, model, language)
    B->>FS: Guarda archivo en data/jobs/{id}/input.*
    B->>FS: Escribe metadata.json (status: PENDING)
    B->>Q: Encola job_id
    B-->>F: 202 {job_id, status: "pending"}
    F-->>U: Redirige a página de detalle

    loop Polling cada 2s
        F->>B: GET /api/jobs/{id}
        B->>FS: Lee metadata.json
        B-->>F: JobMetadata (status, progress)
        F-->>U: Actualiza barra de progreso
    end

    Q->>B: Desencola job_id
    Note over B: Etapa 1: EXTRACTING (5% → 20%)
    B->>FS: Actualiza status → EXTRACTING
    B->>FF: ffmpeg -vn -ar 16000 -ac 1 input.* → audio.wav
    FF-->>B: Progreso via out_time_us
    B->>FS: Guarda audio.wav

    Note over B: Etapa 2: TRANSCRIBING (20% → 90%)
    B->>FS: Actualiza status → TRANSCRIBING
    B->>W: whisper-cli -m model -f audio.wav --print-progress
    loop Por cada segmento detectado
        W-->>B: [00:00:01 --> 00:00:05] texto...
        B->>FS: Actualiza partial_segments.json
    end
    W-->>B: Progreso % via stderr
    W-->>B: Genera transcript.{json,txt,srt,vtt}

    Note over B: Etapa 3: FORMATTING (90% → 100%)
    B->>FS: Actualiza status → FORMATTING
    B->>FS: Enriquece JSON con timestamps legibles
    B->>FS: Actualiza status → COMPLETED

    F->>B: GET /api/jobs/{id}
    B-->>F: status: COMPLETED + result
    F-->>U: Muestra transcripción + botones de descarga
```

## 2. Transcripción en vivo (partial segments)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend API
    participant FS as File System

    Note over F: Job en status TRANSCRIBING

    loop Polling cada 2s
        F->>B: GET /api/jobs/{id}/partial-transcript
        B->>FS: Lee partial_segments.json
        B-->>F: {segments: [...], text: "..."}
        F-->>U: Muestra texto con auto-scroll
    end

    Note over F: Indicador verde pulsante "Live transcript"
```

## 3. Reintentar / reanudar un trabajo fallido

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend API
    participant FS as File System
    participant Q as Job Queue

    Note over FS: metadata.json tiene status: FAILED, last_offset_ms: 180000

    alt Retry desde inicio
        U->>F: Click "Reintentar"
        F->>B: POST /api/jobs/{id}/retry?resume=false
        B->>FS: Reset status → PENDING, progress → 0
        B->>Q: Encola job_id
        Note over B: Re-ejecuta pipeline completo
    else Resume desde último punto
        U->>F: Click "Reanudar"
        F->>B: POST /api/jobs/{id}/retry?resume=true
        B->>FS: Reset status → PENDING, mantiene last_offset_ms
        B->>Q: Encola job_id
        Note over B: Salta extracción (audio.wav existe)
        B->>FS: Transcribe desde offset - 30s (solapamiento)
        Note over B: Filtra segmentos duplicados del solapamiento
    end
```

## 4. Descarga de modelos

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend API
    participant HF as HuggingFace
    participant FS as File System

    U->>F: Click "Descargar" en modelo large-v3
    F->>B: POST /api/models/large-v3/download
    B-->>F: 200 {detail: "Download started"}

    B->>HF: curl https://huggingface.co/.../ggml-large-v3.bin
    B->>FS: Escribe ggml-large-v3.bin.partial

    loop Polling cada 2s
        F->>B: GET /api/models/large-v3/status
        B->>FS: Tamaño de .bin.partial
        B-->>F: {status: "downloading", progress_mb: 1200, size_mb: 3094}
        F-->>U: Barra de progreso (1200 / 3094 MB)
    end

    HF-->>B: Descarga completa
    B->>FS: Renombra .bin.partial → .bin
    F->>B: GET /api/models/large-v3/status
    B-->>F: {status: "ready"}
    F-->>U: Modelo disponible

    opt Cancelar descarga
        U->>F: Click "Cancelar"
        F->>B: DELETE /api/models/large-v3/download
        B->>B: Kill proceso curl
        B->>FS: Elimina .bin.partial
    end
```

## 5. Subida en lote (batch)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend API
    participant Q as Job Queue

    U->>F: Selecciona 3 archivos + configuración
    F->>B: POST /api/transcribe/batch (files[], model, language)

    loop Por cada archivo
        B->>B: Valida extensión
        B->>B: Crea job con UUID
        B->>Q: Encola job_id
    end

    B-->>F: 202 {jobs: [{job_id, status}, {job_id, status}, {job_id, status}]}
    F-->>U: Redirige a lista de trabajos

    Note over Q: Los 3 trabajos se procesan secuencialmente (FIFO)
```
