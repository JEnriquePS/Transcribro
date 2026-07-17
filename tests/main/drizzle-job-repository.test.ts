import { describe, it, expect, beforeEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { initDb, resetDb } from '../../src/main/infrastructure/db/client'
import { runMigrations } from '../../src/main/infrastructure/db/migrate'
import { DrizzleJobRepository } from '../../src/main/infrastructure/repositories/drizzle-job-repository'
import { DrizzleFolderRepository } from '../../src/main/infrastructure/repositories/drizzle-folder-repository'
import { JobNotFoundError, UnsupportedFormatError } from '../../src/main/domain/errors'
import { JobStatus } from '../../src/shared/types'
import type { JobMetadata } from '../../src/shared/types'

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transcribro-test-'))
}

function makeJob(overrides: Partial<JobMetadata> = {}): JobMetadata {
  return {
    id:                   'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    originalFilename:     'video.mp4',
    displayName:          null,
    status:               JobStatus.PENDING,
    config:               { model: 'large-v3', language: 'es' },
    error:                null,
    progress:             0,
    extractionProgress:    0,
    transcriptionProgress: 0,
    formattingProgress:    0,
    lastOffsetMs:          null,
    createdAt:             '2026-01-01T00:00:00Z',
    startedAt:             null,
    completedAt:           null,
    durationSeconds:       null,
    ...overrides,
  }
}

