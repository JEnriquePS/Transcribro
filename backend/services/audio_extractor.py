import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from pathlib import Path

ProgressCallback = Callable[[float], Awaitable[None]]


async def get_media_duration(file_path: Path) -> float:
    """Get media duration in seconds using ffprobe.

    Raises RuntimeError if ffprobe fails or returns invalid data.
    """
    process = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        str(file_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        raise RuntimeError(
            f"ffprobe failed (code {process.returncode}): "
            f"{stderr.decode(errors='replace')}"
        )

    try:
        probe_data = json.loads(stdout.decode())
        return float(probe_data["format"]["duration"])
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        raise RuntimeError(f"Could not parse duration from ffprobe output: {exc}") from exc


def _parse_ffmpeg_time_us(line: str) -> int | None:
    """Extract out_time_us from an FFmpeg -progress line."""
    match = re.match(r"out_time_us=(\d+)", line)
    return int(match.group(1)) if match else None


async def extract_audio(
    video_path: Path,
    audio_path: Path,
    total_duration: float | None = None,
    on_progress: ProgressCallback | None = None,
) -> float:
    """Extract audio from video as WAV 16kHz mono using FFmpeg.

    Uses -progress pipe:1 to report real-time progress via on_progress callback.
    Returns the duration in seconds.
    Raises RuntimeError if FFmpeg fails.
    """
    if total_duration is None:
        total_duration = await get_media_duration(video_path)

    process = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        "-progress", "pipe:1",
        str(audio_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    assert process.stdout is not None
    total_us = total_duration * 1_000_000

    while True:
        line = await process.stdout.readline()
        if not line:
            break

        decoded = line.decode(errors="replace").strip()

        time_us = _parse_ffmpeg_time_us(decoded)
        if time_us is not None and on_progress is not None and total_us > 0:
            pct = min(time_us / total_us, 1.0)
            await on_progress(pct)

    await process.wait()

    if process.returncode != 0:
        stderr_bytes = await process.stderr.read() if process.stderr else b""
        raise RuntimeError(
            f"FFmpeg audio extraction failed (code {process.returncode}): "
            f"{stderr_bytes.decode(errors='replace')}"
        )

    return total_duration


async def validate_media_file(file_path: Path) -> bool:
    """Verify the file is a valid audio/video file using ffprobe.

    Returns True if valid, False otherwise.
    """
    process = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        str(file_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()

    if process.returncode != 0:
        return False

    try:
        probe_data = json.loads(stdout.decode())
        streams = probe_data.get("streams", [])
        return any(
            s.get("codec_type") in ("audio", "video")
            for s in streams
        )
    except (json.JSONDecodeError, KeyError):
        return False
