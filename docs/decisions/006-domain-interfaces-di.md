# ADR-006: Interfaces de dominio y Dependency Injection

## Estado

Propuesto

## Contexto

La auditoría de Clean Architecture reveló que la capa Application importa directamente de Infrastructure:

```python
# application/job_manager.py (ACTUAL)
from infrastructure.services.audio_extractor import extract_audio, get_media_duration
from infrastructure.services.formatter import format_enriched_json
from infrastructure.services.transcriber import transcribe_audio
from fastapi import UploadFile
from config import settings
```

Esto viola el principio fundamental: **las dependencias apuntan hacia adentro** (Infrastructure → Application → Domain). Actualmente Application depende de Infrastructure, invirtiendo la dirección.

### Problemas adicionales

1. **God service** — `JobManager` tiene ~370 líneas con 6+ responsabilidades (CRUD, cola, pipeline, file I/O, retry, progress)
2. **FastAPI en Application** — `UploadFile` es un concepto HTTP, no de dominio
3. **Sin interfaces** — `domain/` solo tiene entidades, no define contratos/protocols
4. **Sin error hierarchy** — se usan excepciones genéricas de Python (`FileNotFoundError`, `ValueError`)
5. **Config como singleton global** — `from config import settings` en Application acopla a infraestructura

## Decisión

Introducir **Protocols** (PEP 544) en la capa Domain como contratos, e inyectar implementaciones concretas via constructor.

### Nuevos archivos en Domain

```
domain/
  entities.py          # (existente) JobMetadata, TranscriptResult, etc.
  interfaces.py        # (nuevo) Protocols para servicios
  errors.py            # (nuevo) Jerarquía de errores de dominio
```

### Interfaces propuestas

```python
# domain/interfaces.py
from typing import Protocol, Callable

class AudioExtractor(Protocol):
    async def extract(self, input_path: Path, output_path: Path) -> None: ...
    async def get_duration(self, file_path: Path) -> float: ...

class Transcriber(Protocol):
    async def transcribe(
        self,
        audio_path: Path,
        model_path: Path,
        language: str,
        on_progress: Callable[[float], None] | None = None,
        on_segment: Callable[[dict], None] | None = None,
    ) -> TranscriptResult: ...

class Formatter(Protocol):
    def format(self, result: TranscriptResult, formats: list[str]) -> dict[str, str]: ...

class JobRepository(Protocol):
    async def save(self, job: JobMetadata) -> None: ...
    async def get(self, job_id: str) -> JobMetadata | None: ...
    async def list(self, limit: int, offset: int) -> list[JobMetadata]: ...
    async def delete(self, job_id: str) -> None: ...
```

### Errores de dominio

```python
# domain/errors.py
class DomainError(Exception):
    """Base para todos los errores de dominio."""

class JobNotFoundError(DomainError): ...
class InvalidJobStateError(DomainError): ...
class UnsupportedFormatError(DomainError): ...
class ModelNotFoundError(DomainError): ...
class FileSizeExceededError(DomainError): ...
```

### División de JobManager

```
application/
  job_manager.py       → se divide en:
  use_cases/
    create_job.py        # Crear job + guardar archivo
    process_job.py       # Pipeline: extract → transcribe → format
    retry_job.py         # Retry/resume de jobs fallidos
  job_queue.py           # Cola secuencial (asyncio.Queue)
```

Cada use case recibe sus dependencias por constructor:

```python
# application/use_cases/process_job.py
class ProcessJobUseCase:
    def __init__(
        self,
        repo: JobRepository,
        extractor: AudioExtractor,
        transcriber: Transcriber,
        formatter: Formatter,
    ):
        self.repo = repo
        self.extractor = extractor
        self.transcriber = transcriber
        self.formatter = formatter

    async def execute(self, job_id: str) -> JobMetadata:
        job = await self.repo.get(job_id)
        if not job:
            raise JobNotFoundError(job_id)
        # orquestar pipeline...
```

### Composición (wiring)

```python
# infrastructure/http/dependencies.py
from infrastructure.services.audio_extractor import FFmpegAudioExtractor
from infrastructure.services.transcriber import WhisperTranscriber
from infrastructure.services.formatter import WhisperFormatter
from application.use_cases.process_job import ProcessJobUseCase

def get_process_job_use_case() -> ProcessJobUseCase:
    return ProcessJobUseCase(
        repo=FileSystemJobRepository(settings.jobs_path),
        extractor=FFmpegAudioExtractor(),
        transcriber=WhisperTranscriber(settings.whisper_cli_path),
        formatter=WhisperFormatter(),
    )
```

### UploadFile

Se elimina de Application. El route handler lee los bytes y pasa `bytes` + `filename` al use case:

```python
# infrastructure/http/routes/transcription.py
content = await file.read()
await create_job_use_case.execute(filename=file.filename, content=content)
```

## Consecuencias

### Se facilita

- **Testabilidad** — use cases se testean con mocks/fakes simples (implementan Protocol)
- **Inversión de dependencias real** — Application solo conoce abstractions de Domain
- **Cohesión** — cada use case tiene una sola responsabilidad
- **Intercambiabilidad** — reemplazar whisper.cpp por otro motor solo requiere una nueva implementación del Protocol
- **Errores claros** — excepciones de dominio se traducen a HTTP en la frontera (infrastructure)

### Se dificulta

- **Más archivos** — pasa de 1 archivo (`job_manager.py`) a ~6-8 archivos
- **Wiring explícito** — la composición en `dependencies.py` crece
- **Migración** — hay que reescribir `job_manager.py` y actualizar todos los routes que lo usan

### Mitigación

- El proyecto es pequeño (~400 líneas de application logic), la migración es manejable
- La composición explícita es una ventaja a largo plazo: se ve claramente cómo se conectan las piezas
- Los tests existentes guían la migración: si pasan, la refactorización es correcta
