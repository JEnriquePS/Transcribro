from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile

from config import settings
from domain.entities import TranscriptionConfig
from infrastructure.http.dependencies import get_job_manager

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

    content = await file.read()
    config = TranscriptionConfig(model=model, language=language, threads=threads)
    job_manager = get_job_manager()
    metadata = job_manager.create_job(file.filename or "unknown", content, config)
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
    job_manager = get_job_manager()
    jobs = []

    for file in files:
        _validate_file(file)
        content = await file.read()
        metadata = job_manager.create_job(file.filename or "unknown", content, config)
        await job_manager.enqueue_job(metadata.job_id)
        jobs.append({"job_id": metadata.job_id, "status": metadata.status.value})

    return {"jobs": jobs}


def _validate_file(file: UploadFile) -> None:
    """Validate uploaded file extension and size. Raises HTTPException on invalid file."""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()

    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {sorted(settings.allowed_extensions)}",
        )

    # Check file size if available from headers
    if file.size is not None and file.size > settings.max_file_size:
        max_mb = settings.max_file_size // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {max_mb} MB.",
        )
