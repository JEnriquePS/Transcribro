# Requisitos del Sistema — Transcribro

## 1. Requisitos Funcionales

### 1.1 Gestión de archivos

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-01  | El sistema permite subir un archivo de audio o video para transcripción   |
| RF-02  | El sistema permite subir múltiples archivos en lote (batch)               |
| RF-03  | El sistema valida el tipo de archivo antes de procesarlo                  |
| RF-04  | El sistema acepta los formatos: `.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a` |
| RF-05  | El sistema rechaza archivos que excedan 2 GB                              |
| RF-06  | El sistema soporta carga de archivos mediante drag & drop                 |

### 1.2 Configuración de transcripción

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-07  | El usuario puede seleccionar el idioma: español, inglés o auto-detección  |
| RF-08  | El usuario puede seleccionar el modelo de Whisper: tiny, base, small, medium, large-v3 |
| RF-09  | El sistema advierte si el modelo seleccionado no está descargado          |

### 1.3 Procesamiento de transcripción

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-10  | El sistema extrae el audio del archivo multimedia usando FFmpeg            |
| RF-11  | El sistema transcribe el audio usando whisper.cpp                          |
| RF-12  | El sistema procesa los trabajos de forma secuencial (cola FIFO)            |
| RF-13  | El sistema genera el resultado en 4 formatos: TXT, JSON, SRT, VTT         |
| RF-14  | El JSON enriquecido incluye timestamps legibles por humano                 |

### 1.4 Seguimiento de progreso

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-15  | El sistema reporta progreso por etapa: extracción, transcripción, formateo |
| RF-16  | El sistema reporta progreso general ponderado (0-100%)                     |
| RF-17  | El sistema muestra la transcripción parcial en tiempo real durante el procesamiento |
| RF-18  | La interfaz actualiza el estado automáticamente mediante polling            |

### 1.5 Gestión de trabajos

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-19  | El sistema asigna un ID único (UUID) a cada trabajo                        |
| RF-20  | El usuario puede ver la lista de todos los trabajos                        |
| RF-21  | El usuario puede ver el detalle de un trabajo específico                   |
| RF-22  | El usuario puede eliminar un trabajo y todos sus archivos asociados        |
| RF-23  | El usuario puede reintentar un trabajo fallido desde el inicio             |
| RF-24  | El usuario puede reanudar un trabajo fallido desde el último punto de avance (con 30s de solapamiento) |

### 1.6 Resultados y descarga

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-25  | El usuario puede descargar el resultado en formato TXT, JSON, SRT o VTT   |
| RF-26  | El usuario puede previsualizar el contenido de cada formato en la interfaz |
| RF-27  | El usuario puede copiar el texto transcrito al portapapeles                |
| RF-28  | El visor de segmentos muestra timestamps junto al texto                    |

### 1.7 Gestión de modelos

| ID     | Requisito                                                                 |
|--------|---------------------------------------------------------------------------|
| RF-29  | El sistema lista los modelos disponibles con su tamaño y estado            |
| RF-30  | El usuario puede descargar modelos desde HuggingFace                       |
| RF-31  | El usuario puede cancelar una descarga en progreso                         |
| RF-32  | El usuario puede eliminar un modelo descargado                             |
| RF-33  | El usuario puede establecer el modelo por defecto                          |
| RF-34  | El sistema muestra el progreso de descarga en MB                           |

---

## 2. Requisitos No Funcionales

### 2.1 Rendimiento

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-01  | La extracción de audio convierte a WAV 16kHz mono (PCM 16-bit)           |
| RNF-02  | whisper.cpp se compila con Metal (GPU Apple Silicon) para aceleración     |
| RNF-03  | El número de hilos de CPU es configurable (default: 8)                    |
| RNF-04  | El polling de estado es cada 2s (detalle) y 3s (lista)                    |
| RNF-05  | Timeout de 5 minutos por línea de salida del subprocess de whisper        |

### 2.2 Disponibilidad y recuperación

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-06  | Los segmentos parciales se persisten en disco durante la transcripción    |
| RNF-07  | El último offset se almacena para permitir reanudación tras fallo         |
| RNF-08  | En caso de fallo, se capturan las últimas 20 líneas de stderr             |

### 2.3 Usabilidad

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-09  | La interfaz usa tema oscuro (gray-900) con acentos cyan                   |
| RNF-10  | Los estados del trabajo son identificables por color                      |
| RNF-11  | La transcripción en vivo muestra indicador visual pulsante                |
| RNF-12  | La navegación es accesible con íconos y rutas claras                      |

### 2.4 Compatibilidad

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-13  | El backend corre en macOS con Apple Silicon (Metal GPU)                   |
| RNF-14  | Requiere: Python 3.11+, Node.js 18+, FFmpeg, cmake                       |
| RNF-15  | whisper.cpp se compila desde source (no binario precompilado)             |

### 2.5 Seguridad

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-16  | CORS restringido a `http://localhost:5173`                                |
| RNF-17  | Las variables sensibles se manejan via archivo `.env` (excluido de git)   |
| RNF-18  | El sistema valida extensiones de archivo antes de procesar                |

### 2.6 Mantenibilidad

| ID      | Requisito                                                                |
|---------|--------------------------------------------------------------------------|
| RNF-19  | Backend estructurado en capas: routers, services, models                  |
| RNF-20  | Frontend organizado por feature: pages, components, hooks, api            |
| RNF-21  | Modelos de datos inmutables (Pydantic `frozen=True`, TypeScript `readonly`) |
| RNF-22  | Configuración centralizada via `pydantic-settings` con soporte `.env`     |

---

## 3. Ciclo de vida de un trabajo

```
PENDING ──→ EXTRACTING ──→ TRANSCRIBING ──→ FORMATTING ──→ COMPLETED
   │             │                │               │
   └─────────────┴────────────────┴───────────────┘
                         │
                       FAILED ──→ Retry (desde inicio)
                                  Resume (desde último offset)
```

| Estado        | Descripción                                        | Peso en progreso |
|---------------|----------------------------------------------------|------------------|
| PENDING       | En cola, esperando procesamiento                   | 5%               |
| EXTRACTING    | Extrayendo audio con FFmpeg                        | 15%              |
| TRANSCRIBING  | Transcribiendo con whisper.cpp                     | 70%              |
| FORMATTING    | Generando formatos de salida                       | 10%              |
| COMPLETED     | Listo para descarga                                | —                |
| FAILED        | Error capturado, reintentar disponible             | —                |

---

## 4. Modelos de Whisper

| Modelo    | Tamaño   | Uso recomendado                        |
|-----------|----------|----------------------------------------|
| tiny      | 77 MB    | Pruebas rápidas, baja precisión        |
| base      | 148 MB   | Transcripción básica                   |
| small     | 488 MB   | Balance velocidad/precisión            |
| medium    | 1.5 GB   | Buena precisión general                |
| large-v3  | 3.0 GB   | Máxima precisión, más lento            |
