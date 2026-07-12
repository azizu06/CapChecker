import { z } from "zod";

import { ClaimSchema } from "@/domain/analysis";
import type { ProgressEvent } from "@/domain/analysis";
import type { VideoIngestionSource } from "@/server/ingestion/video-ingestion";

export const QuantitativeClaimSchema = z
  .object({
    ticker: z.string().min(1).optional(),
    metric: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    period: z.string().min(1).optional(),
  })
  .refine(
    (quant) => Object.values(quant).some((value) => value !== undefined),
    { message: "Quantitative metadata must include at least one field" },
  );

export const ExtractedClaimSchema = ClaimSchema.and(
  z.object({
    timestampSeconds: z.number().nonnegative(),
    quant: QuantitativeClaimSchema.optional(),
  }),
);

export const TranscriptSegmentSchema = z.object({
  timestampSeconds: z.number().nonnegative(),
  text: z.string().min(1),
});

export const ClaimExtractionSchema = z.object({
  transcript: z.array(TranscriptSegmentSchema).min(1),
  claims: z.array(ExtractedClaimSchema),
});

export type ClaimExtraction = z.infer<typeof ClaimExtractionSchema>;

export class ClaimExtractionError extends Error {
  readonly code = "MALFORMED_CLAIM_EXTRACTION";
  readonly retryable = true;

  constructor() {
    super("Gemini returned an invalid transcript or claim structure.");
    this.name = "ClaimExtractionError";
  }
}

type ExtractionOptions = {
  signal: AbortSignal;
  onProgress(event: ProgressEvent): void;
};

type GeminiVideoReference = {
  name?: string;
  uri: string;
  mimeType?: string;
};

type ClaimExtractionIngestor = {
  withActiveFile<Result>(
    source: VideoIngestionSource,
    options: ExtractionOptions,
    consume: (file: GeminiVideoReference) => Promise<Result>,
  ): Promise<Result>;
};

type GeminiClaimGenerator = {
  generate(input: {
    file: GeminiVideoReference;
    signal: AbortSignal;
  }): Promise<unknown>;
};

type ClaimExtractionDependencies = {
  ingestor: ClaimExtractionIngestor;
  gemini: GeminiClaimGenerator;
};

export function createClaimExtractionPipeline({
  ingestor,
  gemini,
}: ClaimExtractionDependencies) {
  return {
    extract(source: VideoIngestionSource, options: ExtractionOptions) {
      return ingestor.withActiveFile(source, options, async (file) => {
        options.onProgress({
          type: "progress",
          stage: "extracting",
          message: "Extracting transcript and financial claims",
        });

        const parsed = ClaimExtractionSchema.safeParse(
          await gemini.generate({ file, signal: options.signal }),
        );
        if (!parsed.success) throw new ClaimExtractionError();
        return parsed.data;
      });
    },
  };
}
