import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createYtDlpDownloader, type ProcessRunner } from "./yt-dlp";
import { BoundaryError } from "./video-ingestion";

describe("createYtDlpDownloader", () => {
  it("downloads one video through an argument-safe process boundary", async () => {
    const directory = "/private/tmp/capcheck-demo";
    const run: ProcessRunner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: `${directory}/creator-123.mp4\n`,
      stderr: "",
    });
    const signal = new AbortController().signal;
    const fileSize = vi.fn().mockResolvedValue(1024);
    const downloader = createYtDlpDownloader({
      executable: "/opt/homebrew/bin/yt-dlp",
      maxFileSize: "50M",
      run,
      fileSize,
    });

    await expect(
      downloader.download({
        url: "https://www.youtube.com/shorts/demo123",
        directory,
        signal,
      }),
    ).resolves.toEqual({
      path: path.join(directory, "creator-123.mp4"),
      fileName: "creator-123.mp4",
      size: 1024,
    });
    expect(fileSize).toHaveBeenCalledWith(path.join(directory, "creator-123.mp4"));

    expect(run).toHaveBeenCalledWith({
      executable: "/opt/homebrew/bin/yt-dlp",
      args: [
        "--no-playlist",
        "--max-filesize",
        "50M",
        "--restrict-filenames",
        "--output",
        path.join(directory, "%(id)s.%(ext)s"),
        "--print",
        "after_move:filepath",
        "--",
        "https://www.youtube.com/shorts/demo123",
      ],
      cwd: directory,
      shell: false,
      signal,
    });
  });

  it("reports the on-disk byte size when the filesize guard is bypassed", async () => {
    const directory = "/private/tmp/capcheck-demo";
    const run: ProcessRunner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: `${directory}/creator-123.mp4\n`,
      stderr: "",
    });
    const fileSize = vi.fn().mockResolvedValue(50 * 1024 * 1024 + 1);
    const downloader = createYtDlpDownloader({
      maxFileSize: "50M",
      run,
      fileSize,
    });

    await expect(
      downloader.download({
        url: "https://www.youtube.com/shorts/demo123",
        directory,
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      path: path.join(directory, "creator-123.mp4"),
      fileName: "creator-123.mp4",
      size: 50 * 1024 * 1024 + 1,
    });
  });

  it("rejects a reported output path outside the supplied temporary directory", async () => {
    const run: ProcessRunner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "/private/tmp/another-job/stolen.mp4\n",
      stderr: "",
    });
    const downloader = createYtDlpDownloader({
      executable: "yt-dlp",
      maxFileSize: "50M",
      run,
    });

    await expect(
      downloader.download({
        url: "https://www.tiktok.com/@creator/video/123",
        directory: "/private/tmp/capcheck-demo",
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new BoundaryError("yt-dlp returned an unsafe output path.", false),
    );
  });

  it("uses a safe boundary error when the yt-dlp executable is unavailable", async () => {
    const downloader = createYtDlpDownloader({
      executable: "capcheck-yt-dlp-does-not-exist",
      maxFileSize: "50M",
    });

    await expect(
      downloader.download({
        url: "https://youtu.be/demo123",
        directory: "/private/tmp",
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new BoundaryError("yt-dlp is unavailable on this server.", false),
    );
  });

  it("does not expose private-link stderr or local paths", async () => {
    const run: ProcessRunner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr:
        "Private video: cookies=/Users/aziz/.config/yt-dlp/cookies.txt token=secret",
    });
    const downloader = createYtDlpDownloader({ run });

    const download = downloader.download({
      url: "https://www.tiktok.com/@creator/video/123",
      directory: "/private/tmp/capcheck-demo",
      signal: new AbortController().signal,
    });

    await expect(download).rejects.toEqual(
      new BoundaryError("yt-dlp could not download this video.", false),
    );
    await expect(download).rejects.not.toThrow(/cookies|secret|Users/u);
  });

  it("preserves cancellation while passing the AbortSignal to the runner", async () => {
    const controller = new AbortController();
    const cancellation = new DOMException("The operation was aborted", "AbortError");
    const run: ProcessRunner = vi.fn().mockImplementation(async ({ signal }) => {
      expect(signal).toBe(controller.signal);
      controller.abort(cancellation);
      throw cancellation;
    });
    const downloader = createYtDlpDownloader({ run });

    await expect(
      downloader.download({
        url: "https://youtu.be/demo123",
        directory: "/private/tmp/capcheck-demo",
        signal: controller.signal,
      }),
    ).rejects.toBe(cancellation);
  });
});
