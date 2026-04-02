from enum import StrEnum

from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    """Possible states for a transcription job."""

    PENDING = "pending"
    EXTRACTING = "extracting"
    TRANSCRIBING = "transcribing"
    FORMATTING = "formatting"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptionConfig(BaseModel):
    """User-provided transcription settings submitted with the upload."""

    model: str = "large-v3"
    language: str = "es"
    threads: int | None = None

    model_config = {"frozen": True}


class JobMetadata(BaseModel):
    """Persisted metadata for a single transcription job."""

    job_id: str
    original_filename: str
    display_name: str | None = None
    status: JobStatus = JobStatus.PENDING
    config: TranscriptionConfig = Field(default_factory=TranscriptionConfig)
    error: str | None = None
    progress: float = 0.0

    # Per-stage progress (0.0 to 1.0)
    extraction_progress: float = 0.0
    transcription_progress: float = 0.0
    formatting_progress: float = 0.0

    # Last transcribed offset before failure (milliseconds)
    last_offset_ms: int | None = None

    # Timestamps
    created_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    duration_seconds: float | None = None

    model_config = {"frozen": True}


class TranscriptSegment(BaseModel):
    """A single timestamped segment from whisper.cpp output."""

    start: float
    end: float
    text: str

    model_config = {"frozen": True}


class TranscriptResult(BaseModel):
    """Enriched JSON transcription result."""

    job_id: str
    original_filename: str
    model: str
    language: str
    segments: list[TranscriptSegment]
    full_text: str

    model_config = {"frozen": True}
