import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from config import settings
from application.job_manager import job_manager

router = APIRouter(prefix="/api")

ALLOWED_DOWNLOAD_FORMATS = {"txt", "json", "srt", "vtt"}


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
