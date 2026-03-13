import json

from models.schemas import TranscriptResult, TranscriptSegment
from services.formatter import format_enriched_json, format_timestamp_display


class TestFormatTimestampDisplay:
    def test_under_one_minute(self):
        assert format_timestamp_display(0.0) == "0:00"
        assert format_timestamp_display(5.0) == "0:05"
        assert format_timestamp_display(59.0) == "0:59"

    def test_minutes(self):
        assert format_timestamp_display(60.0) == "1:00"
        assert format_timestamp_display(125.0) == "2:05"
        assert format_timestamp_display(3599.0) == "59:59"

    def test_hours(self):
        assert format_timestamp_display(3600.0) == "1:00:00"
        assert format_timestamp_display(3661.0) == "1:01:01"
        assert format_timestamp_display(7200.0) == "2:00:00"


class TestFormatEnrichedJson:
    def test_enriched_output(self):
        result = TranscriptResult(
            job_id="test-id",
            original_filename="video.mp4",
            model="small",
            language="es",
            segments=[
                TranscriptSegment(start=0.0, end=5.5, text="Hola mundo"),
                TranscriptSegment(start=5.5, end=10.0, text="Segunda línea"),
            ],
            full_text="Hola mundo Segunda línea",
        )

        json_str = format_enriched_json(result)
        data = json.loads(json_str)

        assert data["job_id"] == "test-id"
        assert data["model"] == "small"
        assert len(data["segments"]) == 2
        assert data["segments"][0]["start_formatted"] == "0:00"
        assert data["segments"][0]["end_formatted"] == "0:05"
        assert data["segments"][1]["text"] == "Segunda línea"
        assert data["full_text"] == "Hola mundo Segunda línea"

    def test_empty_segments(self):
        result = TranscriptResult(
            job_id="empty",
            original_filename="audio.wav",
            model="tiny",
            language="en",
            segments=[],
            full_text="",
        )

        data = json.loads(format_enriched_json(result))
        assert data["segments"] == []
        assert data["full_text"] == ""
