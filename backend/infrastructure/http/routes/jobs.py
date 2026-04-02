import json
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException
from fastapi import Path as FastAPIPath
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from domain.errors import InvalidJobStateError, JobNotFoundError, UnsupportedFormatError
from infrastructure.http.dependencies import get_job_manager

router = APIRouter(prefix="/api")

ALLOWED_DOWNLOAD_FORMATS = {"txt", "json", "srt", "vtt"}


class RenameJobRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)

JobId = Annotated[str, FastAPIPath(pattern=r"^[a-f0-9]{32}$")]


@router.get("/jobs")
def list_jobs(limit: int = 50, offset: int = 0):
    """List transcription jobs with pagination."""
    job_manager = get_job_manager()
    page, total = job_manager.list_jobs(limit, offset)
    return {
        "jobs": [j.model_dump() for j in page],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/jobs/{job_id}")
def get_job(job_id: JobId):
    """Get job metadata and transcript result if completed."""
    job_manager = get_job_manager()
    try:
        metadata = job_manager.get_job(job_id)
    except JobNotFoundError:
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
def download_job_file(job_id: JobId, format: str = "srt"):
    """Download a transcription output file."""
    if format not in ALLOWED_DOWNLOAD_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {format}. Supported: {sorted(ALLOWED_DOWNLOAD_FORMATS)}",
        )

    job_manager = get_job_manager()
    try:
        file_path = job_manager.get_job_file(job_id, format)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Output file not found for job {job_id}") from None
    except UnsupportedFormatError as exc:
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
    except JobNotFoundError:
        stem = "transcript"

    return FileResponse(
        path=file_path,
        media_type=media_types.get(format, "application/octet-stream"),
        filename=f"{stem}.{format}",
    )


@router.get("/jobs/{job_id}/partial-transcript")
def get_partial_transcript(job_id: JobId):
    """Return partial transcript segments captured during transcription."""
    job_manager = get_job_manager()
    return job_manager.get_partial_transcript(job_id)


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: JobId, resume: bool = False):
    """Retry a failed job. If resume=True, continues from last offset."""
    job_manager = get_job_manager()
    try:
        metadata = job_manager.retry_job(job_id, resume=resume)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None
    except InvalidJobStateError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    await job_manager.enqueue_job(job_id)
    return metadata.model_dump()


@router.patch("/jobs/{job_id}")
def rename_job(job_id: JobId, body: RenameJobRequest):
    """Update the display name of a job."""
    job_manager = get_job_manager()
    try:
        updated = job_manager.rename_job(job_id, body.display_name.strip())
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None
    return updated.model_dump()


@router.delete("/jobs/{job_id}")
def delete_job(job_id: JobId):
    """Delete a job and all its files."""
    job_manager = get_job_manager()
    try:
        job_manager.get_job(job_id)
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}") from None

    job_manager.delete_job(job_id)
    return {"detail": "Job deleted"}
