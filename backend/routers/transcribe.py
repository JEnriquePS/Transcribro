import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from config import settings
from models.schemas import TranscriptionConfig
from services.job_manager import job_manager

router = APIRouter(prefix="/api")

ALLOWED_DOWNLOAD_FORMATS = {"txt", "json", "srt", "vtt"}


# ── Transcription endpoints ────────────────────────────────────


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


# ── Job endpoints ───────────────────────────────────────────────


@router.get("/jobs")
def list_jobs(limit: int = 50, offset: int = 0):
    """List transcription jobs with pagination."""
    all_jobs = job_manager.list_jobs()
    total = len(all_jobs)
    page = all_jobs[offset : offset + limit]
    return {
        "jobs": [j.model_dump() for j in page],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    """Get job metadata and transcript result if completed."""
    try:
        metadata = job_manager.get_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None

    response = metadata.model_dump()

    if metadata.status.value == "completed":
        try:
            json_path = job_manager.get_job_file(job_id, "json")
            result = json.loads(json_path.read_text(encoding="utf-8"))
            response["result"] = result
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    return response


@router.get("/jobs/{job_id}/download")
def download_job_file(job_id: str, format: str = "srt"):
    """Download a transcription output file."""
    if format not in ALLOWED_DOWNLOAD_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {format}. Supported: {sorted(ALLOWED_DOWNLOAD_FORMATS)}",
        )

    try:
        file_path = job_manager.get_job_file(job_id, format)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Output file not found for job {job_id}") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    media_types = {
        "txt": "text/plain",
        "srt": "text/plain",
        "vtt": "text/vtt",
        "json": "application/json",
    }

    try:
        metadata = job_manager.get_job(job_id)
        stem = Path(metadata.original_filename).stem
    except FileNotFoundError:
        stem = "transcript"

    return FileResponse(
        path=file_path,
        media_type=media_types.get(format, "application/octet-stream"),
        filename=f"{stem}.{format}",
    )


@router.get("/jobs/{job_id}/partial-transcript")
def get_partial_transcript(job_id: str):
    """Return partial transcript segments captured during transcription."""
    segments_path = settings.jobs_path / job_id / "partial_segments.json"
    if not segments_path.exists():
        return {"segments": [], "text": ""}
    try:
        segments = json.loads(segments_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"segments": [], "text": ""}
    text = " ".join(s["text"] for s in segments)
    return {"segments": segments, "text": text}


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str, resume: bool = False):
    """Retry a failed job. If resume=True, continues from last offset."""
    try:
        metadata = job_manager.retry_job(job_id, resume=resume)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    await job_manager.enqueue_job(job_id)
    return metadata.model_dump()


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str):
    """Delete a job and all its files."""
    try:
        job_manager.get_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None

    job_manager.delete_job(job_id)
    return {"detail": "Job deleted"}


# ── Models endpoint ─────────────────────────────────────────────


@router.get("/models")
def list_models():
    """List available whisper models."""
    known_models = [
        {"name": "large-v3", "size_mb": 3094},
        {"name": "medium", "size_mb": 1533},
        {"name": "small", "size_mb": 488},
        {"name": "base", "size_mb": 148},
        {"name": "tiny", "size_mb": 77},
    ]

    models = []
    for m in known_models:
        model_path = settings.model_file(m["name"])
        models.append({
            **m,
            "available": model_path.exists(),
        })

    return {
        "models": models,
        "default": settings.default_model,
    }


KNOWN_MODEL_NAMES = {"tiny", "base", "small", "medium", "large-v3"}


@router.put("/models/default")
def set_default_model(name: str):
    """Set the default whisper model."""
    if name not in KNOWN_MODEL_NAMES:
        raise HTTPException(status_code=400, detail=f"Unknown model: {name}")

    model_path = settings.model_file(name)
    if not model_path.exists():
        raise HTTPException(status_code=400, detail=f"Model {name} is not downloaded")

    # Update .env file
    env_path = Path(__file__).resolve().parent.parent / ".env"
    lines: list[str] = []
    found = False

    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("DEFAULT_MODEL="):
                lines.append(f"DEFAULT_MODEL={name}")
                found = True
            else:
                lines.append(line)

    if not found:
        lines.append(f"DEFAULT_MODEL={name}")

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Update runtime setting
    settings.default_model = name

    return {"detail": f"Default model set to {name}", "default": name}

_download_tasks: dict[str, asyncio.Task] = {}
_download_procs: dict[str, asyncio.subprocess.Process] = {}


@router.post("/models/{name}/download")
async def download_model(name: str):
    """Start downloading a whisper model from HuggingFace."""
    if name not in KNOWN_MODEL_NAMES:
        raise HTTPException(status_code=400, detail=f"Unknown model: {name}")

    model_path = settings.model_file(name)
    if model_path.exists():
        raise HTTPException(status_code=409, detail=f"Model {name} already exists")

    if name in _download_tasks and not _download_tasks[name].done():
        raise HTTPException(status_code=409, detail=f"Model {name} is already downloading")

    async def _download() -> None:
        url = f"https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{name}.bin"
        partial = model_path.with_suffix(".bin.partial")
        try:
            proc = await asyncio.create_subprocess_exec(
                "curl", "-L", "--progress-bar", "-o", str(partial), url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _download_procs[name] = proc
            await proc.wait()
            if proc.returncode == 0 and partial.exists():
                partial.rename(model_path)
            elif partial.exists():
                partial.unlink()
        except asyncio.CancelledError:
            if partial.exists():
                partial.unlink()
            raise
        finally:
            _download_procs.pop(name, None)

    _download_tasks[name] = asyncio.create_task(_download())
    return {"detail": f"Download started for {name}"}


@router.delete("/models/{name}/download")
async def cancel_download(name: str):
    """Cancel an in-progress model download."""
    if name not in _download_tasks or _download_tasks[name].done():
        raise HTTPException(status_code=404, detail=f"No active download for {name}")

    proc = _download_procs.get(name)
    if proc and proc.returncode is None:
        proc.terminate()

    _download_tasks[name].cancel()
    _download_tasks.pop(name, None)

    return {"detail": f"Download cancelled for {name}"}


@router.get("/models/{name}/status")
def model_download_status(name: str):
    """Check if a model is downloaded or currently downloading."""
    model_path = settings.model_file(name)
    partial_path = model_path.with_suffix(".bin.partial")

    if model_path.exists():
        size_mb = round(model_path.stat().st_size / (1024 * 1024), 1)
        return {"status": "ready", "size_mb": size_mb}

    if name in _download_tasks and not _download_tasks[name].done():
        progress_mb = round(partial_path.stat().st_size / (1024 * 1024), 1) if partial_path.exists() else 0
        return {"status": "downloading", "progress_mb": progress_mb}

    if name in _download_tasks and _download_tasks[name].done():
        exc = _download_tasks[name].exception()
        if exc:
            return {"status": "failed", "error": str(exc)}

    return {"status": "not_downloaded"}


@router.delete("/models/{name}")
def delete_model(name: str):
    """Delete a downloaded whisper model."""
    if name not in KNOWN_MODEL_NAMES:
        raise HTTPException(status_code=400, detail=f"Unknown model: {name}")

    model_path = settings.model_file(name)
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model {name} not found")

    model_path.unlink()
    return {"detail": f"Model {name} deleted"}


# ── Helpers ─────────────────────────────────────────────────────


def _validate_file(file: UploadFile) -> None:
    """Validate uploaded file extension. Raises HTTPException on invalid file."""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()

    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {sorted(settings.allowed_extensions)}",
        )
