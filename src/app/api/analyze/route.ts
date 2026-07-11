import { createNodeLiveAnalysisOrchestrator } from "@/server/analysis/node-live-analysis";

import { createAnalyzeHandler } from "./route-handler";

const createConfiguredLiveStream = () => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const finnhubApiKey = process.env.FINNHUB_KEY;
  if (!geminiApiKey || !finnhubApiKey) {
    throw new Error("Live analysis credentials are not configured");
  }
  return createNodeLiveAnalysisOrchestrator({ geminiApiKey, finnhubApiKey });
};

export const POST = createAnalyzeHandler({
  createLiveStream: createConfiguredLiveStream,
});
