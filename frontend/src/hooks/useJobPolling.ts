import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, getJobs } from "../api/client";
import { JobStatus, type JobMetadata, type TranscriptResult } from "../types";

function isTerminal(status: JobStatus): boolean {
  return status === JobStatus.COMPLETED || status === JobStatus.FAILED;
}

interface UseJobPollingResult {
  readonly metadata: JobMetadata | null;
  readonly result: TranscriptResult | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function useJobPolling(
  jobId: string,
  enabled: boolean,
): UseJobPollingResult {
  const [metadata, setMetadata] = useState<JobMetadata | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  const fetchJob = useCallback(async () => {
    try {
      const detail = await getJob(jobId);
      setMetadata(detail.metadata);
      setResult(detail.result);
      setError(null);
      setIsLoading(false);

      if (isTerminal(detail.metadata.status)) {
        stoppedRef.current = true;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch job";
      setError(message);
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    stoppedRef.current = false;
    setIsLoading(true);
    setMetadata(null);
    setResult(null);
    setError(null);

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetchJob();

    const interval = setInterval(() => {
      if (!stoppedRef.current) {
        fetchJob();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, enabled, fetchJob]);

  return { metadata, result, isLoading, error };
}

interface UseJobsPollingResult {
  readonly jobs: readonly JobMetadata[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function useJobsPolling(enabled: boolean): UseJobsPollingResult {
  const [jobs, setJobs] = useState<readonly JobMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getJobs();
      setJobs(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch jobs";
      setError(message);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetchJobs();

    const interval = setInterval(() => {
      fetchJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, fetchJobs]);

  return { jobs, isLoading, error };
}
