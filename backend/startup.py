import shutil

from config import settings
from logger import get_logger

log = get_logger("startup")


class StartupError(RuntimeError):
    """Raised when a required system dependency is missing."""


def validate_environment() -> None:
    """Check that all required system dependencies are available.

    Validates:
    - ffmpeg and ffprobe are installed and reachable
    - whisper-cli binary exists at the configured path

    Raises StartupError if any dependency is missing.
    """
    errors: list[str] = []

    if shutil.which("ffmpeg") is None:
        errors.append("ffmpeg not found in PATH. Install with: brew install ffmpeg")

    if shutil.which("ffprobe") is None:
        errors.append("ffprobe not found in PATH. Install with: brew install ffmpeg")

    whisper_path = settings.whisper_cli_path
    if not whisper_path.exists():
        errors.append(
            f"whisper-cli not found at: {whisper_path}. "
            f"Run: bash scripts/setup.sh to compile whisper.cpp"
        )

    if errors:
        for error in errors:
            log.error(error)
        raise StartupError(
            "Missing required dependencies:\n  - " + "\n  - ".join(errors)
        )

    log.info("ffmpeg: %s", shutil.which("ffmpeg"))
    log.info("ffprobe: %s", shutil.which("ffprobe"))
    log.info("whisper-cli: %s", whisper_path)
    log.info("Models dir: %s", settings.models_path)
    log.info("Jobs dir: %s", settings.jobs_path)
    log.info("Default model: %s", settings.default_model)
