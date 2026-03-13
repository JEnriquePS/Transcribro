from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile

from config import settings
from domain.entities import TranscriptionConfig
from application.job_manager import job_manager

router = APIRouter(prefix="/api")


@router.post("/transcribe", status_code=202)
async def transcribe(
    file: UploadFile,
    model: str = Form(default=settings.default_model),
    language: str = Form(default=settings.default_language),
    threads: int | None = Form(default=None),
):
    """Upload a single file for transcription."""
    _validate_file(file)

    config = TranscriptionConfig(model=model, language=language, threads=threads)
    metadata = job_manager.create_job(file.filename or "unknown", config)
    await job_manager.save_uploaded_file(metadata.job_id, file)
    await job_manager.enqueue_job(metadata.job_id)

    return {"job_id": metadata.job_id, "status": metadata.status.value}


@router.post("/transcribe/batch", status_code=202)
async def transcribe_batch(
    files: list[UploadFile],
    model: str = Form(default=settings.default_model),
    language: str = Form(default=settings.default_language),
    threads: int | None = Form(default=None),
):
    """Upload multiple files for transcription."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    config = TranscriptionConfig(model=model, language=language, threads=threads)
    jobs = []

    for file in files:
        _validate_file(file)
        metadata = job_manager.create_job(file.filename or "unknown", config)
        await job_manager.save_uploaded_file(metadata.job_id, file)
        await job_manager.enqueue_job(metadata.job_id)
        jobs.append({"job_id": metadata.job_id, "status": metadata.status.value})

    return {"jobs": jobs}


def _validate_file(file: UploadFile) -> None:
    """Validate uploaded file extension. Raises HTTPException on invalid file."""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()

    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {sorted(settings.allowed_extensions)}",
        )
