import { describe, expect, it, vi } from "vitest";

import { ScorecardSchema, type Verification } from "@/domain/analysis";

import {
  calculateCapScore,
  createScorecardSynthesisPipeline,
} from "./scorecard-synthesis";

const verification = (
  verdict: Verification["verdict"],
): Verification => ({
  claim: {
    id: `claim-${verdict}`,
    text: "The company reported record revenue.",
    timestampSeconds: 1,
    kind: "factual",
    checkable: true,
  },
  verdict,
  confidence: 0.9,
  explanation: "Checked against the available evidence.",
  evidence: [],
});

describe("scorecard synthesis", () => {
  it("penalizes a false claim more than an unverifiable claim", () => {
    expect(calculateCapScore([verification("false")])).toBeGreaterThan(
      calculateCapScore([verification("unverifiable")]),
    );
  });

  it("keeps a prediction-heavy video out of the no-cap band", () => {
    const predictions = ["claim-1", "claim-2"].map((id) => ({
      ...verification("true"),
      claim: {
        id,
        text: "This stock will double next year.",
        kind: "predictive" as const,
        checkable: true as const,
      },
    }));

    expect(calculateCapScore(predictions)).toBe(30);
  });

  it("uses extracted non-opinion claims to detect prediction-heavy content", () => {
    const extractedClaims = [
      {
        id: "prediction-1",
        text: "This stock will double next year.",
        timestampSeconds: 2,
        kind: "predictive" as const,
        checkable: false,
      },
      {
        id: "prediction-2",
        text: "The market will rally next quarter.",
        timestampSeconds: 5,
        kind: "predictive" as const,
        checkable: false,
      },
      {
        id: "claim-true",
        text: "The company reported record revenue.",
        timestampSeconds: 8,
        kind: "factual" as const,
        checkable: true,
      },
    ];

    expect(calculateCapScore([verification("true")], extractedClaims)).toBe(30);
  });

  it("handles empty input, verdict extrema, and the prediction ratio boundary", () => {
    const predictive = {
      ...verification("true"),
      claim: {
        ...verification("true").claim,
        id: "prediction-1",
        kind: "predictive" as const,
      },
    };

    expect(calculateCapScore([])).toBe(0);
    expect(calculateCapScore([verification("true")])).toBe(0);
    expect(calculateCapScore([verification("mostly-true")])).toBe(15);
    expect(calculateCapScore([verification("unverifiable")])).toBe(40);
    expect(calculateCapScore([verification("false")])).toBe(100);
    expect(calculateCapScore([predictive, verification("true")])).toBe(30);
    expect(
      calculateCapScore([
        predictive,
        verification("true"),
        verification("true"),
      ]),
    ).toBe(0);
  });

  it("applies the prediction floor when extracted predictions have no verifications", async () => {
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: {
        synthesize: vi.fn().mockResolvedValue({
          summary: {
            text: "The video consists of unsupported predictions.",
            claimIds: [],
          },
          hypeFindings: [],
          nextActions: [],
        }),
      },
    });

    const result = await pipeline.synthesize(
      {
        id: "scorecard-unverified-predictions",
        source: { kind: "upload", fileName: "predictions.mp4" },
        extraction: {
          transcript: [
            { timestampSeconds: 0, text: "This stock will double next year." },
          ],
          claims: [
            {
              id: "prediction-1",
              text: "This stock will double next year.",
              timestampSeconds: 0,
              kind: "predictive",
              checkable: false,
            },
          ],
        },
        verifications: [],
      },
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(result).toMatchObject({ capScore: 30, capLabel: "some-cap" });
  });

  it("synthesizes a frozen scorecard from verified claims and model prose", async () => {
    const synthesize = vi.fn().mockResolvedValue({
      capScore: 0,
      summary: {
        text: "One claim is false and one future prediction is unsupported.",
        claimIds: ["claim-false"],
      },
      hypeFindings: [
        {
          id: "hype-1",
          phrase: "cannot lose",
          category: "guarantee",
          severity: "high",
          explanation: "The absolute promise hides investment risk.",
          claimId: "claim-false",
        },
      ],
      nextActions: [
        {
          id: "action-1",
          label: "Read the risk disclosure",
          description: "Compare the guarantee with the cited regulator guidance.",
          evidenceId: "evidence-1",
        },
      ],
    });
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: { synthesize },
      now: () => new Date("2026-07-11T20:00:00.000Z"),
    });
    const progress: unknown[] = [];
    const falseVerification: Verification = {
      ...verification("false"),
      claim: {
        ...verification("false").claim,
        text: "You cannot lose on this stock.",
        timestampSeconds: 4,
      },
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
    };

    const result = await pipeline.synthesize(
      {
        id: "scorecard-live-1",
        source: {
          kind: "url",
          url: "https://www.youtube.com/shorts/demo",
        },
        extraction: {
          transcript: [
            {
              timestampSeconds: 4,
              text: "Buy now because you cannot lose on this stock.",
            },
          ],
          claims: [
            { ...falseVerification.claim, timestampSeconds: 4 },
            {
              id: "claim-opinion",
              text: "This is my favorite stock.",
              timestampSeconds: 9,
              kind: "opinion",
              checkable: false,
            },
          ],
        },
        verifications: [falseVerification],
      },
      {
        signal: new AbortController().signal,
        onProgress: (event) => progress.push(event),
      },
    );

    expect(ScorecardSchema.safeParse(result).success).toBe(true);
    expect(result).toMatchObject({
      id: "scorecard-live-1",
      capScore: 100,
      capLabel: "full-of-cap",
      summary: "One claim is false and one future prediction is unsupported.",
      generatedAt: "2026-07-11T20:00:00.000Z",
      skippedClaims: [{ id: "claim-opinion", kind: "opinion" }],
      hypeFindings: [
        {
          phrase: "cannot lose",
          context: "Buy now because you cannot lose on this stock.",
          timestampSeconds: 4,
        },
      ],
      nextActions: [{ evidenceId: "evidence-1" }],
    });
    expect(result.hypeFindings[0]).not.toHaveProperty("claimId");
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: expect.any(Array),
        verifications: [falseVerification],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "synthesizing",
        message: "Building the CapCheck scorecard",
      },
    ]);
  });

  it("drops prose that is not grounded in the same transcript and scorecard", async () => {
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: {
        synthesize: vi.fn().mockResolvedValue({
          summary: { text: "No checkable claims were found.", claimIds: [] },
          hypeFindings: [
            {
              id: "hype-1",
              phrase: "guaranteed returns",
              category: "guarantee",
              severity: "high",
              explanation: "This phrase does not appear in the transcript.",
              claimId: "missing-claim",
            },
          ],
          nextActions: [
            {
              id: "action-1",
              label: "Read an unrelated source",
              description: "This source was not used to verify the video.",
              evidenceId: "missing-evidence",
            },
          ],
        }),
      },
    });

    const result = await pipeline.synthesize(
      {
        id: "scorecard-no-claims",
        source: { kind: "upload", fileName: "opinions.mp4" },
        extraction: {
          transcript: [{ timestampSeconds: 0, text: "I like this stock." }],
          claims: [],
        },
        verifications: [],
      },
      {
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      },
    );

    expect(result.hypeFindings).toEqual([]);
    expect(result.nextActions).toEqual([]);
  });

  it("rejects a summary that cites an invented verification claim", async () => {
    const verified = verification("true");
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: {
        synthesize: vi.fn().mockResolvedValue({
          summary: {
            text: "An invented claim is supported.",
            claimIds: ["invented-claim"],
          },
          hypeFindings: [],
          nextActions: [],
        }),
      },
    });

    await expect(
      pipeline.synthesize(
        {
          id: "scorecard-invented-summary",
          source: { kind: "upload", fileName: "summary.mp4" },
          extraction: {
            transcript: [
              { timestampSeconds: 1, text: verified.claim.text },
            ],
            claims: [{ ...verified.claim, timestampSeconds: 1 }],
          },
          verifications: [verified],
        },
        { signal: new AbortController().signal, onProgress: vi.fn() },
      ),
    ).rejects.toMatchObject({
      name: "ScorecardSynthesisError",
      code: "MALFORMED_SCORECARD_NARRATIVE",
    });
  });

  it("drops hype prose that references an unrelated verified claim", async () => {
    const relevant = {
      ...verification("false"),
      claim: {
        ...verification("false").claim,
        id: "claim-risk",
        text: "You cannot lose on this stock.",
        timestampSeconds: 4,
      },
    };
    const unrelated = {
      ...verification("true"),
      claim: {
        ...verification("true").claim,
        id: "claim-revenue",
        timestampSeconds: 12,
      },
    };
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: {
        synthesize: vi.fn().mockResolvedValue({
          summary: {
            text: "The loss guarantee is false.",
            claimIds: ["claim-risk"],
          },
          hypeFindings: [
            {
              id: "hype-unrelated",
              phrase: "cannot lose",
              category: "guarantee",
              severity: "high",
              explanation: "This explanation cites an unrelated revenue claim.",
              claimId: "claim-revenue",
            },
          ],
          nextActions: [],
        }),
      },
    });

    const result = await pipeline.synthesize(
      {
        id: "scorecard-unrelated-hype",
        source: { kind: "upload", fileName: "hype.mp4" },
        extraction: {
          transcript: [
            {
              timestampSeconds: 4,
              text: "Buy now because you cannot lose on this stock.",
            },
          ],
          claims: [
            { ...relevant.claim, timestampSeconds: 4 },
            { ...unrelated.claim, timestampSeconds: 12 },
          ],
        },
        verifications: [relevant, unrelated],
      },
      { signal: new AbortController().signal, onProgress: vi.fn() },
    );

    expect(result.hypeFindings).toEqual([]);
  });

  it("fails clearly when the prose boundary returns a malformed narrative", async () => {
    const pipeline = createScorecardSynthesisPipeline({
      synthesizer: {
        synthesize: vi.fn().mockResolvedValue({ summary: "Missing arrays" }),
      },
    });

    await expect(
      pipeline.synthesize(
        {
          id: "scorecard-malformed",
          source: { kind: "upload", fileName: "demo.mp4" },
          extraction: {
            transcript: [{ timestampSeconds: 0, text: "A transcript." }],
            claims: [],
          },
          verifications: [],
        },
        {
          signal: new AbortController().signal,
          onProgress: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      name: "ScorecardSynthesisError",
      code: "MALFORMED_SCORECARD_NARRATIVE",
      retryable: true,
    });
  });
});
