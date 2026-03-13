
import pytest

from infrastructure.services.transcriber import get_model_path, parse_whisper_json


class TestGetModelPath:
    def test_raises_when_model_missing(self, tmp_path):
        with pytest.raises(FileNotFoundError, match="Model file not found"):
            get_model_path(tmp_path, "large-v3")

    def test_returns_path_when_exists(self, tmp_path):
        model_file = tmp_path / "ggml-small.bin"
        model_file.write_bytes(b"fake model")
        result = get_model_path(tmp_path, "small")
        assert result == model_file


class TestParseWhisperJson:
    def test_raises_when_file_missing(self, tmp_path):
        with pytest.raises(RuntimeError, match="not found"):
            parse_whisper_json(tmp_path / "missing.json", "es")

    def test_parses_valid_json(self, tmp_path):
        import json

        json_path = tmp_path / "transcript.json"
        data = {
            "transcription": [
                {
                    "timestamps": {"from": "00:00:00.000", "to": "00:00:05.000"},
                    "offsets": {"from": 0, "to": 5000},
                    "text": " Hola mundo",
                },
                {
                    "timestamps": {"from": "00:00:05.000", "to": "00:00:10.000"},
                    "offsets": {"from": 5000, "to": 10000},
                    "text": " Segunda línea",
                },
            ],
            "result": {"language": "es"},
            "model": {"type": "small"},
        }
        json_path.write_text(json.dumps(data))

        result = parse_whisper_json(json_path, "es")
        assert len(result.segments) == 2
        assert result.segments[0].start == 0.0
        assert result.segments[0].end == 5.0
        assert result.segments[0].text == "Hola mundo"
        assert result.language == "es"

    def test_skips_empty_segments(self, tmp_path):
        import json

        json_path = tmp_path / "transcript.json"
        data = {
            "transcription": [
                {"offsets": {"from": 0, "to": 1000}, "text": "  "},
                {"offsets": {"from": 1000, "to": 2000}, "text": " Valid text"},
            ],
        }
        json_path.write_text(json.dumps(data))

        result = parse_whisper_json(json_path, "en")
        assert len(result.segments) == 1
        assert result.segments[0].text == "Valid text"
