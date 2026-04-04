import { describe, it, expect } from 'vitest'
import { parseWhisperJson } from '../../src/main/infrastructure/services/whisper-transcriber'
import { TranscriptionFailedError } from '../../src/main/domain/errors'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/** Write a whisper-like JSON file to a temp path and return its path. */
function writeTempJson(data: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-test-'))
  const jsonPath = path.join(dir, 'transcript.json')
  fs.writeFileSync(jsonPath, JSON.stringify(data), 'utf8')
  return jsonPath
}

const sampleOutput = {
  model: { type: 'large-v3' },
  result: { language: 'es' },
  transcription: [
    {
      offsets: { from: 0, to: 2500 },
      text: '  Hola  ',
    },
    {
      offsets: { from: 2500, to: 5000 },
      text: ' mundo ',
    },
    // Duplicate — should be removed by deduplication
    {
      offsets: { from: 5000, to: 7500 },
      text: ' mundo ',
    },
    // Empty text — should be filtered
    {
      offsets: { from: 7500, to: 8000 },
      text: '   ',
    },
  ],
}

describe('parseWhisperJson', () => {
  it('parses valid whisper JSON into a TranscriptResult', () => {
    const jsonPath = writeTempJson(sampleOutput)
    const result = parseWhisperJson(jsonPath, 'es')
    expect(result.model).toBe('large-v3')
    expect(result.language).toBe('es')
    expect(result.segments).toHaveLength(2) // duplicate + empty removed
    expect(result.segments[0].text).toBe('Hola')
    expect(result.segments[1].text).toBe('mundo')
    expect(result.fullText).toBe('Hola mundo')
  })

  it('converts offsets from ms to seconds', () => {
    const jsonPath = writeTempJson(sampleOutput)
    const result = parseWhisperJson(jsonPath, 'es')
    expect(result.segments[0].start).toBe(0)
    expect(result.segments[0].end).toBeCloseTo(2.5)
  })

  it('uses requestedLanguage as fallback when result.language is missing', () => {
    const data = { ...sampleOutput, result: {} }
    const jsonPath = writeTempJson(data)
    const result = parseWhisperJson(jsonPath, 'en')
    expect(result.language).toBe('en')
  })

  it('throws TranscriptionFailedError when file does not exist', () => {
    expect(() => parseWhisperJson('/nonexistent/transcript.json', 'es')).toThrow(
      TranscriptionFailedError,
    )
  })

  it('throws TranscriptionFailedError on malformed JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-bad-'))
    const jsonPath = path.join(dir, 'transcript.json')
    fs.writeFileSync(jsonPath, 'not json', 'utf8')
    expect(() => parseWhisperJson(jsonPath, 'es')).toThrow(TranscriptionFailedError)
  })

  it('deduplicates consecutive identical-text segments', () => {
    const data = {
      ...sampleOutput,
      transcription: [
        { offsets: { from: 0, to: 1000 }, text: 'dup' },
        { offsets: { from: 1000, to: 2000 }, text: 'dup' },
        { offsets: { from: 2000, to: 3000 }, text: 'unique' },
      ],
    }
    const jsonPath = writeTempJson(data)
    const result = parseWhisperJson(jsonPath, 'en')
    expect(result.segments).toHaveLength(2)
  })
})
