import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  isValidFile,
  getExtension,
  formatFileSize,
  FileUploader,
} from "./FileUploader";

function createFile(name: string): File {
  return new File(["content"], name, { type: "application/octet-stream" });
}

describe("getExtension", () => {
  it("extracts lowercase extension from filename", () => {
    expect(getExtension("video.MP4")).toBe(".mp4");
    expect(getExtension("clip.mkv")).toBe(".mkv");
  });

  it("returns empty string when no extension", () => {
    expect(getExtension("noextension")).toBe("");
  });

  it("handles multiple dots in filename", () => {
    expect(getExtension("my.video.file.avi")).toBe(".avi");
  });
});

describe("isValidFile", () => {
  it("accepts valid video and audio extensions", () => {
    const validNames = [
      "video.mp4",
      "clip.mkv",
      "movie.avi",
      "recording.mov",
      "stream.webm",
      "song.mp3",
      "audio.wav",
      "music.flac",
      "podcast.ogg",
      "voice.m4a",
    ];

    for (const name of validNames) {
      expect(isValidFile(createFile(name))).toBe(true);
    }
  });

  it("rejects invalid extensions", () => {
    expect(isValidFile(createFile("document.pdf"))).toBe(false);
    expect(isValidFile(createFile("image.png"))).toBe(false);
    expect(isValidFile(createFile("script.js"))).toBe(false);
    expect(isValidFile(createFile("readme.txt"))).toBe(false);
    expect(isValidFile(createFile("noext"))).toBe(false);
  });

  it("handles case-insensitive extensions", () => {
    expect(isValidFile(createFile("VIDEO.MP4"))).toBe(true);
    expect(isValidFile(createFile("clip.MKV"))).toBe(true);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
  });
});

describe("FileUploader component", () => {
  it("renders the upload area with instructions", () => {
    const onFilesSelected = vi.fn();
    render(<FileUploader onFilesSelected={onFilesSelected} />);

    expect(
      screen.getByText(/drag & drop video files here/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/supported:/i)).toBeInTheDocument();
  });

  it("renders a hidden file input", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(
      <FileUploader onFilesSelected={onFilesSelected} />,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).toHaveClass("hidden");
  });
});
