import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from logger import get_logger, setup_logging
from routers.transcribe import router as transcribe_router
from services.job_manager import job_manager
from startup import validate_environment

setup_logging()
log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate environment, create directories, start worker."""
    validate_environment()
    settings.jobs_path.mkdir(parents=True, exist_ok=True)
    settings.models_path.mkdir(parents=True, exist_ok=True)
    log.info("Starting job worker")
    await job_manager.start_worker()
    yield
    log.info("Stopping job worker")
    await job_manager.stop_worker()


app = FastAPI(
    title="Transcribro API",
    description="Video/audio transcription powered by whisper.cpp",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe_router)


@app.get("/api/health")
def health_check():
    """Health check endpoint that verifies real dependencies."""
    checks = {
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "ffprobe": shutil.which("ffprobe") is not None,
        "whisper_cli": settings.whisper_cli_path.exists(),
        "models_dir": settings.models_path.exists(),
        "jobs_dir": settings.jobs_path.exists(),
    }

    all_ok = all(checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
