import { z } from "zod";

import {
  HypeFindingSchema,
  NextActionSchema,
  OpinionClaimSchema,
  ScorecardSchema,
} from "@/domain/analysis";
import type {
  Claim,
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

const ScorecardNarrativeSchema = z.object({
  summary: z.object({
    text: z.string().min(1),
    claimIds: z.array(z.string().min(1)),
  }),
  hypeFindings: z.array(
    HypeFindingSchema.omit({ context: true, timestampSeconds: true }).extend({
      claimId: z.string().min(1),
    }),
  ),
  nextActions: z.array(NextActionSchema),
});

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

export function calculateCapScore(
  verifications: readonly Verification[],
  claims: ReadonlyArray<Pick<Claim, "kind">> = verifications.map(
    ({ claim }) => claim,
  ),
) {
  const total = verifications.reduce(
    (score, verification) => score + VERDICT_WEIGHTS[verification.verdict],
    0,
  );
  const weightedScore =
    verifications.length === 0 ? 0 : Math.round(total / verifications.length);
  const nonOpinionClaims = claims.filter(({ kind }) => kind !== "opinion");
  const predictionCount = nonOpinionClaims.filter(
    ({ kind }) => kind === "predictive",
  ).length;
  const isPredictionHeavy =
    nonOpinionClaims.length > 0 &&
    predictionCount / nonOpinionClaims.length >= PREDICTION_HEAVY_RATIO;

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
      const verificationByClaimId = new Map(
        input.verifications.map((verification) => [
          verification.claim.id,
          verification,
        ]),
      );
      const summaryReferencesAreValid =
        narrative.summary.claimIds.every((claimId) =>
          verificationByClaimId.has(claimId),
        ) &&
        (input.verifications.length === 0
          ? narrative.summary.claimIds.length === 0
          : narrative.summary.claimIds.length > 0);
      if (!summaryReferencesAreValid) throw new ScorecardSynthesisError();
      const capScore = calculateCapScore(
        input.verifications,
        input.extraction.claims,
      );
      const skippedClaims = input.extraction.claims.flatMap((claim) => {
        const parsed = OpinionClaimSchema.safeParse(claim);
        return parsed.success ? [parsed.data] : [];
      });
      const hypeFindings = narrative.hypeFindings.flatMap((finding) => {
        const phrase = finding.phrase.toLocaleLowerCase();
        const referencedVerification = verificationByClaimId.get(
          finding.claimId,
        );
        const matchingSegments = input.extraction.transcript.filter(({ text }) =>
          text.toLocaleLowerCase().includes(phrase),
        );
        const timestampedSegment = matchingSegments.find(
          ({ timestampSeconds }) =>
            timestampSeconds ===
            referencedVerification?.claim.timestampSeconds,
        );
        const claimContainsPhrase = referencedVerification?.claim.text
          .toLocaleLowerCase()
          .includes(phrase);
        const segment =
          timestampedSegment || (claimContainsPhrase ? matchingSegments[0] : undefined);
        const frozenFinding = {
          id: finding.id,
          phrase: finding.phrase,
          category: finding.category,
          severity: finding.severity,
          explanation: finding.explanation,
        };
        return segment && referencedVerification
          ? [
              {
                ...frozenFinding,
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
        summary: narrative.summary.text,
        verifications: input.verifications,
        ...(skippedClaims.length > 0 ? { skippedClaims } : {}),
        hypeFindings,
        nextActions,
        generatedAt: now().toISOString(),
      });
    },
  };
}
