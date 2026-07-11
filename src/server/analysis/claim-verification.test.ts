import { describe, expect, it, vi } from "vitest";

import { createClaimVerificationPipeline } from "./claim-verification";

describe("claim verification pipeline", () => {
  it("verifies only checkable claims and preserves the frozen verification contract", async () => {
    const verifyClaim = vi.fn().mockResolvedValue({
      verdict: "true",
      confidence: 0.91,
      explanation: "The filing confirms the reported revenue increase.",
      evidence: [
        {
          id: "claim-1-source-1",
          title: "Quarterly report",
          publisher: "U.S. Securities and Exchange Commission",
          url: "https://www.sec.gov/Archives/edgar/data/example",
          trustTier: "primary",
          stance: "supports",
          excerpt: "Revenue increased by five percent.",
        },
      ],
    });
    const pipeline = createClaimVerificationPipeline({ verifier: { verifyClaim } });
    const progress: unknown[] = [];

    const result = await pipeline.verify(
      [
        {
          id: "claim-1",
          text: "AAPL revenue rose 5% in Q1.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
          quant: { ticker: "AAPL", metric: "revenue", value: "5%", period: "Q1" },
        },
        {
          id: "claim-2",
          text: "AAPL is the best stock.",
          timestampSeconds: 7,
          kind: "opinion",
          checkable: false,
        },
      ],
      {
        signal: new AbortController().signal,
        onProgress: (event) => progress.push(event),
      },
    );

    expect(verifyClaim).toHaveBeenCalledOnce();
    expect(verifyClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "claim-1",
        quant: expect.objectContaining({ ticker: "AAPL" }),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        claim: {
          id: "claim-1",
          text: "AAPL revenue rose 5% in Q1.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
        },
        verdict: "true",
      }),
    ]);
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "verifying",
        message: "Verifying 1 checkable claim",
      },
    ]);
  });

  it("degrades one failed claim to unverifiable without losing successful claims", async () => {
    const verifyClaim = vi
      .fn()
      .mockRejectedValueOnce(new Error("private upstream failure"))
      .mockResolvedValueOnce({
        verdict: "mostly-true",
        confidence: 0.72,
        explanation: "The direction is supported, but the stated amount is high.",
        evidence: [],
      });
    const pipeline = createClaimVerificationPipeline({ verifier: { verifyClaim } });

    const result = await pipeline.verify(
      [
        {
          id: "claim-1",
          text: "The market doubled yesterday.",
          timestampSeconds: 1,
          kind: "factual",
          checkable: true,
        },
        {
          id: "claim-2",
          text: "Rates declined this quarter.",
          timestampSeconds: 5,
          kind: "factual",
          checkable: true,
        },
      ],
      {
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        claim: expect.objectContaining({ id: "claim-1" }),
        verdict: "unverifiable",
        confidence: 0,
        evidence: [],
      }),
      expect.objectContaining({
        claim: expect.objectContaining({ id: "claim-2" }),
        verdict: "mostly-true",
      }),
    ]);
    expect(result[0].explanation).not.toContain("private upstream failure");
  });

  it("bounds concurrent claim verification while preserving claim order", async () => {
    let active = 0;
    let peak = 0;
    const verifyClaim = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return {
        verdict: "true" as const,
        confidence: 0.8,
        explanation: "Supported by current evidence.",
        evidence: [],
      };
    });
    const pipeline = createClaimVerificationPipeline({
      verifier: { verifyClaim },
      maxConcurrency: 2,
    });
    const claims = Array.from({ length: 5 }, (_, index) => ({
      id: `claim-${index + 1}`,
      text: `Checkable claim ${index + 1}`,
      timestampSeconds: index,
      kind: "factual" as const,
      checkable: true as const,
    }));

    const result = await pipeline.verify(claims, {
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });

    expect(peak).toBe(2);
    expect(result.map(({ claim }) => claim.id)).toEqual([
      "claim-1",
      "claim-2",
      "claim-3",
      "claim-4",
      "claim-5",
    ]);
  });
});
