import { describe, expect, it, vi } from "vitest";

import { createNodeClaimVerificationPipeline } from "./node-claim-verification-pipeline";

describe("node claim verification pipeline", () => {
  it("wires Gemini function calling to Finnhub through the public pipeline", async () => {
    let geminiTurn = 0;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://finnhub.io/")) {
        return Response.json({
          c: 231.59,
          d: 2.14,
          dp: 0.9327,
          h: 233.12,
          l: 228.01,
          o: 229.4,
          pc: 229.45,
          t: 1783785600,
        });
      }
      geminiTurn += 1;
      if (geminiTurn === 1) {
        return Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      id: "quote-call",
                      name: "get_stock_data",
                      args: { ticker: "AAPL", metric: "price", period: "current" },
                    },
                    thoughtSignature: "signed-turn",
                  },
                ],
              },
            },
          ],
        });
      }
      return Response.json({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: JSON.stringify({
                    verdict: "true",
                    confidence: 0.87,
                    explanation: "The current quote is above $230.",
                    citations: [],
                  }),
                },
              ],
            },
          },
        ],
      });
    });
    const pipeline = createNodeClaimVerificationPipeline({
      apiKey: "test-gemini-key",
      finnhubApiKey: "test-finnhub-key",
      fetch: fetch as typeof globalThis.fetch,
      maxConcurrency: 2,
    });

    const result = await pipeline.verify(
      [
        {
          id: "claim-1",
          text: "AAPL trades above $230.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
          quant: { ticker: "AAPL", metric: "price", value: "$230", period: "current" },
        },
      ],
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(result).toEqual([
      expect.objectContaining({
        verdict: "true",
        evidence: [expect.objectContaining({ publisher: "Finnhub" })],
      }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
