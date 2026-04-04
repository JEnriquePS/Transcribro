import { describe, it, expect } from 'vitest'
import { validateJobId, validateFileExtension, validateFileSize } from '../../src/main/domain/validation'
import { UnsupportedFormatError, FileSizeExceededError } from '../../src/main/domain/errors'
import { MAX_FILE_SIZE } from '../../src/shared/constants'

describe('validateJobId', () => {
  it('returns valid id unchanged', () => {
    const id = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    expect(validateJobId(id)).toBe(id)
  })

  it('throws on invalid format', () => {
    expect(() => validateJobId('bad')).toThrow()
    expect(() => validateJobId('A'.repeat(32))).toThrow()
  })
})

describe('validateFileExtension', () => {
  it.each(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.mp3', '.wav', '.flac', '.ogg', '.m4a'])(
    'accepts %s',
    (ext) => {
      expect(() => validateFileExtension(`/tmp/file${ext}`)).not.toThrow()
    },
  )

  it('throws UnsupportedFormatError for unknown extension', () => {
    expect(() => validateFileExtension('/tmp/file.pdf')).toThrow(UnsupportedFormatError)
  })

  it('throws UnsupportedFormatError when there is no extension', () => {
    expect(() => validateFileExtension('/tmp/file')).toThrow(UnsupportedFormatError)
  })
})

describe('validateFileSize', () => {
  it('accepts size within limit', () => {
    expect(() => validateFileSize(1024)).not.toThrow()
    expect(() => validateFileSize(MAX_FILE_SIZE)).not.toThrow()
  })

  it('throws FileSizeExceededError when size exceeds limit', () => {
    expect(() => validateFileSize(MAX_FILE_SIZE + 1)).toThrow(FileSizeExceededError)
  })
})
