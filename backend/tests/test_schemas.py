import pytest
from pydantic import ValidationError

from domain.entities import (
    JobMetadata,
    JobStatus,
    TranscriptionConfig,
    TranscriptResult,
    TranscriptSegment,
)


class TestJobStatus:
    def test_values(self):
        assert JobStatus.PENDING == "pending"
        assert JobStatus.EXTRACTING == "extracting"
        assert JobStatus.TRANSCRIBING == "transcribing"
        assert JobStatus.FORMATTING == "formatting"
        assert JobStatus.COMPLETED == "completed"
        assert JobStatus.FAILED == "failed"

    def test_is_str_enum(self):
        assert isinstance(JobStatus.PENDING, str)


class TestTranscriptionConfig:
    def test_defaults(self):
        config = TranscriptionConfig()
        assert config.model == "large-v3"
        assert config.language == "es"
        assert config.threads is None

    def test_custom_values(self):
        config = TranscriptionConfig(model="small", language="en", threads=4)
        assert config.model == "small"
        assert config.language == "en"
        assert config.threads == 4

    def test_frozen(self):
        config = TranscriptionConfig()
        with pytest.raises(ValidationError):
            config.model = "tiny"


class TestJobMetadata:
    def test_defaults(self):
        meta = JobMetadata(job_id="abc123", original_filename="test.mp4")
        assert meta.status == JobStatus.PENDING
        assert meta.progress == 0.0
        assert meta.error is None
        assert meta.extraction_progress == 0.0
        assert meta.last_offset_ms is None

    def test_immutable_update(self):
        meta = JobMetadata(job_id="abc", original_filename="test.mp4")
        data = {**meta.model_dump(), "status": JobStatus.COMPLETED, "progress": 1.0}
        updated = JobMetadata(**data)
        assert updated.status == JobStatus.COMPLETED
        assert updated.progress == 1.0
        assert meta.status == JobStatus.PENDING  # original unchanged


class TestTranscriptSegment:
    def test_creation(self):
        seg = TranscriptSegment(start=1.5, end=3.2, text="hello world")
        assert seg.start == 1.5
        assert seg.end == 3.2
        assert seg.text == "hello world"


class TestTranscriptResult:
    def test_creation(self):
        result = TranscriptResult(
            job_id="abc",
            original_filename="test.mp4",
            model="small",
            language="es",
            segments=[TranscriptSegment(start=0.0, end=1.0, text="hola")],
            full_text="hola",
        )
        assert len(result.segments) == 1
        assert result.full_text == "hola"
