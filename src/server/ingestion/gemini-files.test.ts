import { Blob as NodeBlob } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import { BoundaryError } from "./video-ingestion";
import { createGeminiFilesClient } from "./gemini-files";

describe("createGeminiFilesClient", () => {
  it("starts and finalizes a resumable upload with explicit MIME metadata", async () => {
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
            name: "files/demo",
            state: "PROCESSING",
            mimeType: "video/mp4",
          },
        }),
      );
    const readFile = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    const client = createGeminiFilesClient({
      apiKey: "test-api-key",
      fetch: fetchMock as typeof fetch,
      readFile,
    });
    const signal = new AbortController().signal;

    await expect(
      client.upload({
        path: "/private/tmp/capcheck/video.mp4",
        displayName: "video.mp4",
        mimeType: "video/mp4",
        signal,
      }),
    ).resolves.toEqual({
      name: "files/demo",
      state: "PROCESSING",
      mimeType: "video/mp4",
    });

    expect(readFile).toHaveBeenCalledWith(
      "/private/tmp/capcheck/video.mp4",
      { signal },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://generativelanguage.googleapis.com/upload/v1beta/files",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "test-api-key",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": "3",
          "X-Goog-Upload-Header-Content-Type": "video/mp4",
          "X-Goog-Upload-Protocol": "resumable",
        }),
        body: JSON.stringify({ file: { display_name: "video.mp4" } }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://upload.example/session-123",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          "Content-Length": "3",
          "Content-Type": "video/mp4",
          "X-Goog-Upload-Command": "upload, finalize",
          "X-Goog-Upload-Offset": "0",
        }),
        body: expect.any(NodeBlob),
      }),
    );
    const uploadedBody = fetchMock.mock.calls[1]?.[1]?.body;
    expect(uploadedBody).toBeInstanceOf(NodeBlob);
    expect(
      Array.from(
        new Uint8Array(await (uploadedBody as NodeBlob).arrayBuffer()),
      ),
    ).toEqual([1, 2, 3]);
  });

  it("gets the current Gemini file state with the API key kept in headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        name: "files/demo",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
        mimeType: "video/webm",
        state: "ACTIVE",
      }),
    );
    const client = createGeminiFilesClient({
      apiKey: "test-api-key",
      fetch: fetchMock as typeof fetch,
    });
    const signal = new AbortController().signal;

    await expect(client.get("files/demo", signal)).resolves.toEqual({
      name: "files/demo",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
      mimeType: "video/webm",
      state: "ACTIVE",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/files/demo",
      {
        method: "GET",
        signal: expect.any(AbortSignal),
        headers: { "X-Goog-Api-Key": "test-api-key" },
      },
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("test-api-key");
  });

  it("deletes a leased Gemini file after downstream use", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createGeminiFilesClient({
      apiKey: "test-api-key",
      fetch: fetchMock as typeof fetch,
    });
    const signal = new AbortController().signal;

    await expect(client.delete("files/demo", signal)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/files/demo",
      {
        method: "DELETE",
        signal: expect.any(AbortSignal),
        headers: { "X-Goog-Api-Key": "test-api-key" },
      },
    );
  });

  it("classifies transient HTTP failures without exposing response details or keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream secret details", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );
    const client = createGeminiFilesClient({
      apiKey: "super-secret-api-key",
      fetch: fetchMock as typeof fetch,
    });

    const error = await client
      .get("files/demo", new AbortController().signal)
      .catch((caught: unknown) => caught);

    expect(error).toEqual(
      new BoundaryError("Gemini Files request failed", true),
    );
    expect(String(error)).not.toContain("upstream secret");
    expect(String(error)).not.toContain("super-secret-api-key");
  });

  it("bounds a stalled Files API request with a retryable safe error", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      );
      const client = createGeminiFilesClient({
        apiKey: "test-api-key",
        fetch: fetchMock as typeof fetch,
        requestTimeoutMs: 1_000,
      });

      const request = client.get(
        "files/demo",
        new AbortController().signal,
      );
      const expectation = expect(request).rejects.toEqual(
        new BoundaryError("Gemini Files request timed out", true),
      );
      await vi.advanceTimersByTimeAsync(1_001);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry when a finalized upload times out ambiguously", async () => {
    vi.useFakeTimers();
    try {
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
        .mockImplementationOnce(
          (_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener(
                "abort",
                () => reject(init.signal?.reason),
                { once: true },
              );
            }),
        );
      const client = createGeminiFilesClient({
        apiKey: "test-api-key",
        fetch: fetchMock as typeof fetch,
        readFile: vi.fn().mockResolvedValue(Buffer.from([1, 2, 3])),
        requestTimeoutMs: 1_000,
        uploadTimeoutMs: 10_000,
      });

      const upload = client.upload({
        path: "/private/tmp/capcheck/video.mp4",
        displayName: "video.mp4",
        mimeType: "video/mp4",
        signal: new AbortController().signal,
      });
      const expectation = expect(upload).rejects.toEqual(
        new BoundaryError("Gemini upload outcome is unknown", false),
      );

      await vi.advanceTimersByTimeAsync(1_001);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(9_001);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats an omitted Files state as bounded not-ready processing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ name: "files/demo" }));
    const client = createGeminiFilesClient({
      apiKey: "test-api-key",
      fetch: fetchMock as typeof fetch,
    });

    await expect(
      client.get("files/demo", new AbortController().signal),
    ).resolves.toEqual({
      name: "files/demo",
      state: "STATE_UNSPECIFIED",
    });
  });
});
