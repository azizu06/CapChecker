import { z } from "zod";

export const HttpUrlSchema = z.url().refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { message: "URL must use HTTP or HTTPS" },
);

export const UploadFileNameSchema = z
  .string()
  .min(1)
  .regex(/^[^/\\]+$/, "Upload filename must not include a path");

const ClaimBaseSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  timestampSeconds: z.number().nonnegative().optional(),
});

export const OpinionClaimSchema = ClaimBaseSchema.extend({
  kind: z.literal("opinion"),
  checkable: z.literal(false),
});

export const ClaimSchema = z.discriminatedUnion("kind", [
  ClaimBaseSchema.extend({
    kind: z.literal("factual"),
    checkable: z.boolean(),
  }),
  ClaimBaseSchema.extend({
    kind: z.literal("predictive"),
    checkable: z.boolean(),
  }),
  OpinionClaimSchema,
]);

export const CheckableClaimSchema = z.discriminatedUnion("kind", [
  ClaimBaseSchema.extend({
    kind: z.literal("factual"),
    checkable: z.literal(true),
  }),
  ClaimBaseSchema.extend({
    kind: z.literal("predictive"),
    checkable: z.literal(true),
  }),
]);

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: HttpUrlSchema,
  trustTier: z.enum(["primary", "high", "medium", "low"]),
  stance: z.enum(["supports", "contradicts", "context"]),
  excerpt: z.string().min(1),
  publishedAt: z.iso.datetime().optional(),
});

export const VerificationSchema = z.object({
  claim: CheckableClaimSchema,
  verdict: z.enum(["true", "mostly-true", "unverifiable", "false"]),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
  evidence: z.array(EvidenceSchema),
});

export const HypeFindingSchema = z.object({
  id: z.string().min(1),
  phrase: z.string().min(1),
  category: z.enum(["guarantee", "urgency", "popularity", "fear", "authority"]),
  severity: z.enum(["low", "medium", "high"]),
  explanation: z.string().min(1),
});

export const NextActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  url: HttpUrlSchema.optional(),
});

export const SourceVideoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("url"),
    url: HttpUrlSchema,
    title: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("upload"),
    fileName: UploadFileNameSchema,
    title: z.string().min(1).optional(),
  }),
]);

export const ScorecardSchema = z
  .object({
    id: z.string().min(1),
    source: SourceVideoSchema,
    capScore: z.number().int().min(0).max(100),
    capLabel: z.enum(["no-cap", "some-cap", "full-of-cap"]),
    summary: z.string().min(1),
    verifications: z.array(VerificationSchema),
    skippedClaims: z.array(OpinionClaimSchema).optional(),
    hypeFindings: z.array(HypeFindingSchema),
    nextActions: z.array(NextActionSchema),
    generatedAt: z.iso.datetime(),
  })
  .superRefine(({ capLabel, capScore }, context) => {
    const expectedLabel =
      capScore < 30 ? "no-cap" : capScore < 70 ? "some-cap" : "full-of-cap";

    if (capLabel !== expectedLabel) {
      context.addIssue({
        code: "custom",
        path: ["capLabel"],
        message: `Cap Score ${capScore} must use the ${expectedLabel} label`,
      });
    }
  });

export const AnalysisStageSchema = z.enum([
  "fetching",
  "processing",
  "extracting",
  "verifying",
  "synthesizing",
]);

export const ProgressEventSchema = z.object({
  type: z.literal("progress"),
  stage: AnalysisStageSchema,
  message: z.string().min(1),
});

export const CompleteEventSchema = z.object({
  type: z.literal("complete"),
  scorecard: ScorecardSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
});

export const AnalysisEventSchema = z.discriminatedUnion("type", [
  ProgressEventSchema,
  CompleteEventSchema,
  ErrorEventSchema,
]);

export type Claim = z.infer<typeof ClaimSchema>;
export type OpinionClaim = z.infer<typeof OpinionClaimSchema>;
export type CheckableClaim = z.infer<typeof CheckableClaimSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
export type HypeFinding = z.infer<typeof HypeFindingSchema>;
export type NextAction = z.infer<typeof NextActionSchema>;
export type SourceVideo = z.infer<typeof SourceVideoSchema>;
export type Scorecard = z.infer<typeof ScorecardSchema>;
export type AnalysisStage = z.infer<typeof AnalysisStageSchema>;
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
export type CompleteEvent = z.infer<typeof CompleteEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>;
