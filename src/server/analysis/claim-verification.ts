import { CheckableClaimSchema, VerificationSchema } from "@/domain/analysis";
import type { ProgressEvent, Verification } from "@/domain/analysis";

import type { ClaimExtraction } from "./claim-extraction";

type ExtractedClaim = ClaimExtraction["claims"][number];

type VerificationDraft = Omit<Verification, "claim">;

type ClaimVerifier = {
  verifyClaim(
    claim: ExtractedClaim,
    options: { signal: AbortSignal },
  ): Promise<VerificationDraft>;
};

type ClaimVerificationOptions = {
  signal: AbortSignal;
  onProgress(event: ProgressEvent): void;
};

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  limit: number,
  transform: (input: Input) => Promise<Output>,
) {
  const results = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex++;
      results[index] = await transform(inputs[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, () => worker()),
  );
  return results;
}

export function createClaimVerificationPipeline({
  verifier,
  maxConcurrency = 3,
}: {
  verifier: ClaimVerifier;
  maxConcurrency?: number;
}) {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new TypeError("maxConcurrency must be a positive integer");
  }

  return {
    async verify(
      claims: ClaimExtraction["claims"],
      options: ClaimVerificationOptions,
    ) {
      const checkable = claims.flatMap((claim) => {
        const parsed = CheckableClaimSchema.safeParse(claim);
        return parsed.success ? [{ extracted: claim, frozen: parsed.data }] : [];
      });

      options.onProgress({
        type: "progress",
        stage: "verifying",
        message: `Verifying ${checkable.length} checkable ${checkable.length === 1 ? "claim" : "claims"}`,
      });

      return mapWithConcurrency(
        checkable,
        maxConcurrency,
        async ({ extracted, frozen }) => {
          try {
            return VerificationSchema.parse({
              claim: frozen,
              ...(await verifier.verifyClaim(extracted, {
                signal: options.signal,
              })),
            });
          } catch (cause) {
            if (options.signal.aborted) throw cause;
            return VerificationSchema.parse({
              claim: frozen,
              verdict: "unverifiable",
              confidence: 0,
              explanation:
                "This claim could not be verified with the available evidence.",
              evidence: [],
            });
          }
        },
      );
    },
  };
}
