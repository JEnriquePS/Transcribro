from __future__ import annotations

import json
import shutil
from pathlib import Path

from domain.entities import JobMetadata
from domain.errors import JobNotFoundError, UnsupportedFormatError
from domain.validation import validate_job_id
from logger import get_logger

log = get_logger("job_repository")

_FILE_MAP = {
    "txt": "transcript.txt",
    "srt": "transcript.srt",
    "vtt": "transcript.vtt",
    "json": "transcript.json",
}


class FileSystemJobRepository:
    """JobRepository implementation backed by the local filesystem.

    Each job is stored as a directory under `jobs_path`, with a `metadata.json`
    file containing the serialized JobMetadata.
    """

    def __init__(self, jobs_path: Path) -> None:
        self._jobs_path = jobs_path

    def _job_dir(self, job_id: str) -> Path:
        validate_job_id(job_id)
        result = (self._jobs_path / job_id).resolve()
        if not result.is_relative_to(self._jobs_path.resolve()):
            raise ValueError(f"Invalid job path: {job_id!r}")
        return result

    def _write_metadata(self, metadata: JobMetadata) -> None:
        meta_path = self._job_dir(metadata.job_id) / "metadata.json"
        meta_path.write_text(
            json.dumps(metadata.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save(self, job: JobMetadata) -> None:
        """Persist job metadata. Creates the job directory if needed."""
        job_dir = self._job_dir(job.job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        self._write_metadata(job)

    def get(self, job_id: str) -> JobMetadata | None:
        """Read metadata for a job. Returns None if not found."""
        meta_path = self._job_dir(job_id) / "metadata.json"
        if not meta_path.exists():
            return None

        raw = json.loads(meta_path.read_text(encoding="utf-8"))
        return JobMetadata(**raw)

    def list(self, limit: int = 50, offset: int = 0) -> tuple[list[JobMetadata], int]:
        """List all jobs sorted by directory creation time (newest first)."""
        if not self._jobs_path.exists():
            return [], 0

        results: list[JobMetadata] = []
        for entry in sorted(self._jobs_path.iterdir(), reverse=True):
            meta_path = entry / "metadata.json"
            if meta_path.exists():
                try:
                    raw = json.loads(meta_path.read_text(encoding="utf-8"))
                    results.append(JobMetadata(**raw))
                except (json.JSONDecodeError, OSError):
                    continue

        total = len(results)
        page = results[offset : offset + limit]
        return page, total

    def delete(self, job_id: str) -> None:
        """Delete an entire job directory."""
        job_dir = self._job_dir(job_id)
        if job_dir.exists():
            shutil.rmtree(job_dir)

    def update(self, job_id: str, **kwargs: object) -> JobMetadata:
        """Update job metadata fields immutably. Returns the new metadata."""
        current = self.get(job_id)
        if current is None:
            raise JobNotFoundError(job_id)
        updated_data = {**current.model_dump(), **kwargs}
        updated = JobMetadata(**updated_data)
        self._write_metadata(updated)
        return updated

    def get_output_file(self, job_id: str, fmt: str) -> Path | None:
        """Return the path to a job output file, or None if it does not exist."""
        filename = _FILE_MAP.get(fmt)
        if filename is None:
            raise UnsupportedFormatError(fmt)

        file_path = self._job_dir(job_id) / filename
        if not file_path.exists():
            return None
        return file_path

    def get_job_dir(self, job_id: str) -> Path:
        """Return the job directory path (validates job_id)."""
        return self._job_dir(job_id)

    def save_file(self, job_id: str, filename: str, content: bytes) -> Path:
        """Save file content to the job directory."""
        ext = Path(filename).suffix or ".mp4"
        dest = self._job_dir(job_id) / f"input{ext}"
        dest.write_bytes(content)
        return dest

    def get_partial_segments(self, job_id: str) -> list[dict]:
        """Read partial transcript segments from the job directory."""
        segments_path = self._job_dir(job_id) / "partial_segments.json"
        if not segments_path.exists():
            return []
        try:
            return json.loads(segments_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def save_partial_segments(self, job_id: str, segments: list[dict]) -> None:
        """Write partial transcript segments to the job directory."""
        segments_path = self._job_dir(job_id) / "partial_segments.json"
        segments_path.write_text(
            json.dumps(segments, ensure_ascii=False), encoding="utf-8",
        )
