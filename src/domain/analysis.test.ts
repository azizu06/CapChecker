import { describe, expect, it } from "vitest";

import {
  AnalysisEventSchema,
  EvidenceSchema,
  HypeFindingSchema,
  NextActionSchema,
  ScorecardSchema,
  SourceVideoSchema,
  VerificationSchema,
} from "./analysis";
import {
  DEMO_FATAL_ERROR,
  DEMO_SCORECARDS,
} from "../fixtures/scorecards";

const mixedScorecard = {
  id: "scorecard-mixed",
  source: {
    kind: "url",
    url: "https://www.youtube.com/shorts/mixed-demo",
    title: "Three stock claims in sixty seconds",
  },
  capScore: 52,
  capLabel: "some-cap",
  summary:
    "One claim is supported, one lacks enough evidence, and one is contradicted.",
  verifications: [
    {
      claim: {
        id: "claim-1",
        text: "The S&P 500 gained more than 20% last year.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 8,
      },
      verdict: "true",
      confidence: 0.96,
      explanation: "The reported annual return supports the claim.",
      evidence: [
        {
          id: "evidence-1",
          title: "S&P 500 annual return",
          publisher: "S&P Dow Jones Indices",
          url: "https://www.spglobal.com/spdji/",
          trustTier: "primary",
          stance: "supports",
          excerpt: "The index finished the year with a gain above 20%.",
        },
      ],
    },
  ],
  hypeFindings: [
    {
      id: "hype-1",
      phrase: "This stock cannot lose",
      category: "guarantee",
      severity: "high",
      explanation: "Investment outcomes cannot be guaranteed.",
    },
  ],
  nextActions: [
    {
      id: "action-1",
      label: "Read the company filing",
      description: "Compare the claim with the latest SEC filing.",
      url: "https://www.sec.gov/edgar/search/",
    },
  ],
  generatedAt: "2026-07-11T15:00:00.000Z",
};

describe("ScorecardSchema", () => {
  it("accepts a complete mixed scorecard and rejects an out-of-range Cap Score", () => {
    expect(ScorecardSchema.parse(mixedScorecard)).toEqual(mixedScorecard);

    expect(
      ScorecardSchema.safeParse({ ...mixedScorecard, capScore: 101 }).success,
    ).toBe(false);
  });

  it("rejects a Cap Score label that contradicts the documented score band", () => {
    expect(
      ScorecardSchema.safeParse({
        ...mixedScorecard,
        capScore: 94,
        capLabel: "no-cap",
      }).success,
    ).toBe(false);
  });

  it("preserves optional skipped opinion claims outside verifications", () => {
    const scorecardWithSkippedOpinion = {
      ...mixedScorecard,
      skippedClaims: [
        {
          id: "opinion-1",
          text: "I think this is the most exciting stock in the market.",
          kind: "opinion" as const,
          checkable: false as const,
          timestampSeconds: 84,
        },
      ],
    };

    expect(ScorecardSchema.parse(scorecardWithSkippedOpinion)).toEqual(
      scorecardWithSkippedOpinion,
    );
  });

  it("rejects checkable claims in the skipped opinion collection", () => {
    const factualClaim = mixedScorecard.verifications[0].claim;

    expect(
      ScorecardSchema.safeParse({
        ...mixedScorecard,
        skippedClaims: [factualClaim],
      }).success,
    ).toBe(false);
  });

  it("provides a deterministic mixed demo fixture through the frozen contract", () => {
    expect(ScorecardSchema.parse(DEMO_SCORECARDS.mixed)).toEqual(
      DEMO_SCORECARDS.mixed,
    );
    expect(DEMO_SCORECARDS.mixed.capLabel).toBe("some-cap");
  });

  it("provides contract-valid scorecards for every non-fatal demo outcome", () => {
    const outcomes = [
      DEMO_SCORECARDS.scammy,
      DEMO_SCORECARDS.legitimate,
      DEMO_SCORECARDS.mixed,
      DEMO_SCORECARDS.partialFailure,
    ];

    expect(outcomes.map((scorecard) => ScorecardSchema.parse(scorecard))).toEqual(
      outcomes,
    );
  });

  it("anchors every demo hype finding to transcript context", () => {
    const findings = Object.values(DEMO_SCORECARDS).flatMap(
      (scorecard) => scorecard.hypeFindings,
    );

    expect(findings.length).toBeGreaterThan(0);
    expect(findings).toEqual(
      expect.arrayContaining(
        findings.map((finding) =>
          expect.objectContaining({
            context: expect.stringContaining(finding.phrase),
            timestampSeconds: expect.any(Number),
          }),
        ),
      ),
    );
  });

  it("provides two or three demo actions linked to each scorecard's evidence", () => {
    for (const scorecard of Object.values(DEMO_SCORECARDS)) {
      const evidenceIds = new Set(
        scorecard.verifications.flatMap((verification) =>
          verification.evidence.map((evidence) => evidence.id),
        ),
      );

      expect(scorecard.nextActions.length).toBeGreaterThanOrEqual(2);
      expect(scorecard.nextActions.length).toBeLessThanOrEqual(3);
      expect(
        scorecard.nextActions.every(
          (action) => action.evidenceId && evidenceIds.has(action.evidenceId),
        ),
      ).toBe(true);
    }
  });

  it("covers every evidence trust tier for deterministic UI states", () => {
    const trustTiers = new Set(
      Object.values(DEMO_SCORECARDS).flatMap((scorecard) =>
        scorecard.verifications.flatMap((verification) =>
          verification.evidence.map((evidence) => evidence.trustTier),
        ),
      ),
    );

    expect(trustTiers).toEqual(
      new Set(["primary", "high", "medium", "low"]),
    );
  });
});

