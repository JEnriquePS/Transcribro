# ADR-004: Clean Architecture en lugar de Slice + Clean

## Estado

Aceptado

## Contexto

Al definir la arquitectura del proyecto, se evaluaron dos enfoques organizativos:

1. **Clean Architecture** — organización por capas (domain, application, infrastructure)
2. **Slice + Clean Architecture** — organización por feature con capas Clean dentro de cada slice

Transcribro es un monorepo pequeño (backend + frontend) con 3 features principales:

- **Transcripción**: extracción de audio, transcripción con whisper.cpp, formateo de resultados
- **Gestión de Jobs**: CRUD de trabajos, cola secuencial, retry/resume
- **Gestión de Modelos**: listado, descarga, eliminación de modelos whisper

Los 3 features comparten fuertemente el dominio: `JobMetadata`, `TranscriptResult`, `TranscriptionConfig` son usados transversalmente. El `JobManager` orquesta directamente los servicios de transcripción (audio_extractor, transcriber, formatter).

## Decisión

Usar **Clean Architecture** con organización por capas.

## Consecuencias

### Se facilita

- **Simplicidad** — pocas carpetas, estructura clara para un proyecto pequeño
- **Dominio cohesivo** — las entidades compartidas viven en un solo lugar (`domain/`)
- **Refactoring gradual** — se puede migrar desde la estructura plana actual sin romper funcionalidad
- **Onboarding rápido** — un desarrollador nuevo entiende la estructura en minutos

### Se dificulta

- **Escalabilidad** — si el proyecto crece a 8+ features independientes, las capas se vuelven difíciles de navegar
- **Features independientes** — si aparecen features sin relación con el dominio de transcripción, quedarán mezclados

### Mitigación futura

Si el proyecto crece significativamente, migrar a Slice + Clean es directo: se extraen las capas de cada feature a su propio directorio bajo `features/`.
