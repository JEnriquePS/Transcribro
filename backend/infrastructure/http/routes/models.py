import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import settings

router = APIRouter(prefix="/api")

KNOWN_MODEL_NAMES = {"tiny", "base", "small", "medium", "large-v3"}


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


@router.put("/models/default")
def set_default_model(name: str):
    """Set the default whisper model."""
    if name not in KNOWN_MODEL_NAMES:
        raise HTTPException(status_code=400, detail=f"Unknown model: {name}")

    model_path = settings.model_file(name)
    if not model_path.exists():
        raise HTTPException(status_code=400, detail=f"Model {name} is not downloaded")

    # Update .env file
    env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
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