describe("HypeFindingSchema", () => {
  it("preserves optional transcript context and timestamp anchors", () => {
    const finding = {
      ...mixedScorecard.hypeFindings[0],
      context: "Buy before earnings because this stock cannot lose.",
      timestampSeconds: 41,
    };

    expect(HypeFindingSchema.parse(finding)).toEqual(finding);
  });
});

describe("NextActionSchema", () => {
  it("preserves an optional reference to scorecard evidence", () => {
    const action = {
      ...mixedScorecard.nextActions[0],
      evidenceId: "evidence-1",
    };

    expect(NextActionSchema.parse(action)).toEqual(action);
  });
});

describe("AnalysisEventSchema", () => {
  it("represents a fatal demo outcome as a retryable contract-valid error", () => {
    expect(AnalysisEventSchema.parse(DEMO_FATAL_ERROR)).toEqual(DEMO_FATAL_ERROR);
    expect(DEMO_FATAL_ERROR).toMatchObject({
      type: "error",
      error: { retryable: true },
    });
  });
});

describe("VerificationSchema", () => {
  it("rejects verifications for every kind of non-checkable claim", () => {
    const verification = mixedScorecard.verifications[0];

    expect(
      VerificationSchema.safeParse({
        ...verification,
        claim: { ...verification.claim, checkable: false },
      }).success,
    ).toBe(false);
    expect(
      VerificationSchema.safeParse({
        ...verification,
        claim: {
          ...verification.claim,
          kind: "opinion",
          checkable: false,
        },
      }).success,
    ).toBe(false);
  });
});

describe("external URL boundaries", () => {
  it.each(["javascript:alert(1)", "data:text/plain,cap", "file:///tmp/cap", "ftp://example.com/cap"])(
    "rejects the non-HTTP URL %s everywhere it can leave the app",
    (url) => {
      const evidence = mixedScorecard.verifications[0].evidence[0];
      const action = mixedScorecard.nextActions[0];

      expect(EvidenceSchema.safeParse({ ...evidence, url }).success).toBe(false);
      expect(NextActionSchema.safeParse({ ...action, url }).success).toBe(false);
      expect(SourceVideoSchema.safeParse({ kind: "url", url }).success).toBe(
        false,
      );
    },
  );
});

describe("SourceVideoSchema", () => {
  it.each(["/tmp/private/demo.mp4", "C:\\Users\\demo\\video.mp4"])(
    "rejects an upload path instead of exposing its basename: %s",
    (fileName) => {
      expect(
        SourceVideoSchema.safeParse({ kind: "upload", fileName }).success,
      ).toBe(false);
    },
  );
});
