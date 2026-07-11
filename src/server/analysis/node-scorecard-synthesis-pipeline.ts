import { createGeminiScorecardSynthesizer } from "./gemini-scorecard-synthesizer";
import { createScorecardSynthesisPipeline } from "./scorecard-synthesis";

type NodeScorecardSynthesisPipelineOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  model?: string;
  requestTimeoutMs?: number;
  now?: () => Date;
};

export function createNodeScorecardSynthesisPipeline({
  apiKey,
  fetch,
  model,
  requestTimeoutMs,
  now,
}: NodeScorecardSynthesisPipelineOptions) {
  return createScorecardSynthesisPipeline({
    synthesizer: createGeminiScorecardSynthesizer({
      apiKey,
      fetch,
      model,
      requestTimeoutMs,
    }),
    now,
  });
}
