import { useCallback, useEffect, useRef, useState } from 'react'
import { ipc } from '../../infrastructure/ipc-client'
import type { JobDetail, JobMetadata } from '../../../shared/types'
import { JobStatus } from '../../../shared/types'
import { IPC } from '../../../shared/ipc-channels'

const TERMINAL_STATUSES = new Set<JobStatus>([JobStatus.COMPLETED, JobStatus.FAILED])

// ── Single job polling + push events ────────────────────────────────────────

interface UseJobPollingResult {
  readonly metadata: JobDetail['metadata'] | null
  readonly result: JobDetail['result'] | null
  readonly isLoading: boolean
  readonly error: string | null
}

export function useJobPolling(jobId: string, enabled: boolean): UseJobPollingResult {
  const [metadata, setMetadata] = useState<JobDetail['metadata'] | null>(null)
  const [result, setResult] = useState<JobDetail['result'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const fetchJob = useCallback(async () => {
    if (!enabled || !jobId) return
    try {
      const detail = await ipc.getJob(jobId)
      if (!mountedRef.current) return
      setMetadata(detail.metadata)
      setResult(detail.result ?? null)
      setIsLoading(false)
      if (TERMINAL_STATUSES.has(detail.metadata.status)) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load job')
      setIsLoading(false)
    }
  }, [jobId, enabled])

  useEffect(() => {
    if (!enabled || !jobId) return
    mountedRef.current = true
    setIsLoading(true)
    fetchJob()

    // Fallback polling in case push events are missed
    pollingRef.current = setInterval(fetchJob, 3000)

    // Subscribe to push events for this job
    const cleanupProgress = ipc.onJobProgress((event) => {
      if (event.jobId !== jobId || !mountedRef.current) return
      setMetadata((prev) =>
        prev
          ? {
              ...prev,
              status: event.status,
              progress: event.progress,
              extractionProgress: event.extractionProgress ?? prev.extractionProgress,
              transcriptionProgress: event.transcriptionProgress ?? prev.transcriptionProgress,
              formattingProgress: event.formattingProgress ?? prev.formattingProgress,
            }
          : prev,
      )
    })

    const cleanupCompleted = ipc.onJobCompleted((event) => {
      if (event.jobId !== jobId || !mountedRef.current) return
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      // Fetch final state to get result
      fetchJob()
    })

    const cleanupFailed = ipc.onJobFailed((event) => {
      if (event.jobId !== jobId || !mountedRef.current) return
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
      setMetadata((prev) =>
        prev ? { ...prev, status: JobStatus.FAILED, error: event.error } : prev,
      )
    })

    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearInterval(pollingRef.current)
      cleanupProgress()
      cleanupCompleted()
      cleanupFailed()
    }
  }, [jobId, enabled, fetchJob])

  return { metadata, result, isLoading, error }
}

// ── All jobs polling + push events ───────────────────────────────────────────

interface UseJobsPollingResult {
  readonly jobs: readonly JobMetadata[]
  readonly isLoading: boolean
  readonly error: string | null
}

export function useJobsPolling(enabled: boolean, folderId?: string | null): UseJobsPollingResult {
  const [jobs, setJobs] = useState<readonly JobMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchJobs = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await ipc.listJobs(100, 0, folderId)
      if (!mountedRef.current) return
      setJobs(data.jobs)
      setIsLoading(false)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
      setIsLoading(false)
    }
  }, [enabled, folderId])

  useEffect(() => {
    if (!enabled) return
    mountedRef.current = true
    setIsLoading(true)
    fetchJobs()

    const interval = setInterval(fetchJobs, 3000)

    // Push events trigger immediate refresh
    const cleanupProgress = window.electronAPI.on(
      IPC.JOB_PROGRESS,
      () => { fetchJobs() },
    )
    const cleanupCompleted = window.electronAPI.on(
      IPC.JOB_COMPLETED,
      () => { fetchJobs() },
    )
    const cleanupFailed = window.electronAPI.on(
      IPC.JOB_FAILED,
      () => { fetchJobs() },
    )

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      cleanupProgress()
      cleanupCompleted()
      cleanupFailed()
    }
  }, [enabled, folderId, fetchJobs])

  return { jobs, isLoading, error }
}
