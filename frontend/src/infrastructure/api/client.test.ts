import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { transcribeSingle, getJobs, deleteJob } from "./client";
import type { TranscriptionConfig } from "../../domain/types";

vi.mock("axios", () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

function getMockApi() {
  return axios.create() as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
}

describe("API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transcribeSingle", () => {
    it("creates correct FormData and posts to /api/transcribe", async () => {
      const mockApi = getMockApi();
      const jobMetadata = {
        job_id: "abc-123",
        original_filename: "video.mp4",
        status: "pending",
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
      mockApi.post.mockResolvedValueOnce({ data: jobMetadata });

      const file = new File(["video content"], "video.mp4", {
        type: "video/mp4",
      });
      const config: TranscriptionConfig = { model: "base", language: "en" };

      const result = await transcribeSingle(file, config);

      expect(mockApi.post).toHaveBeenCalledOnce();
      const [url, formData, options] = mockApi.post.mock.calls[0] as [
        string,
        FormData,
        { headers: Record<string, string> },
      ];
      expect(url).toBe("/transcribe");
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get("file")).toBeInstanceOf(File);
      expect(formData.get("model")).toBe("base");
      expect(formData.get("language")).toBe("en");
      expect(options.headers["Content-Type"]).toBe("multipart/form-data");
      expect(result).toEqual(jobMetadata);
    });

    it("includes threads in FormData when provided", async () => {
      const mockApi = getMockApi();
      mockApi.post.mockResolvedValueOnce({ data: {} });

      const file = new File(["data"], "clip.mp4", { type: "video/mp4" });
      const config: TranscriptionConfig = {
        model: "small",
        language: "es",
        threads: 4,
      };

      await transcribeSingle(file, config);

      const formData = mockApi.post.mock.calls[0]![1] as FormData;
      expect(formData.get("threads")).toBe("4");
    });
  });

  describe("getJobs", () => {
    it("returns parsed jobs array from response", async () => {
      const mockApi = getMockApi();
      const jobs = [
        {
          job_id: "1",
          original_filename: "a.mp4",
          status: "completed",
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
        {
          job_id: "2",
          original_filename: "b.mkv",
          status: "pending",
          config: { model: "small", language: "fr" },
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
        },
      ];
      mockApi.get.mockResolvedValueOnce({ data: { jobs } });

      const result = await getJobs();

      expect(mockApi.get).toHaveBeenCalledWith("/jobs");
      expect(result).toEqual(jobs);
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteJob", () => {
    it("calls DELETE on /jobs/:jobId", async () => {
      const mockApi = getMockApi();
      mockApi.delete.mockResolvedValueOnce({ data: {} });

      await deleteJob("job-42");

      expect(mockApi.delete).toHaveBeenCalledOnce();
      expect(mockApi.delete).toHaveBeenCalledWith("/jobs/job-42");
    });
  });
});
