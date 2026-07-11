import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createNodeClaimExtractionPipeline,
  createNodeClaimVerificationPipeline,
  createNodeScorecardSynthesisPipeline,
} = vi.hoisted(() => {
  const extract = vi.fn();
  const verify = vi.fn();
  const synthesize = vi.fn();
  return {
    extract,
    verify,
    synthesize,
    createNodeClaimExtractionPipeline: vi.fn(() => ({ extract })),
    createNodeClaimVerificationPipeline: vi.fn(() => ({ verify })),
    createNodeScorecardSynthesisPipeline: vi.fn(() => ({ synthesize })),
  };
});

vi.mock("./node-claim-extraction-pipeline", () => ({
  createNodeClaimExtractionPipeline,
}));
vi.mock("./node-claim-verification-pipeline", () => ({
  createNodeClaimVerificationPipeline,
}));
vi.mock("./node-scorecard-synthesis-pipeline", () => ({
  createNodeScorecardSynthesisPipeline,
}));

import { createNodeLiveAnalysisOrchestrator } from "./node-live-analysis";

describe("Node live analysis wiring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("configures every production pipeline from server credentials", () => {
    const stream = createNodeLiveAnalysisOrchestrator({
      geminiApiKey: "gemini-secret",
      finnhubApiKey: "finnhub-secret",
      createAnalysisId: () => "analysis-id",
    });

    expect(stream).toEqual(expect.any(Function));
    expect(createNodeClaimExtractionPipeline).toHaveBeenCalledWith({
      apiKey: "gemini-secret",
    });
    expect(createNodeClaimVerificationPipeline).toHaveBeenCalledWith({
      apiKey: "gemini-secret",
      finnhubApiKey: "finnhub-secret",
    });
    expect(createNodeScorecardSynthesisPipeline).toHaveBeenCalledWith({
      apiKey: "gemini-secret",
    });
  });
});
