import { createClaimVerificationPipeline } from "./claim-verification";
import { createFinnhubMarketData } from "./finnhub-market-data";
import { createGeminiClaimVerifier } from "./gemini-claim-verifier";

type NodeClaimVerificationPipelineOptions = {
  apiKey: string;
  finnhubApiKey: string;
  fetch?: typeof fetch;
  model?: string;
  maxConcurrency?: number;
};

export function createNodeClaimVerificationPipeline({
  apiKey,
  finnhubApiKey,
  fetch,
  model,
  maxConcurrency,
}: NodeClaimVerificationPipelineOptions) {
  return createClaimVerificationPipeline({
    maxConcurrency,
    verifier: createGeminiClaimVerifier({
      apiKey,
      fetch,
      model,
      marketData: createFinnhubMarketData({
        apiKey: finnhubApiKey,
        fetch,
      }),
    }),
  });
}
