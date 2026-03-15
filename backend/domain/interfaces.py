from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from pathlib import Path

    from domain.entities import JobMetadata, TranscriptResult


ProgressCallback = Callable[[float], Awaitable[None]]
SegmentCallback = Callable[[float, float, str], Awaitable[None]]


@runtime_checkable
class AudioExtractor(Protocol):
    """Contract for extracting audio from media files."""

    async def extract(
        self,
        input_path: Path,
        output_path: Path,
        total_duration: float | None = None,
        on_progress: ProgressCallback | None = None,
    ) -> float: ...

    async def get_duration(self, file_path: Path) -> float: ...


@runtime_checkable
class Transcriber(Protocol):
    """Contract for transcribing audio files."""

    async def transcribe(
        self,
        audio_path: Path,
        output_dir: Path,
        language: str,
        model_size: str,
        threads: int,
        on_progress: ProgressCallback | None = None,
        on_segment: SegmentCallback | None = None,
        offset_ms: int = 0,
    ) -> TranscriptResult: ...


@runtime_checkable
class Formatter(Protocol):
    """Contract for formatting transcription results."""

    def format(self, result: TranscriptResult) -> str: ...


@runtime_checkable
class JobRepository(Protocol):
    """Contract for persisting and retrieving job metadata."""

    def save(self, job: JobMetadata) -> None: ...

    def get(self, job_id: str) -> JobMetadata | None: ...

    def list(self, limit: int = 50, offset: int = 0) -> tuple[list[JobMetadata], int]: ...

    def delete(self, job_id: str) -> None: ...

    def update(self, job_id: str, **kwargs: object) -> JobMetadata: ...

    def get_output_file(self, job_id: str, fmt: str) -> Path | None: ...

    def get_job_dir(self, job_id: str) -> Path: ...

    def save_file(self, job_id: str, filename: str, content: bytes) -> Path: ...

    def get_partial_segments(self, job_id: str) -> list[dict]: ...

    def save_partial_segments(self, job_id: str, segments: list[dict]) -> None: ...
