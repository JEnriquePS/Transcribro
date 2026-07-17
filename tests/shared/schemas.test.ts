import { describe, it, expect } from 'vitest'
import {
  jobIdSchema,
  transcriptionConfigSchema,
  createJobInputSchema,
  createBatchInputSchema,
  renameJobInputSchema,
  downloadInputSchema,
  retryJobInputSchema,
  paginationInputSchema,
  jobGetInputSchema,
  jobDeleteInputSchema,
  modelSetDefaultInputSchema,
  modelNameInputSchema,
  whisperSettingsSchema,
} from '../../src/shared/schemas'
import { DEFAULT_MODEL, DEFAULT_LANGUAGE, WHISPER_DEFAULTS } from '../../src/shared/constants'

// ── jobIdSchema ───────────────────────────────────────────────────────────────

describe('jobIdSchema', () => {
  it('accepts a valid 32-char lowercase hex string', () => {
    const id = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    expect(jobIdSchema.parse(id)).toBe(id)
  })

  it('rejects uppercase hex', () => {
    expect(() => jobIdSchema.parse('A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4')).toThrow()
  })

  it('rejects strings shorter than 32 chars', () => {
    expect(() => jobIdSchema.parse('abc123')).toThrow()
  })

  it('rejects strings longer than 32 chars', () => {
    expect(() => jobIdSchema.parse('a'.repeat(33))).toThrow()
  })

  it('rejects non-hex characters', () => {
    expect(() => jobIdSchema.parse('z1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toThrow()
  })
})

// ── transcriptionConfigSchema ─────────────────────────────────────────────────

describe('transcriptionConfigSchema', () => {
  it('uses defaults when model and language are omitted', () => {
    const result = transcriptionConfigSchema.parse({})
    expect(result.model).toBe(DEFAULT_MODEL)
    expect(result.language).toBe(DEFAULT_LANGUAGE)
  })

  it('accepts explicit model and language', () => {
    const result = transcriptionConfigSchema.parse({ model: 'small', language: 'en' })
    expect(result.model).toBe('small')
    expect(result.language).toBe('en')
  })

  it('accepts optional threads', () => {
    const result = transcriptionConfigSchema.parse({ threads: 4 })
    expect(result.threads).toBe(4)
  })

  it('rejects non-positive threads', () => {
    expect(() => transcriptionConfigSchema.parse({ threads: 0 })).toThrow()
    expect(() => transcriptionConfigSchema.parse({ threads: -1 })).toThrow()
  })

  it('rejects non-integer threads', () => {
    expect(() => transcriptionConfigSchema.parse({ threads: 1.5 })).toThrow()
  })

  it('rejects empty model string', () => {
    expect(() => transcriptionConfigSchema.parse({ model: '' })).toThrow()
  })
})

// ── createJobInputSchema ──────────────────────────────────────────────────────

describe('createJobInputSchema', () => {
  it('accepts a valid input', () => {
    const result = createJobInputSchema.parse({
      filePath: '/tmp/video.mp4',
      config: { model: 'large-v3', language: 'es' },
    })
    expect(result.filePath).toBe('/tmp/video.mp4')
    expect(result.config.model).toBe('large-v3')
  })

  it('rejects empty filePath', () => {
    expect(() =>
      createJobInputSchema.parse({ filePath: '', config: {} }),
    ).toThrow()
  })

  it('requires filePath field', () => {
    expect(() => createJobInputSchema.parse({ config: {} })).toThrow()
  })
})

// ── createBatchInputSchema ────────────────────────────────────────────────────

describe('createBatchInputSchema', () => {
  it('accepts one or more file paths', () => {
    const result = createBatchInputSchema.parse({
      filePaths: ['/tmp/a.mp4', '/tmp/b.mkv'],
      config: {},
    })
    expect(result.filePaths).toHaveLength(2)
  })

  it('rejects empty filePaths array', () => {
    expect(() =>
      createBatchInputSchema.parse({ filePaths: [], config: {} }),
    ).toThrow()
  })

  it('rejects file paths that are empty strings', () => {
    expect(() =>
      createBatchInputSchema.parse({ filePaths: [''], config: {} }),
    ).toThrow()
  })
})

// ── renameJobInputSchema ──────────────────────────────────────────────────────

describe('renameJobInputSchema', () => {
  const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'

  it('accepts valid jobId and displayName', () => {
    const result = renameJobInputSchema.parse({ jobId: validId, displayName: 'My interview' })
    expect(result.displayName).toBe('My interview')
  })

  it('rejects empty displayName', () => {
    expect(() => renameJobInputSchema.parse({ jobId: validId, displayName: '' })).toThrow()
  })

  it('rejects displayName longer than 255 chars', () => {
    expect(() =>
      renameJobInputSchema.parse({ jobId: validId, displayName: 'a'.repeat(256) }),
    ).toThrow()
  })

  it('rejects invalid jobId', () => {
    expect(() =>
      renameJobInputSchema.parse({ jobId: 'bad-id', displayName: 'ok' }),
    ).toThrow()
  })
})

// ── downloadInputSchema ───────────────────────────────────────────────────────

describe('downloadInputSchema', () => {
  const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'

  it.each(['txt', 'json', 'srt', 'vtt'])('accepts format "%s"', (format) => {
    const result = downloadInputSchema.parse({ jobId: validId, format })
    expect(result.format).toBe(format)
  })

  it('rejects unknown format', () => {
    expect(() => downloadInputSchema.parse({ jobId: validId, format: 'pdf' })).toThrow()
  })
})

// ── retryJobInputSchema ───────────────────────────────────────────────────────

describe('retryJobInputSchema', () => {
  const validId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'

  it('defaults resume to false', () => {
    const result = retryJobInputSchema.parse({ jobId: validId })
    expect(result.resume).toBe(false)
  })

  it('accepts resume:true', () => {
    const result = retryJobInputSchema.parse({ jobId: validId, resume: true })
    expect(result.resume).toBe(true)
  })
})

// ── paginationInputSchema ─────────────────────────────────────────────────────

describe('paginationInputSchema', () => {
  it('defaults limit to 50 and offset to 0', () => {
    const result = paginationInputSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('accepts custom limit and offset', () => {
    const result = paginationInputSchema.parse({ limit: 10, offset: 20 })
    expect(result.limit).toBe(10)
    expect(result.offset).toBe(20)
  })

  it('rejects limit above 200', () => {
    expect(() => paginationInputSchema.parse({ limit: 201 })).toThrow()
  })

  it('rejects negative offset', () => {
    expect(() => paginationInputSchema.parse({ offset: -1 })).toThrow()
  })

  it('rejects limit of 0', () => {
    expect(() => paginationInputSchema.parse({ limit: 0 })).toThrow()
  })
})

// ── jobGetInputSchema / jobDeleteInputSchema ──────────────────────────────────

describe('jobGetInputSchema', () => {
  it('accepts valid jobId', () => {
    const id = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    expect(jobGetInputSchema.parse({ jobId: id }).jobId).toBe(id)
  })

  it('rejects missing jobId', () => {
    expect(() => jobGetInputSchema.parse({})).toThrow()
  })
})

describe('jobDeleteInputSchema', () => {
  it('accepts valid jobId', () => {
    const id = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    expect(jobDeleteInputSchema.parse({ jobId: id }).jobId).toBe(id)
  })
})

// ── modelSetDefaultInputSchema / modelNameInputSchema ─────────────────────────

describe('modelSetDefaultInputSchema', () => {
  it('accepts non-empty name', () => {
    expect(modelSetDefaultInputSchema.parse({ name: 'large-v3' }).name).toBe('large-v3')
  })

  it('rejects empty name', () => {
    expect(() => modelSetDefaultInputSchema.parse({ name: '' })).toThrow()
  })
})

describe('modelNameInputSchema', () => {
  it('accepts non-empty name', () => {
    expect(modelNameInputSchema.parse({ name: 'medium' }).name).toBe('medium')
  })

  it('rejects empty name', () => {
    expect(() => modelNameInputSchema.parse({ name: '' })).toThrow()
  })
})

// ── whisperSettingsSchema ─────────────────────────────────────────────────────

describe('whisperSettingsSchema', () => {
  const validSettings = {
    defaultModel: DEFAULT_MODEL,
    defaultLanguage: DEFAULT_LANGUAGE,
    threads: WHISPER_DEFAULTS.threads,
    noSpeechThold: WHISPER_DEFAULTS.noSpeechThold,
    entropyThold: WHISPER_DEFAULTS.entropyThold,
    logprobThold: WHISPER_DEFAULTS.logprobThold,
    maxContext: WHISPER_DEFAULTS.maxContext,
  }

  it('accepts the shipped defaults', () => {
    expect(whisperSettingsSchema.parse(validSettings)).toEqual(validSettings)
  })

  it('accepts boundary values', () => {
    const boundaries = {
      ...validSettings,
      threads: 32,
      noSpeechThold: 1,
      entropyThold: 0,
      logprobThold: -20,
      maxContext: -1,
    }
    expect(whisperSettingsSchema.parse(boundaries)).toEqual(boundaries)
  })

  it('rejects threads out of range', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, threads: 0 })).toThrow()
    expect(() => whisperSettingsSchema.parse({ ...validSettings, threads: 33 })).toThrow()
  })

  it('rejects non-integer threads and maxContext', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, threads: 4.5 })).toThrow()
    expect(() => whisperSettingsSchema.parse({ ...validSettings, maxContext: 10.5 })).toThrow()
  })

  it('rejects noSpeechThold outside 0..1', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, noSpeechThold: -0.1 })).toThrow()
    expect(() => whisperSettingsSchema.parse({ ...validSettings, noSpeechThold: 1.1 })).toThrow()
  })

  it('rejects positive logprobThold', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, logprobThold: 0.5 })).toThrow()
  })

  it('rejects maxContext above the model maximum', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, maxContext: 225 })).toThrow()
  })

  it('rejects empty model or language', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, defaultModel: '' })).toThrow()
    expect(() => whisperSettingsSchema.parse({ ...validSettings, defaultLanguage: '' })).toThrow()
  })

  it('rejects NaN numeric fields', () => {
    expect(() => whisperSettingsSchema.parse({ ...validSettings, entropyThold: NaN })).toThrow()
  })
})
