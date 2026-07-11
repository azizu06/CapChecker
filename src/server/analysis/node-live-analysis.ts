import { createLiveAnalysisOrchestrator } from "./live-analysis";
import { createNodeClaimExtractionPipeline } from "./node-claim-extraction-pipeline";
import { createNodeClaimVerificationPipeline } from "./node-claim-verification-pipeline";
import { createNodeScorecardSynthesisPipeline } from "./node-scorecard-synthesis-pipeline";

type NodeLiveAnalysisOptions = {
  geminiApiKey: string;
  finnhubApiKey: string;
  createAnalysisId?: () => string;
};

export function createNodeLiveAnalysisOrchestrator({
  geminiApiKey,
  finnhubApiKey,
  createAnalysisId = () => crypto.randomUUID(),
}: NodeLiveAnalysisOptions) {
  return createLiveAnalysisOrchestrator({
    extraction: createNodeClaimExtractionPipeline({ apiKey: geminiApiKey }),
    verification: createNodeClaimVerificationPipeline({
      apiKey: geminiApiKey,
      finnhubApiKey,
    }),
    synthesis: createNodeScorecardSynthesisPipeline({ apiKey: geminiApiKey }),
    createAnalysisId,
  });
}
