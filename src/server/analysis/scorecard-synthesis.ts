import { z } from "zod";

import {
  HypeFindingSchema,
  NextActionSchema,
  OpinionClaimSchema,
  ScorecardSchema,
} from "@/domain/analysis";
import type {
  ProgressEvent,
  SourceVideo,
  Verification,
} from "@/domain/analysis";

import type { ClaimExtraction } from "./claim-extraction";

const VERDICT_WEIGHTS: Record<Verification["verdict"], number> = {
  true: 0,
  "mostly-true": 15,
  unverifiable: 40,
  false: 100,
};
const PREDICTION_HEAVY_RATIO = 0.5;
const PREDICTION_HEAVY_MIN_SCORE = 30;

export const ScorecardNarrativeSchema = z.object({
  summary: z.string().min(1),
  hypeFindings: z.array(
    HypeFindingSchema.omit({ context: true, timestampSeconds: true }),
  ),
  nextActions: z.array(NextActionSchema),
});

export type ScorecardNarrative = z.infer<typeof ScorecardNarrativeSchema>;

export class ScorecardSynthesisError extends Error {
  readonly code = "MALFORMED_SCORECARD_NARRATIVE";
  readonly retryable = true;

  constructor() {
    super("Gemini returned an invalid scorecard narrative.");
    this.name = "ScorecardSynthesisError";
  }
}

type NarrativeSynthesizer = {
  synthesize(input: {
    transcript: ClaimExtraction["transcript"];
    verifications: Verification[];
    signal: AbortSignal;
  }): Promise<unknown>;
};

type ScorecardSynthesisInput = {
  id: string;
  source: SourceVideo;
  extraction: ClaimExtraction;
  verifications: Verification[];
};

type ScorecardSynthesisOptions = {
  signal: AbortSignal;
  onProgress(event: ProgressEvent): void;
};

export function calculateCapScore(verifications: Verification[]) {
  if (verifications.length === 0) return 0;

  const total = verifications.reduce(
    (score, verification) => score + VERDICT_WEIGHTS[verification.verdict],
    0,
  );
  const weightedScore = Math.round(total / verifications.length);
  const predictionCount = verifications.filter(
    ({ claim }) => claim.kind === "predictive",
  ).length;
  const isPredictionHeavy =
    predictionCount / verifications.length >= PREDICTION_HEAVY_RATIO;

  return isPredictionHeavy
    ? Math.max(weightedScore, PREDICTION_HEAVY_MIN_SCORE)
    : weightedScore;
}

const capLabelFor = (capScore: number) =>
  capScore < 30
    ? ("no-cap" as const)
    : capScore < 70
      ? ("some-cap" as const)
      : ("full-of-cap" as const);

export function createScorecardSynthesisPipeline({
  synthesizer,
  now = () => new Date(),
}: {
  synthesizer: NarrativeSynthesizer;
  now?: () => Date;
}) {
  return {
    async synthesize(
      input: ScorecardSynthesisInput,
      options: ScorecardSynthesisOptions,
    ) {
      options.onProgress({
        type: "progress",
        stage: "synthesizing",
        message: "Building the CapCheck scorecard",
      });

      const parsedNarrative = ScorecardNarrativeSchema.safeParse(
        await synthesizer.synthesize({
          transcript: input.extraction.transcript,
          verifications: input.verifications,
          signal: options.signal,
        }),
      );
      if (!parsedNarrative.success) throw new ScorecardSynthesisError();
      const narrative = parsedNarrative.data;
      const capScore = calculateCapScore(input.verifications);
      const skippedClaims = input.extraction.claims.flatMap((claim) => {
        const parsed = OpinionClaimSchema.safeParse(claim);
        return parsed.success ? [parsed.data] : [];
      });
      const hypeFindings = narrative.hypeFindings.flatMap((finding) => {
        const phrase = finding.phrase.toLocaleLowerCase();
        const segment = input.extraction.transcript.find(({ text }) =>
          text.toLocaleLowerCase().includes(phrase),
        );
        return segment
          ? [
              {
                ...finding,
                context: segment.text,
                timestampSeconds: segment.timestampSeconds,
              },
            ]
          : [];
      });
      const evidenceIds = new Set(
        input.verifications.flatMap(({ evidence }) =>
          evidence.map(({ id }) => id),
        ),
      );
      const nextActions = narrative.nextActions.filter(
        ({ evidenceId }) => evidenceId && evidenceIds.has(evidenceId),
      );

      return ScorecardSchema.parse({
        id: input.id,
        source: input.source,
        capScore,
        capLabel: capLabelFor(capScore),
        summary: narrative.summary,
        verifications: input.verifications,
        ...(skippedClaims.length > 0 ? { skippedClaims } : {}),
        hypeFindings,
        nextActions,
        generatedAt: now().toISOString(),
      });
    },
  };
}
