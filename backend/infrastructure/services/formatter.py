import json

from domain.entities import TranscriptResult


def format_timestamp_display(seconds: float) -> str:
    """Convert seconds to human-readable timestamp.

    Returns "M:SS" for durations under 1 hour, "H:MM:SS" for longer durations.
    """
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def format_enriched_json(result: TranscriptResult) -> str:
    """Create enriched JSON string from a TranscriptResult.

    Adds human-readable timestamps (start_formatted, end_formatted) to each segment.
    """
    enriched_segments = [
        {
            "start": seg.start,
            "end": seg.end,
            "start_formatted": format_timestamp_display(seg.start),
            "end_formatted": format_timestamp_display(seg.end),
            "text": seg.text,
        }
        for seg in result.segments
    ]

    enriched = {
        "job_id": result.job_id,
        "original_filename": result.original_filename,
        "model": result.model,
        "language": result.language,
        "full_text": result.full_text,
        "segments": enriched_segments,
    }

    return json.dumps(enriched, ensure_ascii=False, indent=2)
