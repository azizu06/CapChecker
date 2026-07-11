import { describe, expect, it, vi } from "vitest";

import { createNodeClaimExtractionPipeline } from "./node-claim-extraction-pipeline";

describe("createNodeClaimExtractionPipeline", () => {
  it("extracts claims inside the ACTIVE-file lease and leaves cleanup to ingestion", async () => {
    const extraction = {
      transcript: [
        { timestampSeconds: 4, text: "TSLA will double next year." },
      ],
      claims: [
        {
          id: "claim-1",
          text: "TSLA will double next year.",
          timestampSeconds: 4,
          kind: "predictive",
          checkable: true,
          quant: {
            ticker: "TSLA",
            metric: "share price return",
            value: "100%",
            period: "next year",
          },
        },
      ],
    };
    const fetch = vi
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
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(extraction) }],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const pipeline = createNodeClaimExtractionPipeline({
      apiKey: "test-api-key",
      fetch: fetch as typeof globalThis.fetch,
    });
    const progress: unknown[] = [];
    const bytes = Uint8Array.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
      0x6d, 0x00, 0x00, 0x02, 0x00,
    ]);

    await expect(
      pipeline.extract(
        {
          kind: "upload",
          fileName: "prepared.mp4",
          mimeType: "video/mp4",
          bytes,
        },
        {
          signal: new AbortController().signal,
          onProgress: (event) => progress.push(event),
        },
      ),
    ).resolves.toEqual(extraction);

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
      {
        type: "progress",
        stage: "extracting",
        message: "Extracting transcript and financial claims",
      },
    ]);
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://generativelanguage.googleapis.com/v1beta/files/uploaded",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
