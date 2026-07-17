import type { TranscriptResult } from '../../../shared/types'

/**
 * Convert seconds to human-readable timestamp.
 * Returns "M:SS" for durations under 1 hour, "H:MM:SS" for longer.
 */
export function formatTimestampDisplay(seconds: number): string {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Create enriched JSON string from a TranscriptResult.
 * Adds human-readable timestamps (startFormatted, endFormatted) to each segment.
 * Matches the Python formatter output (snake_case keys for JSON compatibility).
 */
export function formatEnrichedJson(result: TranscriptResult): string {
  const enrichedSegments = result.segments.map((seg) => ({
    start:           seg.start,
    end:             seg.end,
    start_formatted: formatTimestampDisplay(seg.start),
    end_formatted:   formatTimestampDisplay(seg.end),
    text:            seg.text,
  }))

  const enriched = {
    job_id:            result.jobId,
    original_filename: result.originalFilename,
    model:             result.model,
    language:          result.language,
    full_text:         result.fullText,
    segments:          enrichedSegments,
  }

  return JSON.stringify(enriched, null, 2)
}

export class WhisperFormatter {
  format(result: TranscriptResult): string {
    return formatEnrichedJson(result)
  }
}
