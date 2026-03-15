from __future__ import annotations

import contextlib
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from domain.entities import JobMetadata, JobStatus, TranscriptResult
from domain.errors import JobNotFoundError
from logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from domain.interfaces import AudioExtractor, Formatter, JobRepository, Transcriber

log = get_logger("process_job")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _compute_duration(started_at: str | None, completed_at: str) -> float | None:
    if started_at is None:
        return None
    start = datetime.fromisoformat(started_at)
    end = datetime.fromisoformat(completed_at)
    return round((end - start).total_seconds(), 2)


class ProcessJobUseCase:
    """Run the full transcription pipeline for a job.

    Pipeline stages and progress ranges:
      FFmpeg extraction : 0.05 -> 0.20 (weight 0.15)
      Transcription     : 0.20 -> 0.90 (weight 0.70)
      Formatting        : 0.90 -> 1.00 (weight 0.10)
    """

    def __init__(
        self,
        repo: JobRepository,
        extractor: AudioExtractor,
        transcriber: Transcriber,
        formatter: Formatter,
        default_threads: int,
    ) -> None:
        self._repo = repo
        self._extractor = extractor
        self._transcriber = transcriber
        self._formatter = formatter
        self._default_threads = default_threads

    def _make_stage_callback(
        self,
        job_id: str,
        stage_field: str,
        overall_base: float,
        stage_weight: float,
    ) -> Callable[[float], Awaitable[None]]:
        """Create a callback that updates both stage progress and overall progress."""

        async def callback(pct: float) -> None:
            overall = overall_base + pct * stage_weight
            self._repo.update(
                job_id,
                **{stage_field: round(pct, 3)},
                progress=round(overall, 3),
            )

        return callback

    def _make_segment_callback(
        self, job_id: str,
    ) -> tuple[Callable[[float, float, str], Awaitable[None]], list[dict]]:
        """Create a callback that saves each transcript segment to partial_segments.json."""
        segments = self._repo.get_partial_segments(job_id)

        async def callback(start: float, end: float, text: str) -> None:
            segments.append({"start": start, "end": end, "text": text})
            self._repo.save_partial_segments(job_id, segments)

        return callback, segments

    async def execute(self, job_id: str) -> JobMetadata:
        """Run the full transcription pipeline for a job."""
        try:
            metadata = self._repo.get(job_id)
            if metadata is None:
                raise JobNotFoundError(job_id)

            job_dir = self._repo.get_job_dir(job_id)
            config = metadata.config

            self._repo.update(job_id, started_at=_now_iso())

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
                existing = self._repo.get_partial_segments(job_id)
                if existing:
                    overlap_start = offset_ms / 1000.0
                    filtered = [s for s in existing if s["end"] <= overlap_start]
                    self._repo.save_partial_segments(job_id, filtered)
            else:
                # Full run: extract audio
                total_duration = await self._extractor.get_duration(input_path)

                self._repo.update(
                    job_id,
                    status=JobStatus.EXTRACTING,
                    progress=0.05,
                    extraction_progress=0.0,
                )
                await self._extractor.extract(
                    input_path,
                    audio_path,
                    total_duration=total_duration,
                    on_progress=self._make_stage_callback(
                        job_id, "extraction_progress", 0.05, 0.15,
                    ),
                )
                self._repo.update(
                    job_id,
                    extraction_progress=1.0,
                    progress=0.20,
                )

            # Step 2: Transcribe (20% -> 90%)
            self._repo.update(
                job_id,
                status=JobStatus.TRANSCRIBING,
                progress=0.20,
                transcription_progress=0.0,
            )
            threads = config.threads or self._default_threads
            segment_callback, _segments_ref = self._make_segment_callback(job_id)
            result = await self._transcriber.transcribe(
                audio_path=audio_path,
                output_dir=job_dir,
                language=config.language,
                model_size=config.model,
                threads=threads,
                on_progress=self._make_stage_callback(
                    job_id, "transcription_progress", 0.20, 0.70,
                ),
                on_segment=segment_callback,
                offset_ms=offset_ms,
            )
            self._repo.update(
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

            # Step 3: Format enriched JSON (90% -> 100%)
            self._repo.update(
                job_id,
                status=JobStatus.FORMATTING,
                progress=0.90,
                formatting_progress=0.0,
            )
            enriched_json = self._formatter.format(result)
            enriched_path = job_dir / "transcript.json"
            enriched_path.write_text(enriched_json, encoding="utf-8")

            now = _now_iso()
            current = self._repo.get(job_id)
            return self._repo.update(
                job_id,
                status=JobStatus.COMPLETED,
                progress=1.0,
                formatting_progress=1.0,
                completed_at=now,
                duration_seconds=_compute_duration(
                    current.started_at if current else None, now,
                ),
            )

        except Exception as exc:
            log.exception("Job %s failed: %s", job_id, exc)

            now = _now_iso()
            current = self._repo.get(job_id)

            # Compute last_offset_ms from partial segments
            last_offset = current.last_offset_ms if current else None
            segments = self._repo.get_partial_segments(job_id)
            if segments:
                with contextlib.suppress(KeyError, TypeError, ValueError):
                    last_offset = int(segments[-1]["end"] * 1000)

            # Sanitize error message: store generic message, not raw exception
            stage = current.status.value if current and current.status else "processing"
            stage_messages = {
                JobStatus.EXTRACTING.value: "Audio extraction failed",
                JobStatus.TRANSCRIBING.value: "Transcription failed",
                JobStatus.FORMATTING.value: "Formatting failed",
            }
            safe_error = stage_messages.get(stage, "Processing failed")

            return self._repo.update(
                job_id,
                status=JobStatus.FAILED,
                error=safe_error,
                completed_at=now,
                duration_seconds=_compute_duration(
                    current.started_at if current else None, now,
                ),
                last_offset_ms=last_offset,
            )
