import { describe, expect, it, vi } from "vitest";

import { createNodeClaimVerificationPipeline } from "./node-claim-verification-pipeline";

const liveEnabled =
  process.env.CAPCHECK_LIVE_VERIFY === "1" &&
  Boolean(process.env.GEMINI_API_KEY) &&
  Boolean(process.env.FINNHUB_KEY);

describe.skipIf(!liveEnabled)("live claim verification", () => {
  it(
    "returns cited Search and market-data verifications",
    async () => {
      const pipeline = createNodeClaimVerificationPipeline({
        apiKey: process.env.GEMINI_API_KEY!,
        finnhubApiKey: process.env.FINNHUB_KEY!,
        maxConcurrency: 2,
      });

      const result = await pipeline.verify(
        [
          {
            id: "general-claim",
            text: "U.S. public companies use Form 10-K for annual reports.",
            timestampSeconds: 0,
            kind: "factual",
            checkable: true,
          },
          {
            id: "ticker-claim",
            text: "AAPL currently trades above $1 per share.",
            timestampSeconds: 1,
            kind: "factual",
            checkable: true,
            quant: {
              ticker: "AAPL",
              metric: "current share price",
              value: "$1",
              period: "current",
            },
          },
        ],
        {
          signal: AbortSignal.timeout(120_000),
          onProgress: vi.fn(),
        },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        claim: { id: "general-claim" },
        verdict: expect.stringMatching(/^(true|mostly-true)$/),
      });
      expect(result[0].evidence.length).toBeGreaterThan(0);
      expect(result[1]).toMatchObject({
        claim: { id: "ticker-claim" },
        verdict: expect.stringMatching(/^(true|mostly-true)$/),
        evidence: [expect.objectContaining({ publisher: "Finnhub" })],
      });
    },
    130_000,
  );
});
