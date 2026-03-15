from domain.entities import JobMetadata, JobStatus
from domain.errors import InvalidJobStateError, JobNotFoundError
from domain.interfaces import JobRepository


class RetryJobUseCase:
    """Reset a failed job for reprocessing."""

    def __init__(self, repo: JobRepository) -> None:
        self._repo = repo

    def execute(self, job_id: str, resume: bool = False) -> JobMetadata:
        """Reset a failed job for reprocessing.

        If resume=True and last_offset_ms exists, keeps extracted audio
        and retries transcription from the last known offset.
        Otherwise, performs a full retry from scratch.
        """
        current = self._repo.get(job_id)
        if current is None:
            raise JobNotFoundError(job_id)

        if current.status != JobStatus.FAILED:
            raise InvalidJobStateError(
                job_id,
                current.status.value,
                [JobStatus.FAILED.value],
            )

        if resume and current.last_offset_ms is not None:
            return self._repo.update(
                job_id,
                status=JobStatus.PENDING,
                error=None,
                progress=0.20,
                extraction_progress=1.0,
                transcription_progress=0.0,
                formatting_progress=0.0,
                started_at=None,
                completed_at=None,
                duration_seconds=None,
            )

        return self._repo.update(
            job_id,
            status=JobStatus.PENDING,
            progress=0.0,
            error=None,
            extraction_progress=0.0,
            transcription_progress=0.0,
            formatting_progress=0.0,
            started_at=None,
            completed_at=None,
            duration_seconds=None,
            last_offset_ms=None,
        )
