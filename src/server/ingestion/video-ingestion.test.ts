import { describe, expect, it, vi } from "vitest";

import { ErrorEventSchema, ProgressEventSchema } from "@/domain/analysis";

import {
  BoundaryError,
  createVideoIngestor,
  IngestionError,
  mapIngestionError,
} from "./video-ingestion";

const makeHarness = (
  policyOverrides: Partial<{
    activationTimeoutMs: number;
    maxPollAttempts: number;
    maxVideoBytes: number;
    pollIntervalMs: number;
    uploadAttempts: number;
  }> = {},
) => {
  const progress: Array<unknown> = [];
  const temporaryFiles = {
    createDirectory: vi.fn().mockResolvedValue("/private/tmp/capcheck-123"),
    stageUpload: vi.fn().mockResolvedValue({
      path: "/private/tmp/capcheck-123/upload.webm",
      fileName: "upload.webm",
    }),
    removeDirectory: vi.fn().mockResolvedValue(undefined),
  };
  const ytDlp = {
    download: vi.fn().mockResolvedValue({
      path: "/private/tmp/capcheck-123/short.mp4",
      fileName: "short.mp4",
      size: 1024,
    }),
  };
  const mime = {
    detect: vi.fn().mockResolvedValue("video/mp4" as const),
  };
  const geminiFiles = {
    upload: vi.fn().mockResolvedValue({
      name: "files/demo",
      state: "PROCESSING" as const,
    }),
    get: vi.fn().mockResolvedValue({
      name: "files/demo",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
      mimeType: "video/mp4" as const,
      state: "ACTIVE" as const,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const now = vi.fn().mockReturnValue(0);
  const sleep = vi.fn().mockResolvedValue(undefined);
  const ingestor = createVideoIngestor(
    { temporaryFiles, ytDlp, mime, geminiFiles, now, sleep },
    {
      uploadAttempts: 2,
      pollIntervalMs: 1,
      maxPollAttempts: 3,
      activationTimeoutMs: 100,
      maxVideoBytes: 50 * 1024 * 1024,
      ...policyOverrides,
    },
  );

  return {
    geminiFiles,
    ingestor,
    mime,
    now,
    progress,
    sleep,
    temporaryFiles,
    ytDlp,
  };
};

describe("createVideoIngestor", () => {
  it("leases an ACTIVE Gemini file for a downloaded YouTube Short and cleans up", async () => {
    const {
      geminiFiles,
      ingestor,
      progress,
      temporaryFiles,
      ytDlp,
    } = makeHarness();

    const result = await ingestor.withActiveFile(
      {
        kind: "url",
        url: "https://www.youtube.com/shorts/demo123",
      },
      {
        signal: new AbortController().signal,
        onProgress: (event) => progress.push(ProgressEventSchema.parse(event)),
      },
      async (file) => {
        expect(geminiFiles.delete).not.toHaveBeenCalled();
        expect(temporaryFiles.removeDirectory).not.toHaveBeenCalled();
        return file;
      },
    );

    expect(result).toEqual({
      name: "files/demo",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
      mimeType: "video/mp4",
    });
    expect(ytDlp.download).toHaveBeenCalledWith({
      url: "https://www.youtube.com/shorts/demo123",
      directory: "/private/tmp/capcheck-123",
      signal: expect.any(AbortSignal),
    });
    expect(geminiFiles.upload).toHaveBeenCalledWith({
      path: "/private/tmp/capcheck-123/short.mp4",
      displayName: "short.mp4",
      mimeType: "video/mp4",
      signal: expect.any(AbortSignal),
    });
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "fetching",
        message: "Downloading the source video",
      },
      {
        type: "progress",
        stage: "processing",
        message: "Preparing the video with Gemini",
      },
    ]);
    expect(geminiFiles.delete).toHaveBeenCalledWith(
      "files/demo",
      expect.any(AbortSignal),
    );
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledWith(
      "/private/tmp/capcheck-123",
    );
  });

  it("stages a direct upload without calling yt-dlp", async () => {
    const {
      geminiFiles,
      ingestor,
      mime,
      progress,
      temporaryFiles,
      ytDlp,
    } = makeHarness();
    const bytes = new Uint8Array([1, 2, 3]);
    mime.detect.mockResolvedValue("video/webm");
    geminiFiles.upload.mockResolvedValue({
      name: "files/upload",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/upload",
      mimeType: "video/webm",
      state: "ACTIVE",
    });

    await ingestor.withActiveFile(
      {
        kind: "upload",
        fileName: "upload.webm",
        mimeType: "video/webm",
        bytes,
      },
      {
        signal: new AbortController().signal,
        onProgress: (event) => progress.push(ProgressEventSchema.parse(event)),
      },
      async () => undefined,
    );

    expect(ytDlp.download).not.toHaveBeenCalled();
    expect(temporaryFiles.stageUpload).toHaveBeenCalledWith({
      directory: "/private/tmp/capcheck-123",
      fileName: "upload.webm",
      bytes,
      signal: expect.any(AbortSignal),
    });
    expect(mime.detect).toHaveBeenCalledWith(
      "/private/tmp/capcheck-123/upload.webm",
      "video/webm",
    );
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "fetching",
        message: "Staging the uploaded video",
      },
      {
        type: "progress",
        stage: "processing",
        message: "Preparing the video with Gemini",
      },
    ]);
  });

  it("rejects an oversized direct upload before allocating temporary storage", async () => {
    const { geminiFiles, ingestor, temporaryFiles } = makeHarness({
      maxVideoBytes: 2,
    });

    await expect(
      ingestor.withActiveFile(
        {
          kind: "upload",
          fileName: "oversized.mp4",
          mimeType: "video/mp4",
          bytes: new Uint8Array([1, 2, 3]),
        },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "UPLOAD_TOO_LARGE",
        message: "Choose a video that is 50 MB or smaller.",
        retryable: false,
        offerUploadFallback: false,
      }),
    );
    expect(temporaryFiles.createDirectory).not.toHaveBeenCalled();
    expect(geminiFiles.upload).not.toHaveBeenCalled();
  });

  it("rejects an oversized download that slipped past the yt-dlp filesize guard", async () => {
    const { geminiFiles, ingestor, mime, temporaryFiles, ytDlp } = makeHarness({
      maxVideoBytes: 50 * 1024 * 1024,
    });
    ytDlp.download.mockResolvedValue({
      path: "/private/tmp/capcheck-123/short.mp4",
      fileName: "short.mp4",
      size: 50 * 1024 * 1024 + 1,
    });

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "SOURCE_VIDEO_TOO_LARGE",
        message: "Choose a video that is 50 MB or smaller.",
        retryable: false,
        offerUploadFallback: true,
      }),
    );
    expect(mime.detect).not.toHaveBeenCalled();
    expect(geminiFiles.upload).not.toHaveBeenCalled();
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledWith(
      "/private/tmp/capcheck-123",
    );
  });

  it("rejects unsupported or spoofed URLs with an upload fallback before download", async () => {
    const { ingestor, temporaryFiles, ytDlp } = makeHarness();

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://youtube.com.evil.test/shorts/demo" },
        {
          signal: new AbortController().signal,
          onProgress: vi.fn(),
        },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "UNSUPPORTED_VIDEO_URL",
        message:
          "Use a public TikTok or YouTube Shorts link, or upload the video file instead.",
        retryable: false,
        offerUploadFallback: true,
      }),
    );
    expect(temporaryFiles.createDirectory).not.toHaveBeenCalled();
    expect(ytDlp.download).not.toHaveBeenCalled();
  });

  it("turns a private or failed link into a safe upload-fallback error", async () => {
    const { ingestor, temporaryFiles, ytDlp } = makeHarness();
    ytDlp.download.mockRejectedValue(
      new Error("private video; wrote /private/tmp/capcheck-123/secret.mp4"),
    );

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.tiktok.com/@creator/video/123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "SOURCE_VIDEO_UNAVAILABLE",
        message:
          "We could not download that public video. Upload the video file instead.",
        retryable: false,
        offerUploadFallback: true,
      }),
    );
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledWith(
      "/private/tmp/capcheck-123",
    );
  });

  it("retries one transient Gemini upload failure", async () => {
    const { geminiFiles, ingestor, sleep } = makeHarness();
    geminiFiles.upload
      .mockRejectedValueOnce(new BoundaryError("rate limited", true))
      .mockResolvedValueOnce({
        name: "files/retried",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/retried",
        mimeType: "video/mp4",
        state: "ACTIVE",
      });

    await ingestor.withActiveFile(
      { kind: "url", url: "https://youtu.be/demo123" },
      { signal: new AbortController().signal, onProgress: vi.fn() },
      async () => undefined,
    );

    expect(geminiFiles.upload).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1, expect.any(AbortSignal));
  });

  it("does not retry a permanent upload failure and returns a safe error", async () => {
    const { geminiFiles, ingestor, temporaryFiles } = makeHarness();
    geminiFiles.upload.mockRejectedValue(
      new BoundaryError("403 key=super-secret", false),
    );

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "GEMINI_UPLOAD_FAILED",
        message: "Gemini could not accept this video. Try again.",
        retryable: false,
        offerUploadFallback: false,
      }),
    );
    expect(geminiFiles.upload).toHaveBeenCalledTimes(1);
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledTimes(1);
  });

  it("bounds Gemini processing polls and cleans up after timeout", async () => {
    const { geminiFiles, ingestor, temporaryFiles } = makeHarness();
    geminiFiles.get.mockResolvedValue({
      name: "files/demo",
      state: "PROCESSING",
    });

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "GEMINI_PROCESSING_TIMEOUT",
        message: "Gemini took too long to prepare this video. Try again.",
        retryable: true,
        offerUploadFallback: false,
      }),
    );
    expect(geminiFiles.get).toHaveBeenCalledTimes(3);
    expect(geminiFiles.delete).toHaveBeenCalledWith(
      "files/demo",
      expect.any(AbortSignal),
    );
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledTimes(1);
  });

  it("stops polling when the activation deadline is reached", async () => {
    const { geminiFiles, ingestor, now, sleep } = makeHarness();
    now.mockReturnValueOnce(0).mockReturnValueOnce(101);

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toMatchObject({ code: "GEMINI_PROCESSING_TIMEOUT" });
    expect(sleep).not.toHaveBeenCalled();
    expect(geminiFiles.get).not.toHaveBeenCalled();
  });

  it("does not start another Files request when the deadline expires during sleep", async () => {
    const { geminiFiles, ingestor, now, sleep } = makeHarness();
    now
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(101);

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toMatchObject({ code: "GEMINI_PROCESSING_TIMEOUT" });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(geminiFiles.get).not.toHaveBeenCalled();
  });

  it("stops immediately when Gemini marks processing as FAILED", async () => {
    const { geminiFiles, ingestor } = makeHarness();
    geminiFiles.upload.mockResolvedValue({
      name: "files/failed",
      state: "FAILED",
    });

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toEqual(
      new IngestionError({
        code: "GEMINI_PROCESSING_FAILED",
        message: "Gemini could not prepare this video. Try another file.",
        retryable: true,
        offerUploadFallback: true,
      }),
    );
    expect(geminiFiles.get).not.toHaveBeenCalled();
    expect(geminiFiles.delete).toHaveBeenCalledWith(
      "files/failed",
      expect.any(AbortSignal),
    );
  });

  it("attempts all cleanup without masking the primary failure", async () => {
    const { geminiFiles, ingestor, temporaryFiles } = makeHarness();
    geminiFiles.upload.mockResolvedValue({
      name: "files/active",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/active",
      mimeType: "video/mp4",
      state: "ACTIVE",
    });
    geminiFiles.delete.mockRejectedValue(new Error("remote cleanup failed"));
    temporaryFiles.removeDirectory.mockRejectedValue(
      new Error("local cleanup failed"),
    );
    const primary = new Error("downstream analysis failed");

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => {
          throw primary;
        },
      ),
    ).rejects.toBe(primary);
    expect(geminiFiles.delete).toHaveBeenCalledTimes(1);
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledTimes(1);
  });

  it("keeps bounded polling after one transient Gemini get failure", async () => {
    const { geminiFiles, ingestor } = makeHarness();
    geminiFiles.get
      .mockRejectedValueOnce(new BoundaryError("temporary 503", true))
      .mockResolvedValueOnce({
        name: "files/demo",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
        mimeType: "video/mp4",
        state: "ACTIVE",
      });

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async () => "used",
      ),
    ).resolves.toBe("used");
    expect(geminiFiles.get).toHaveBeenCalledTimes(2);
  });

  it("preserves cancellation after upload while cleaning local and remote media", async () => {
    const { geminiFiles, ingestor, temporaryFiles } = makeHarness();
    const controller = new AbortController();
    const cancellation = new DOMException("The operation was aborted", "AbortError");
    geminiFiles.get.mockImplementation(async () => {
      controller.abort(cancellation);
      throw cancellation;
    });

    await expect(
      ingestor.withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: controller.signal, onProgress: vi.fn() },
        async () => undefined,
      ),
    ).rejects.toBe(cancellation);
    expect(geminiFiles.delete).toHaveBeenCalledWith(
      "files/demo",
      expect.not.objectContaining({ aborted: true }),
    );
    expect(temporaryFiles.removeDirectory).toHaveBeenCalledWith(
      "/private/tmp/capcheck-123",
    );
    expect(mapIngestionError(cancellation)).toBeUndefined();
  });
});

describe("mapIngestionError", () => {
  it("maps known failures to the frozen safe error contract and omits aborts", () => {
    const failure = new IngestionError({
      code: "SOURCE_VIDEO_UNAVAILABLE",
      message:
        "We could not download that public video. Upload the video file instead.",
      retryable: false,
      offerUploadFallback: true,
    });

    expect(ErrorEventSchema.parse(mapIngestionError(failure))).toEqual({
      type: "error",
      error: {
        code: "SOURCE_VIDEO_UNAVAILABLE",
        message:
          "We could not download that public video. Upload the video file instead.",
        retryable: false,
      },
    });
    expect(
      mapIngestionError(new DOMException("The operation was aborted", "AbortError")),
    ).toBeUndefined();
    expect(mapIngestionError(new Error("key=secret /private/tmp/video"))).toEqual({
      type: "error",
      error: {
        code: "VIDEO_INGESTION_FAILED",
        message: "CapCheck could not prepare this video. Try again.",
        retryable: true,
      },
    });
  });
});
