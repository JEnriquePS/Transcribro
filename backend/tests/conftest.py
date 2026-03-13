import os
import sys
from pathlib import Path

import pytest

# Add backend root to path so imports work like they do when running uvicorn from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Override env vars before importing config
os.environ["WHISPER_CLI"] = "/usr/bin/false"
os.environ["MODELS_DIR"] = "/tmp/test-models"
os.environ["JOBS_DIR"] = "/tmp/test-jobs"


@pytest.fixture()
def tmp_jobs_dir(tmp_path):
    """Provide a temporary jobs directory and patch settings."""
    from config import settings

    original = settings.jobs_dir
    settings.__dict__["jobs_dir"] = str(tmp_path / "jobs")
    Path(settings.jobs_dir).mkdir(parents=True, exist_ok=True)
    yield Path(settings.jobs_dir)
    settings.__dict__["jobs_dir"] = original


@pytest.fixture()
def tmp_models_dir(tmp_path):
    """Provide a temporary models directory and patch settings."""
    from config import settings

    original = settings.models_dir
    settings.__dict__["models_dir"] = str(tmp_path / "models")
    Path(settings.models_dir).mkdir(parents=True, exist_ok=True)
    yield Path(settings.models_dir)
    settings.__dict__["models_dir"] = original
