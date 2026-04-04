import { describe, it, expect } from 'vitest'
import { formatTimestampDisplay, formatEnrichedJson } from '../../src/main/infrastructure/services/whisper-formatter'
import type { TranscriptResult } from '../../src/shared/types'

const makeResult = (overrides: Partial<TranscriptResult> = {}): TranscriptResult => ({
  jobId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  originalFilename: 'interview.mp4',
  model: 'large-v3',
  language: 'es',
  fullText: 'Hola mundo',
  segments: [
    { start: 0, end: 3.5, text: 'Hola' },
    { start: 3.5, end: 7, text: 'mundo' },
  ],
  ...overrides,
})

// ── formatTimestampDisplay ────────────────────────────────────────────────────

describe('formatTimestampDisplay', () => {
  it('formats sub-hour as M:SS', () => {
    expect(formatTimestampDisplay(0)).toBe('0:00')
    expect(formatTimestampDisplay(65)).toBe('1:05')
    expect(formatTimestampDisplay(3599)).toBe('59:59')
  })

  it('formats hour+ as H:MM:SS', () => {
    expect(formatTimestampDisplay(3600)).toBe('1:00:00')
    expect(formatTimestampDisplay(3661)).toBe('1:01:01')
    expect(formatTimestampDisplay(7265)).toBe('2:01:05')
  })

  it('truncates fractional seconds', () => {
    expect(formatTimestampDisplay(61.9)).toBe('1:01')
  })
})

// ── formatEnrichedJson ────────────────────────────────────────────────────────

describe('formatEnrichedJson', () => {
  it('produces valid JSON', () => {
    const json = formatEnrichedJson(makeResult())
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('includes all top-level keys', () => {
    const parsed = JSON.parse(formatEnrichedJson(makeResult()))
    expect(parsed).toHaveProperty('job_id')
    expect(parsed).toHaveProperty('original_filename')
    expect(parsed).toHaveProperty('model')
    expect(parsed).toHaveProperty('language')
    expect(parsed).toHaveProperty('full_text')
    expect(parsed).toHaveProperty('segments')
  })

  it('maps camelCase to snake_case in output', () => {
    const r = makeResult()
    const parsed = JSON.parse(formatEnrichedJson(r))
    expect(parsed.job_id).toBe(r.jobId)
    expect(parsed.original_filename).toBe(r.originalFilename)
    expect(parsed.full_text).toBe(r.fullText)
  })

  it('enriches segments with formatted timestamps', () => {
    const parsed = JSON.parse(formatEnrichedJson(makeResult()))
    const seg = parsed.segments[0]
    expect(seg).toHaveProperty('start_formatted')
    expect(seg).toHaveProperty('end_formatted')
    expect(seg.start_formatted).toBe('0:00')
    expect(seg.end_formatted).toBe('0:03')
  })

  it('handles empty segments array', () => {
    const parsed = JSON.parse(formatEnrichedJson(makeResult({ segments: [], fullText: '' })))
    expect(parsed.segments).toEqual([])
  })
})