describe('DrizzleJobRepository', () => {
  let repo: DrizzleJobRepository
  let folderRepo: DrizzleFolderRepository
  let jobFilesDir: string

  beforeEach(() => {
    resetDb()
    jobFilesDir = makeTmpDir()
    const db = initDb(':memory:')
    runMigrations(db)
    repo = new DrizzleJobRepository(db, jobFilesDir)
    folderRepo = new DrizzleFolderRepository(db)
  })

  // ── save / get ─────────────────────────────────────────────────────────────

  it('saves and retrieves a job', () => {
    const job = makeJob()
    repo.save(job)
    const result = repo.get(job.id)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(job.id)
    expect(result!.originalFilename).toBe('video.mp4')
    expect(result!.status).toBe(JobStatus.PENDING)
  })

  it('returns null for a missing job', () => {
    expect(repo.get('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBeNull()
  })

  it('upserts on duplicate save', () => {
    const job = makeJob()
    repo.save(job)
    repo.save({ ...job, status: JobStatus.COMPLETED })
    const updated = repo.get(job.id)!
    expect(updated.status).toBe(JobStatus.COMPLETED)
  })

  it('creates the job directory on save', () => {
    repo.save(makeJob())
    expect(fs.existsSync(path.join(jobFilesDir, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'))).toBe(true)
  })

  // ── list ───────────────────────────────────────────────────────────────────

  it('lists zero jobs when empty', () => {
    const { jobs, total } = repo.list()
    expect(jobs).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('lists saved jobs with correct total', () => {
    const id1 = 'b1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const id2 = 'c1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    repo.save(makeJob({ id: id1, createdAt: '2026-01-01T00:00:00Z' }))
    repo.save(makeJob({ id: id2, createdAt: '2026-01-02T00:00:00Z' }))
    const { jobs, total } = repo.list()
    expect(total).toBe(2)
    expect(jobs).toHaveLength(2)
  })

  it('paginates correctly', () => {
    for (let i = 0; i < 5; i++) {
      const hex = i.toString(16).padStart(2, '0')
      repo.save(makeJob({ id: `${hex}b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4` }))
    }
    const { jobs, total } = repo.list(2, 0)
    expect(total).toBe(5)
    expect(jobs).toHaveLength(2)
  })

  it('search matches by original filename', () => {
    repo.save(makeJob({ originalFilename: 'invoice-review.mp4' }))
    const { jobs, total } = repo.list(50, 0, undefined, 'invoice')
    expect(total).toBe(1)
    expect(jobs[0].originalFilename).toBe('invoice-review.mp4')
  })

  it('search matches by display name', () => {
    const job = makeJob()
    repo.save(job)
    repo.update(job.id, { displayName: 'Q3 planning session' })
    const { jobs, total } = repo.list(50, 0, undefined, 'planning')
    expect(total).toBe(1)
    expect(jobs[0].id).toBe(job.id)
  })

  it('search matches inside the full transcript text', () => {
    const id1 = 'd1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const id2 = 'e1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    repo.save(makeJob({ id: id1, originalFilename: 'meeting-1.mp4' }))
    repo.save(makeJob({ id: id2, originalFilename: 'meeting-2.mp4' }))
    repo.saveResult(
      { jobId: id1, originalFilename: 'meeting-1.mp4', model: 'large-v3', language: 'es', fullText: 'hablamos del presupuesto anual', segments: [] },
      '{}',
    )
    repo.saveResult(
      { jobId: id2, originalFilename: 'meeting-2.mp4', model: 'large-v3', language: 'es', fullText: 'revisamos el roadmap del producto', segments: [] },
      '{}',
    )

    const { jobs, total } = repo.list(50, 0, undefined, 'presupuesto')
    expect(total).toBe(1)
    expect(jobs[0].id).toBe(id1)
  })

  it('search combines with folder filter', () => {
    const f = folderRepo.create('Work')
    repo.save(makeJob({ originalFilename: 'budget-call.mp4', folderId: f.id }))
    repo.save(makeJob({ id: 'f1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', originalFilename: 'budget-call.mp4', folderId: null }))

    const { jobs, total } = repo.list(50, 0, [f.id], 'budget')
    expect(total).toBe(1)
    expect(jobs[0].folderId).toBe(f.id)
  })

  // ── update ─────────────────────────────────────────────────────────────────

  it('updates a job field', () => {
    repo.save(makeJob())
    const updated = repo.update('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', {
      status: JobStatus.EXTRACTING,
      progress: 0.1,
    })
    expect(updated.status).toBe(JobStatus.EXTRACTING)
    expect(updated.progress).toBe(0.1)
  })

  it('throws JobNotFoundError when updating a missing job', () => {
    expect(() =>
      repo.update('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', { status: JobStatus.FAILED }),
    ).toThrow(JobNotFoundError)
  })

  // ── delete ─────────────────────────────────────────────────────────────────

  it('deletes a job and removes its directory', () => {
    const job = makeJob()
    repo.save(job)
    repo.delete(job.id)
    expect(repo.get(job.id)).toBeNull()
    expect(fs.existsSync(path.join(jobFilesDir, job.id))).toBe(false)
  })

  it('delete is a no-op for non-existent jobs', () => {
    expect(() => repo.delete('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).not.toThrow()
  })

  // ── output files ──────────────────────────────────────────────────────────

  it('returns null for a missing output file', () => {
    repo.save(makeJob())
    expect(repo.getOutputFile('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'txt')).toBeNull()
  })

  it('returns path for existing output file', () => {
    const job = makeJob()
    repo.save(job)
    const txtPath = path.join(jobFilesDir, job.id, 'transcript.txt')
    fs.writeFileSync(txtPath, 'hello', 'utf8')
    expect(repo.getOutputFile(job.id, 'txt')).toBe(txtPath)
  })

  it('throws UnsupportedFormatError for unknown format', () => {
    repo.save(makeJob())
    expect(() => repo.getOutputFile('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'pdf')).toThrow(
      UnsupportedFormatError,
    )
  })

  // ── partial segments ──────────────────────────────────────────────────────

  it('returns empty array when no partial segments exist', () => {
    repo.save(makeJob())
    expect(repo.getPartialSegments('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toEqual([])
  })

  it('saves and retrieves partial segments', () => {
    const job = makeJob()
    repo.save(job)
    const segs = [
      { start: 0, end: 1, text: 'hello' },
      { start: 1, end: 2, text: 'world' },
    ]
    repo.savePartialSegments(job.id, segs)
    const retrieved = repo.getPartialSegments(job.id)
    expect(retrieved).toHaveLength(2)
    expect(retrieved[0].text).toBe('hello')
  })

  it('replaces partial segments on subsequent save', () => {
    const job = makeJob()
    repo.save(job)
    repo.savePartialSegments(job.id, [{ start: 0, end: 1, text: 'one' }])
    repo.savePartialSegments(job.id, [
      { start: 0, end: 1, text: 'a' },
      { start: 1, end: 2, text: 'b' },
    ])
    expect(repo.getPartialSegments(job.id)).toHaveLength(2)
  })

  // ── final result ──────────────────────────────────────────────────────────

  it('saves and retrieves a transcript result', () => {
    const job = makeJob()
    repo.save(job)
    const result = {
      jobId:            job.id,
      originalFilename: 'video.mp4',
      model:            'large-v3',
      language:         'es',
      fullText:         'Hola mundo',
      segments:         [{ start: 0, end: 3, text: 'Hola mundo' }],
    }
    repo.saveResult(result, '{"enriched":true}')
    const retrieved = repo.getResult(job.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.fullText).toBe('Hola mundo')
    expect(retrieved!.segments).toHaveLength(1)
  })

  it('cascade-deletes segments and results when job is deleted', () => {
    const job = makeJob()
    repo.save(job)
    repo.savePartialSegments(job.id, [{ start: 0, end: 1, text: 'test' }])
    repo.delete(job.id)
    // After delete, segment queries should return empty
    expect(repo.getPartialSegments(job.id)).toEqual([])
  })

  // ── countByFolder ──────────────────────────────────────────────────────────

  it('returns an empty object when no jobs have a folder', () => {
    repo.save(makeJob())
    expect(repo.countByFolder()).toEqual({})
  })

  it('counts jobs directly per folder, without rolling up to parent folders', () => {
    const parent = folderRepo.create('Parent')
    const child = folderRepo.create('Child', parent.id)

    const idA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const idB = 'b1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const idC = 'c1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    repo.save(makeJob({ id: idA, folderId: parent.id }))
    repo.save(makeJob({ id: idB, folderId: parent.id }))
    repo.save(makeJob({ id: idC, folderId: child.id }))

    expect(repo.countByFolder()).toEqual({ [parent.id]: 2, [child.id]: 1 })
  })
})
