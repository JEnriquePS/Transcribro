import axios from "axios";
import type {
  JobDetail,
  JobMetadata,
  ModelInfo,
  TranscriptionConfig,
  TranscriptResult,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export async function transcribeSingle(
  file: File,
  config: TranscriptionConfig,
): Promise<JobMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", config.model);
  formData.append("language", config.language);
  if (config.threads != null) {
    formData.append("threads", String(config.threads));
  }

  const response = await api.post<JobMetadata>("/transcribe", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function transcribeBatch(
  files: File[],
  config: TranscriptionConfig,
): Promise<JobMetadata[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("model", config.model);
  formData.append("language", config.language);
  if (config.threads != null) {
    formData.append("threads", String(config.threads));
  }

  const response = await api.post<JobMetadata[]>(
    "/transcribe/batch",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function getJobs(): Promise<JobMetadata[]> {
  const response = await api.get<{ jobs: JobMetadata[] }>("/jobs");
  return response.data.jobs;
}

export async function getJob(jobId: string): Promise<JobDetail> {
  const response = await api.get(`/jobs/${jobId}`);
  const data = response.data;

  const metadata: JobMetadata = {
    job_id: data.job_id,
    original_filename: data.original_filename,
    status: data.status,
    config: data.config,
    error: data.error,
    progress: data.progress,
    extraction_progress: data.extraction_progress ?? 0,
    transcription_progress: data.transcription_progress ?? 0,
    formatting_progress: data.formatting_progress ?? 0,
    last_offset_ms: data.last_offset_ms ?? null,
    created_at: data.created_at ?? null,
    started_at: data.started_at ?? null,
    completed_at: data.completed_at ?? null,
    duration_seconds: data.duration_seconds ?? null,
  };

  const result: TranscriptResult | null = data.result ?? null;

  return { metadata, result };
}

export async function downloadFile(
  jobId: string,
  format: string,
): Promise<Blob> {
  const response = await api.get(`/jobs/${jobId}/download`, {
    params: { format },
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function previewFile(
  jobId: string,
  format: string,
): Promise<string> {
  const response = await api.get<string>(`/jobs/${jobId}/download`, {
    params: { format },
    responseType: "text",
  });
  return response.data;
}

export async function deleteJob(jobId: string): Promise<void> {
  await api.delete(`/jobs/${jobId}`);
}

export interface PartialTranscript {
  readonly segments: ReadonlyArray<{ start: number; end: number; text: string }>;
  readonly text: string;
}

export async function getPartialTranscript(jobId: string): Promise<PartialTranscript> {
  const response = await api.get<PartialTranscript>(`/jobs/${jobId}/partial-transcript`);
  return { segments: response.data.segments ?? [], text: response.data.text ?? "" };
}

export async function retryJob(jobId: string, resume = false): Promise<void> {
  await api.post(`/jobs/${jobId}/retry`, null, { params: { resume } });
}

export async function getModels(): Promise<{ models: ModelInfo[]; default: string }> {
  const response = await api.get<{ models: ModelInfo[]; default: string }>("/models");
  return response.data;
}

export interface ModelDownloadStatus {
  readonly status: "ready" | "downloading" | "not_downloaded" | "failed";
  readonly size_mb?: number;
  readonly progress_mb?: number;
  readonly error?: string;
}

export async function getModelStatus(name: string): Promise<ModelDownloadStatus> {
  const response = await api.get<ModelDownloadStatus>(`/models/${name}/status`);
  return response.data;
}

export async function downloadModel(name: string): Promise<void> {
  await api.post(`/models/${name}/download`);
}

export async function cancelDownload(name: string): Promise<void> {
  await api.delete(`/models/${name}/download`);
}

export async function deleteModel(name: string): Promise<void> {
  await api.delete(`/models/${name}`);
}

export async function setDefaultModel(name: string): Promise<void> {
  await api.put("/models/default", null, { params: { name } });
}

export default api;
