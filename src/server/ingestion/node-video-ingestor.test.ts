import { describe, expect, it, vi } from "vitest";

import { createNodeVideoIngestor } from "./node-video-ingestor";

describe("createNodeVideoIngestor", () => {
  it("runs a direct MP4 upload through real staging, MIME, and Gemini adapters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "x-goog-upload-url": "https://upload.example/session-123",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          file: {
            name: "files/uploaded",
            uri: "https://generativelanguage.googleapis.com/v1beta/files/uploaded",
            mimeType: "video/mp4",
            state: "ACTIVE",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const ingestor = createNodeVideoIngestor({
      apiKey: "test-api-key",
      fetch: fetchMock as typeof fetch,
    });
    const bytes = Uint8Array.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
      0x6d, 0x00, 0x00, 0x02, 0x00,
    ]);

    await expect(
      ingestor.withActiveFile(
        {
          kind: "upload",
          fileName: "prepared.mp4",
          mimeType: "video/mp4",
          bytes,
        },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async (file) => file,
      ),
    ).resolves.toEqual({
      name: "files/uploaded",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/uploaded",
      mimeType: "video/mp4",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/files/uploaded",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("caps yt-dlp downloads at the policy video-byte limit", async () => {
    const ytDlpRun = vi
      .fn()
      .mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    const ingestor = createNodeVideoIngestor({
      apiKey: "test-api-key",
      fetch: vi.fn() as unknown as typeof fetch,
      policy: {
        uploadAttempts: 2,
        pollIntervalMs: 2_000,
        maxPollAttempts: 60,
        activationTimeoutMs: 120_000,
        maxVideoBytes: 10 * 1024 * 1024,
      },
      ytDlpRun,
    });

    await ingestor
      .withActiveFile(
        { kind: "url", url: "https://www.youtube.com/shorts/demo123" },
        { signal: new AbortController().signal, onProgress: vi.fn() },
        async (file) => file,
      )
      .catch(() => undefined);

    expect(ytDlpRun).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--max-filesize", "10485760"]),
      }),
    );
  });
});
