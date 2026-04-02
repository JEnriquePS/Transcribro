"""Composition root: wire concrete implementations into use cases and managers.

This is the only place in the application that knows about concrete
infrastructure types. Everything else depends on domain Protocols.
"""

from application.job_manager import JobManager
from application.use_cases.create_job import CreateJobUseCase
from application.use_cases.process_job import ProcessJobUseCase
from application.use_cases.retry_job import RetryJobUseCase
from config import settings
from infrastructure.persistence.job_repository import FileSystemJobRepository
from infrastructure.services.audio_extractor import FFmpegAudioExtractor
from infrastructure.services.formatter import WhisperFormatter
from infrastructure.services.transcriber import WhisperTranscriber

# ── Concrete implementations ────────────────────────────────

_job_repo = FileSystemJobRepository(settings.jobs_path)
_extractor = FFmpegAudioExtractor()
_transcriber = WhisperTranscriber(
    whisper_cli_path=settings.whisper_cli_path,
    models_path=settings.models_path,
    no_speech_thold=settings.whisper_no_speech_thold,
)
_formatter = WhisperFormatter()

# ── Use cases ────────────────────────────────────────────────

_create_job_uc = CreateJobUseCase(repo=_job_repo)
_process_job_uc = ProcessJobUseCase(
    repo=_job_repo,
    extractor=_extractor,
    transcriber=_transcriber,
    formatter=_formatter,
    default_threads=settings.whisper_threads,
)
_retry_job_uc = RetryJobUseCase(repo=_job_repo)

# ── Job Manager (singleton) ─────────────────────────────────

_job_manager = JobManager(
    repo=_job_repo,
    create_job_uc=_create_job_uc,
    process_job_uc=_process_job_uc,
    retry_job_uc=_retry_job_uc,
)


def get_job_manager() -> JobManager:
    """Return the application-wide JobManager singleton."""
    return _job_manager
