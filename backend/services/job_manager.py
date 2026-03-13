import asyncio
import contextlib
import json
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile

from config import settings
from logger import get_logger
from models.schemas import (
    JobMetadata,
    JobStatus,
    TranscriptionConfig,
    TranscriptResult,
)
from services.audio_extractor import extract_audio, get_media_duration
from services.formatter import format_enriched_json
from services.transcriber import transcribe_audio

log = get_logger("job_manager")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _compute_duration(started_at: str | None, completed_at: str) -> float | None:
    if started_at is None:
        return None
    start = datetime.fromisoformat(started_at)
    end = datetime.fromisoformat(completed_at)
    return round((end - start).total_seconds(), 2)


class JobManager:
    """Manages transcription jobs with sequential processing via asyncio.Queue."""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None

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
                await self._process_job(job_id)
                log.info("Job %s completed", job_id)
            except Exception:
                log.exception("Job %s failed with unhandled error", job_id)
            finally:
                self._queue.task_done()

    # ── Job CRUD ────────────────────────────────────────────────

    def create_job(self, filename: str, config: TranscriptionConfig) -> JobMetadata:
        """Create a new job directory and initial metadata."""
        job_id = uuid.uuid4().hex
        job_dir = self._job_dir(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)

        metadata = JobMetadata(
            job_id=job_id,
            original_filename=filename,
            config=config,
            created_at=_now_iso(),
        )
        self._write_metadata(metadata)
        return metadata

    def get_job(self, job_id: str) -> JobMetadata:
        """Read metadata for a job. Raises FileNotFoundError if not found."""
        meta_path = self._job_dir(job_id) / "metadata.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Job not found: {job_id}")

        raw = json.loads(meta_path.read_text(encoding="utf-8"))
        return JobMetadata(**raw)

    def list_jobs(self) -> list[JobMetadata]:
        """List all jobs sorted by directory creation time (newest first)."""
        jobs_path = settings.jobs_path
        if not jobs_path.exists():
            return []

        results = []
        for entry in sorted(jobs_path.iterdir(), reverse=True):
            meta_path = entry / "metadata.json"
            if meta_path.exists():
                try:
                    raw = json.loads(meta_path.read_text(encoding="utf-8"))
                    results.append(JobMetadata(**raw))
                except (json.JSONDecodeError, OSError):
                    continue
        return results

    def update_job(self, job_id: str, **kwargs: object) -> JobMetadata:
        """Update job metadata fields immutably. Returns the new metadata."""
        current = self.get_job(job_id)
        updated_data = {**current.model_dump(), **kwargs}
        updated = JobMetadata(**updated_data)
        self._write_metadata(updated)
        return updated

    def delete_job(self, job_id: str) -> None:
        """Delete an entire job directory."""
        job_dir = self._job_dir(job_id)
        if job_dir.exists():
            shutil.rmtree(job_dir)

    def get_job_file(self, job_id: str, fmt: str) -> Path:
        """Return the path to a job output file."""
        file_map = {
            "txt": "transcript.txt",
            "srt": "transcript.srt",
            "vtt": "transcript.vtt",
            "json": "transcript.json",
        }
        filename = file_map.get(fmt)
        if filename is None:
            raise ValueError(f"Unsupported format: {fmt}. Supported: {list(file_map.keys())}")

        file_path = self._job_dir(job_id) / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Output file not found: {file_path}")
        return file_path

    async def save_uploaded_file(self, job_id: str, file: UploadFile) -> Path:
        """Save an uploaded file to the job directory."""
        original_name = file.filename or "input"
        ext = Path(original_name).suffix or ".mp4"
        dest = self._job_dir(job_id) / f"input{ext}"

        content = await file.read()
        dest.write_bytes(content)
        return dest

    # ── Retry ────────────────────────────────────────────────────

    def retry_job(self, job_id: str, resume: bool = False) -> JobMetadata:
        """Reset a failed job for reprocessing.

        If resume=True and last_offset_ms exists, keeps extracted audio
        and retries transcription from the last known offset.
        Otherwise, performs a full retry from scratch.
        """
        current = self.get_job(job_id)
        if current.status != JobStatus.FAILED:
            raise ValueError("Only failed jobs can be retried")

        if resume and current.last_offset_ms is not None:
            return self.update_job(
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

        return self.update_job(
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

    # ── Queue interface ─────────────────────────────────────────

    async def enqueue_job(self, job_id: str) -> None:
        """Add a job to the processing queue."""
        await self._queue.put(job_id)

    # ── Pipeline ────────────────────────────────────────────────

    def _make_stage_callback(
        self,
        job_id: str,
        stage_field: str,
        overall_base: float,
        stage_weight: float,
    ):
        """Create a callback that updates both stage progress and overall progress."""
        async def callback(pct: float) -> None:
            overall = overall_base + pct * stage_weight
            self.update_job(
                job_id,
                **{stage_field: round(pct, 3)},
                progress=round(overall, 3),
            )
        return callback

    def _make_segment_callback(self, job_id: str):
        """Create a callback that saves each transcript segment to partial_segments.json."""
        segments_path = self._job_dir(job_id) / "partial_segments.json"
        segments: list[dict] = []

        # Load existing segments if resuming
        if segments_path.exists():
            try:
                segments = json.loads(segments_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                segments = []

        async def callback(start: float, end: float, text: str) -> None:
            segments.append({"start": start, "end": end, "text": text})
            segments_path.write_text(
                json.dumps(segments, ensure_ascii=False), encoding="utf-8",
            )

        return callback, segments

    async def _process_job(self, job_id: str) -> None:
        """Run the full transcription pipeline for a job.

        Progress ranges:
          FFmpeg extraction : 0.05 → 0.20 (weight 0.15)
          Transcription     : 0.20 → 0.90 (weight 0.70)
          Formatting        : 0.90 → 1.00 (weight 0.10)
        """
        try:
            metadata = self.get_job(job_id)
            job_dir = self._job_dir(job_id)
            config = metadata.config

            self.update_job(job_id, started_at=_now_iso())

            input_files = list(job_dir.glob("input.*"))
            if not input_files:
                raise RuntimeError("No input file found in job directory")
            input_path = input_files[0]

            audio_path = job_dir / "audio.wav"

            # Determine if this is a resume (audio already extracted, has offset)
            is_resume = (
                metadata.extraction_progress >= 1.0
                and audio_path.exists()
                and metadata.last_offset_ms is not None
            )
            offset_ms = 0

            if is_resume:
                # Resume: skip extraction, use offset with 30s overlap
                offset_ms = max(0, metadata.last_offset_ms - 30_000)

                # Filter existing segments to only keep those before the overlap point
                segments_path = job_dir / "partial_segments.json"
                if segments_path.exists():
                    try:
                        existing = json.loads(segments_path.read_text(encoding="utf-8"))
                        overlap_start = offset_ms / 1000.0
                        filtered = [s for s in existing if s["end"] <= overlap_start]
                        segments_path.write_text(
                            json.dumps(filtered, ensure_ascii=False), encoding="utf-8",
                        )
                    except (json.JSONDecodeError, OSError):
                        pass
            else:
                # Full run: extract audio
                total_duration = await get_media_duration(input_path)

                self.update_job(
                    job_id,
                    status=JobStatus.EXTRACTING,
                    progress=0.05,
                    extraction_progress=0.0,
                )
                await extract_audio(
                    input_path,
                    audio_path,
                    total_duration=total_duration,
                    on_progress=self._make_stage_callback(
                        job_id, "extraction_progress", 0.05, 0.15,
                    ),
                )
                self.update_job(
                    job_id,
                    extraction_progress=1.0,
                    progress=0.20,
                )

            # Step 2: Transcribe (20% → 90%)
            self.update_job(
                job_id,
                status=JobStatus.TRANSCRIBING,
                progress=0.20,
                transcription_progress=0.0,
            )
            threads = config.threads or settings.whisper_threads
            segment_callback, _segments_ref = self._make_segment_callback(job_id)
            result = await transcribe_audio(
                audio_path=audio_path,
                output_dir=job_dir,
                language=config.language,
                model_size=config.model,
                whisper_cli=settings.whisper_cli_path,
                models_dir=settings.models_path,
                threads=threads,
                on_progress=self._make_stage_callback(
                    job_id, "transcription_progress", 0.20, 0.70,
                ),
                on_segment=segment_callback,
                offset_ms=offset_ms,
            )
            self.update_job(
                job_id,
                transcription_progress=1.0,
                progress=0.90,
            )

            result = TranscriptResult(
                job_id=job_id,
                original_filename=metadata.original_filename,
                model=result.model,
                language=result.language,
                segments=result.segments,
                full_text=result.full_text,
            )

            # Step 3: Format enriched JSON (90% → 100%)
            self.update_job(
                job_id,
                status=JobStatus.FORMATTING,
                progress=0.90,
                formatting_progress=0.0,
            )
            enriched_json = format_enriched_json(result)
            enriched_path = job_dir / "transcript.json"
            enriched_path.write_text(enriched_json, encoding="utf-8")

            now = _now_iso()
            current = self.get_job(job_id)
            self.update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=1.0,
                formatting_progress=1.0,
                completed_at=now,
                duration_seconds=_compute_duration(current.started_at, now),
            )

        except Exception as exc:
            now = _now_iso()
            current = self.get_job(job_id)

            # Compute last_offset_ms from partial segments
            last_offset = current.last_offset_ms
            segments_path = self._job_dir(job_id) / "partial_segments.json"
            if segments_path.exists():
                try:
                    segs = json.loads(segments_path.read_text(encoding="utf-8"))
                    if segs:
                        last_offset = int(segs[-1]["end"] * 1000)
                except (json.JSONDecodeError, OSError, KeyError):
                    pass

            self.update_job(
                job_id,
                status=JobStatus.FAILED,
                error=str(exc),
                completed_at=now,
                duration_seconds=_compute_duration(current.started_at, now),
                last_offset_ms=last_offset,
            )

    # ── Helpers ─────────────────────────────────────────────────

    def _job_dir(self, job_id: str) -> Path:
        return settings.jobs_path / job_id

    def _write_metadata(self, metadata: JobMetadata) -> None:
        meta_path = self._job_dir(metadata.job_id) / "metadata.json"
        meta_path.write_text(
            json.dumps(metadata.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


# Singleton instance used by the router
job_manager = JobManager()
