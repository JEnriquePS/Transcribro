import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from pathlib import Path

from domain.entities import TranscriptResult, TranscriptSegment

ProgressCallback = Callable[[float], Awaitable[None]]
SegmentCallback = Callable[[float, float, str], Awaitable[None]]

_PROGRESS_RE = re.compile(r"progress\s*=\s*(\d+)%")

# Parses: [00:01:23.456 --> 00:01:28.789]   texto aquí
_SEGMENT_RE = re.compile(
    r"^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.+)"
)

_READLINE_TIMEOUT = 300  # 5 minutes
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _parse_timestamp(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


async def transcribe_audio(
    audio_path: Path,
    output_dir: Path,
    language: str,
    model_size: str,
    whisper_cli: Path,
    models_dir: Path,
    threads: int,
    on_progress: ProgressCallback | None = None,
    on_segment: SegmentCallback | None = None,
    offset_ms: int = 0,
) -> TranscriptResult:
    """Run whisper-cli to transcribe an audio file.

    Reads stderr line-by-line to parse progress and transcript segments
    from whisper.cpp output. Returns a TranscriptResult parsed from the
    JSON output. Raises RuntimeError if whisper-cli fails or times out.
    """
    model_path = get_model_path(models_dir, model_size)
    output_prefix = output_dir / "transcript"

    cmd = [
        str(whisper_cli),
        "-m", str(model_path),
        "-f", str(audio_path),
        "-of", str(output_prefix),
        "--output-json",
        "--output-srt",
        "--output-vtt",
        "--output-txt",
        "--print-progress",
        "-t", str(threads),
    ]

    if offset_ms > 0:
        cmd.extend(["--offset", str(offset_ms)])

    if language == "auto":
        cmd.append("--detect-language")
    else:
        cmd.extend(["-l", language])

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    assert process.stderr is not None
    assert process.stdout is not None
    stderr_lines: list[str] = []

    async def _read_stdout() -> None:
        """Read stdout lines and parse transcript segments."""
        assert process.stdout is not None
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            decoded = _ANSI_RE.sub("", line.decode(errors="replace")).strip()
            if not decoded:
                continue
            seg_match = _SEGMENT_RE.match(decoded)
            if seg_match is not None and on_segment is not None:
                g = seg_match.groups()
                start = _parse_timestamp(g[0], g[1], g[2], g[3])
                end = _parse_timestamp(g[4], g[5], g[6], g[7])
                text = g[8].strip()
                await on_segment(start, end, text)

    stdout_task = asyncio.create_task(_read_stdout())

    try:
        while True:
            try:
                line = await asyncio.wait_for(
                    process.stderr.readline(), timeout=_READLINE_TIMEOUT,
                )
            except TimeoutError:
                process.kill()
                await process.wait()
                raise RuntimeError(
                    "whisper-cli timed out — no output for 5 minutes"
                ) from None

            if not line:
                break

            decoded = _ANSI_RE.sub("", line.decode(errors="replace")).strip()
            stderr_lines.append(decoded)

            # Parse progress lines from stderr
            match = _PROGRESS_RE.search(decoded)
            if match is not None and on_progress is not None:
                pct = int(match.group(1)) / 100.0
                await on_progress(pct)

    except RuntimeError:
        stdout_task.cancel()
        raise
    except Exception:
        process.kill()
        await process.wait()
        stdout_task.cancel()
        raise

    await process.wait()
    await stdout_task

    if process.returncode != 0:
        raise RuntimeError(
            f"whisper-cli failed (code {process.returncode}): "
            f"{chr(10).join(stderr_lines[-20:])}"
        )

    json_path = Path(f"{output_prefix}.json")
    return parse_whisper_json(json_path, language)


def get_model_path(models_dir: Path, model_size: str) -> Path:
    """Return the path to a GGML model file.

    Raises FileNotFoundError if the model file does not exist.
    """
    model_path = models_dir / f"ggml-{model_size}.bin"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model file not found: {model_path}. "
            f"Available models: {[p.name for p in models_dir.glob('ggml-*.bin')]}"
        )
    return model_path


def parse_whisper_json(json_path: Path, requested_language: str) -> TranscriptResult:
    """Parse whisper.cpp JSON output into a TranscriptResult.

    whisper.cpp JSON format contains a 'transcription' array where each entry has:
    - timestamps: {from: "HH:MM:SS.mmm", to: "HH:MM:SS.mmm"}
    - offsets: {from: int_ms, to: int_ms}
    - text: str

    Raises RuntimeError if the JSON file is missing or malformed.
    """
    if not json_path.exists():
        raise RuntimeError(f"Whisper JSON output not found: {json_path}")

    try:
        raw = json.loads(json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise RuntimeError(f"Failed to read whisper JSON output: {exc}") from exc

    transcription = raw.get("transcription", [])
    detected_language = raw.get("result", {}).get("language", requested_language)

    segments = [
        TranscriptSegment(
            start=entry["offsets"]["from"] / 1000.0,
            end=entry["offsets"]["to"] / 1000.0,
            text=entry["text"].strip(),
        )
        for entry in transcription
        if entry.get("offsets") and entry.get("text", "").strip()
    ]

    full_text = " ".join(seg.text for seg in segments)

    return TranscriptResult(
        job_id="",
        original_filename="",
        model=raw.get("model", {}).get("type", "unknown"),
        language=detected_language,
        segments=segments,
        full_text=full_text,
    )
