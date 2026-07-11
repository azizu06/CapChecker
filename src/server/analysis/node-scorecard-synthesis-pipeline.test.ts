import { describe, expect, it, vi } from "vitest";

import { createNodeScorecardSynthesisPipeline } from "./node-scorecard-synthesis-pipeline";

describe("Node scorecard synthesis pipeline", () => {
  it("wires Gemini narrative generation into deterministic scorecard synthesis", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: {
                      text: "The video contains no checkable financial claims.",
                      claimIds: [],
                    },
                    hypeFindings: [],
                    nextActions: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    const pipeline = createNodeScorecardSynthesisPipeline({
      apiKey: "test-key",
      fetch,
      now: () => new Date("2026-07-11T21:00:00.000Z"),
    });

    const result = await pipeline.synthesize(
      {
        id: "scorecard-node-1",
        source: { kind: "upload", fileName: "opinion.mp4" },
        extraction: {
          transcript: [{ timestampSeconds: 0, text: "I like this stock." }],
          claims: [
            {
              id: "opinion-1",
              text: "I like this stock.",
              timestampSeconds: 0,
              kind: "opinion",
              checkable: false,
            },
          ],
        },
        verifications: [],
      },
      {
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      },
    );

    expect(fetch).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      capScore: 0,
      capLabel: "no-cap",
      summary: "The video contains no checkable financial claims.",
      generatedAt: "2026-07-11T21:00:00.000Z",
    });
  });
});
