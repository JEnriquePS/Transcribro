from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    whisper_cli: str = "../whisper.cpp/build/bin/whisper-cli"
    models_dir: str = "../data/models"
    jobs_dir: str = "../data/jobs"
    default_model: str = "large-v3"
    default_language: str = "es"
    whisper_threads: int = 8
    whisper_no_speech_thold: float = 0.6
    whisper_entropy_thold: float = 2.4
    whisper_logprob_thold: float = -1.0
    # 0 = disable context window between segments (prevents hallucination cascades)
    whisper_max_context: int = 0
    max_file_size: int = 2 * 1024 * 1024 * 1024  # 2 GB
    allowed_extensions: frozenset[str] = frozenset(
        {".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav", ".flac", ".ogg", ".m4a"}
    )
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @property
    def whisper_cli_path(self) -> Path:
        return Path(self.whisper_cli)

    @property
    def models_path(self) -> Path:
        return Path(self.models_dir)

    @property
    def jobs_path(self) -> Path:
        return Path(self.jobs_dir)

    def model_file(self, model_name: str) -> Path:
        return self.models_path / f"ggml-{model_name}.bin"


settings = Settings()
