import asyncio
import contextlib
from pathlib import Path

from application.use_cases.create_job import CreateJobUseCase
from application.use_cases.process_job import ProcessJobUseCase
from application.use_cases.retry_job import RetryJobUseCase
from domain.entities import JobMetadata, TranscriptionConfig
from domain.errors import JobNotFoundError
from domain.interfaces import JobRepository
from logger import get_logger

log = get_logger("job_manager")


class JobManager:
    """Thin facade that owns the asyncio.Queue and delegates to use cases.

    All actual business logic lives in the use cases. This class coordinates
    queue-based sequential processing and provides the API that routes call.
    """

    def __init__(
        self,
        repo: JobRepository,
        create_job_uc: CreateJobUseCase,
        process_job_uc: ProcessJobUseCase,
        retry_job_uc: RetryJobUseCase,
    ) -> None:
        self._repo = repo
        self._create_job_uc = create_job_uc
        self._process_job_uc = process_job_uc
        self._retry_job_uc = retry_job_uc
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

    # ── Worker lifecycle ─────────────────────────────────────

    async def start_worker(self) -> None:
        """Start the background worker that processes jobs sequentially."""
        self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop_worker(self) -> None:
        """Signal the worker to stop and wait for it to finish."""
        if self._worker_task is not None:
            self._worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker_task

    async def _worker_loop(self) -> None:
        """Process jobs one at a time from the queue."""
        while True:
            job_id = await self._queue.get()
            try:
                log.info("Processing job %s", job_id)
                await self._process_job_uc.execute(job_id)
                log.info("Job %s completed", job_id)
            except Exception:
                log.exception("Job %s failed with unhandled error", job_id)
            finally:
                self._queue.task_done()

    # ── Queue interface ──────────────────────────────────────

    async def enqueue_job(self, job_id: str) -> None:
        """Add a job to the processing queue."""
        await self._queue.put(job_id)

    # ── Delegated operations ─────────────────────────────────

    def create_job(
        self, filename: str, content: bytes, config: TranscriptionConfig,
    ) -> JobMetadata:
        """Create a new job with uploaded file content."""
        return self._create_job_uc.execute(filename, content, config)

    def get_job(self, job_id: str) -> JobMetadata:
        """Read metadata for a job. Raises JobNotFoundError if not found."""
        metadata = self._repo.get(job_id)
        if metadata is None:
            raise JobNotFoundError(job_id)
        return metadata

    def list_jobs(self, limit: int = 50, offset: int = 0) -> tuple[list[JobMetadata], int]:
        """List all jobs with pagination."""
        return self._repo.list(limit, offset)

    def rename_job(self, job_id: str, display_name: str) -> JobMetadata:
        """Update the display name for a job."""
        return self._repo.update(job_id, display_name=display_name)

    def delete_job(self, job_id: str) -> None:
        """Delete a job and all its files."""
        self._repo.delete(job_id)

    def retry_job(self, job_id: str, resume: bool = False) -> JobMetadata:
        """Reset a failed job for reprocessing."""
        return self._retry_job_uc.execute(job_id, resume=resume)

    def get_job_file(self, job_id: str, fmt: str) -> Path:
        """Return the path to a job output file. Raises if not found."""
        path = self._repo.get_output_file(job_id, fmt)
        if path is None:
            raise FileNotFoundError(f"Output file not found for job {job_id}")
        return path

    def get_partial_transcript(self, job_id: str) -> dict:
        """Return partial transcript segments and combined text."""
        segments = self._repo.get_partial_segments(job_id)
        text = " ".join(s.get("text", "") for s in segments)
        return {"segments": segments, "text": text}
