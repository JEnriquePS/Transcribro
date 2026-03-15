import uuid
from datetime import UTC, datetime

from domain.entities import JobMetadata, TranscriptionConfig
from domain.interfaces import JobRepository


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class CreateJobUseCase:
    """Create a new transcription job and save the uploaded file."""

    def __init__(self, repo: JobRepository) -> None:
        self._repo = repo

    def execute(self, filename: str, content: bytes, config: TranscriptionConfig) -> JobMetadata:
        """Create a job directory, persist metadata, and save the uploaded file.

        Accepts raw bytes instead of UploadFile to keep application layer
        free of HTTP framework types.
        """
        job_id = uuid.uuid4().hex

        metadata = JobMetadata(
            job_id=job_id,
            original_filename=filename,
            config=config,
            created_at=_now_iso(),
        )
        self._repo.save(metadata)
        self._repo.save_file(job_id, filename, content)
        return metadata
