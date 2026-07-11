import { describe, expect, it, vi } from "vitest";

import { createGeminiScorecardSynthesizer } from "./gemini-scorecard-synthesizer";

describe("Gemini scorecard synthesizer", () => {
  it("requests grounded prose without delegating the deterministic Cap Score", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "The guarantee is contradicted by regulator guidance.",
                    hypeFindings: [
                      {
                        id: "hype-1",
                        phrase: "cannot lose",
                        category: "guarantee",
                        severity: "high",
                        explanation: "The phrase removes real investment risk.",
                      },
                    ],
                    nextActions: [
                      {
                        id: "action-1",
                        label: "Read the risk guidance",
                        description: "Compare the claim with FINRA's cited guidance.",
                        evidenceId: "evidence-1",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
    });

    const result = await synthesizer.synthesize({
      transcript: [
        {
          timestampSeconds: 4,
          text: "Buy now because you cannot lose on this stock.",
        },
      ],
      verifications: [
        {
          claim: {
            id: "claim-1",
            text: "You cannot lose on this stock.",
            kind: "factual",
            checkable: true,
          },
          verdict: "false",
          confidence: 0.99,
          explanation: "All investments carry risk.",
          evidence: [
            {
              id: "evidence-1",
              title: "Understanding investment risk",
              publisher: "FINRA",
              url: "https://www.finra.org/investors/investing/investing-basics/risk",
              trustTier: "primary",
              stance: "contradicts",
              excerpt: "All investments carry risk.",
            },
          ],
        },
      ],
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      summary: expect.stringContaining("contradicted"),
      nextActions: [{ evidenceId: "evidence-1" }],
    });
    const request = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(request.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: {
        properties: {
          summary: expect.any(Object),
          hypeFindings: expect.any(Object),
          nextActions: expect.any(Object),
        },
      },
    });
    expect(request.generationConfig.responseJsonSchema.properties).not.toHaveProperty(
      "capScore",
    );
    expect(request.contents[0].parts[0].text).toContain("evidence-1");
    expect(request.contents[0].parts[0].text).toContain("cannot lose");
  });
});
