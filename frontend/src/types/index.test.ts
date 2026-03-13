import { describe, it, expect } from "vitest";
import {
  JobStatus,
  type TranscriptionConfig,
  type JobMetadata,
  type TranscriptSegment,
  type TranscriptResult,
  type ModelInfo,
  type JobDetail,
} from "./index";

describe("Type definitions", () => {
  it("exports JobStatus enum with expected values", () => {
    expect(JobStatus.PENDING).toBe("pending");
    expect(JobStatus.EXTRACTING).toBe("extracting");
    expect(JobStatus.TRANSCRIBING).toBe("transcribing");
    expect(JobStatus.FORMATTING).toBe("formatting");
    expect(JobStatus.COMPLETED).toBe("completed");
    expect(JobStatus.FAILED).toBe("failed");
  });

  it("allows creating objects conforming to TranscriptionConfig", () => {
    const config: TranscriptionConfig = { model: "base", language: "en" };
    expect(config.model).toBe("base");
    expect(config.language).toBe("en");
  });

  it("allows creating objects conforming to JobMetadata", () => {
    const job: JobMetadata = {
      job_id: "test-1",
      original_filename: "video.mp4",
      status: JobStatus.PENDING,
      config: { model: "base", language: "en" },
      error: null,
      progress: 0,
      extraction_progress: 0,
      transcription_progress: 0,
      formatting_progress: 0,
      last_offset_ms: null,
      created_at: null,
      started_at: null,
      completed_at: null,
      duration_seconds: null,
    };
    expect(job.job_id).toBe("test-1");
    expect(job.status).toBe(JobStatus.PENDING);
  });

  it("allows creating objects conforming to TranscriptSegment", () => {
    const segment: TranscriptSegment = { start: 0, end: 5.5, text: "Hello" };
    expect(segment.start).toBe(0);
    expect(segment.end).toBe(5.5);
    expect(segment.text).toBe("Hello");
  });

  it("allows creating objects conforming to TranscriptResult", () => {
    const result: TranscriptResult = {
      job_id: "test-1",
      original_filename: "video.mp4",
      model: "base",
      language: "en",
      segments: [{ start: 0, end: 1, text: "Hi" }],
      full_text: "Hi",
    };
    expect(result.segments).toHaveLength(1);
  });

  it("allows creating objects conforming to ModelInfo", () => {
    const model: ModelInfo = {
      name: "base",
      size_mb: 142,
      available: true,
    };
    expect(model.name).toBe("base");
    expect(model.available).toBe(true);
  });

  it("allows creating objects conforming to JobDetail", () => {
    const detail: JobDetail = {
      metadata: {
        job_id: "test-1",
        original_filename: "video.mp4",
        status: JobStatus.COMPLETED,
        config: { model: "base", language: "en" },
        error: null,
        progress: 100,
        extraction_progress: 100,
        transcription_progress: 100,
        formatting_progress: 100,
        last_offset_ms: null,
        created_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-01T00:00:01Z",
        completed_at: "2026-01-01T00:01:00Z",
        duration_seconds: 59,
      },
      result: null,
    };
    expect(detail.metadata.status).toBe(JobStatus.COMPLETED);
    expect(detail.result).toBeNull();
  });
});
