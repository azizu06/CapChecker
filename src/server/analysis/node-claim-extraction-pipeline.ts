import { createNodeVideoIngestor } from "@/server/ingestion/node-video-ingestor";
import type {
  VideoIngestionPolicy,
} from "@/server/ingestion/video-ingestion";
import type { ProcessRunner } from "@/server/ingestion/yt-dlp";

import { createClaimExtractionPipeline } from "./claim-extraction";
import { createGeminiClaimGenerator } from "./gemini-claim-generator";

type NodeClaimExtractionPipelineOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  model?: string;
  requestTimeoutMs?: number;
  ingestionPolicy?: VideoIngestionPolicy;
  ytDlpExecutable?: string;
  ytDlpRun?: ProcessRunner;
};

export function createNodeClaimExtractionPipeline({
  apiKey,
  fetch,
  model,
  requestTimeoutMs,
  ingestionPolicy,
  ytDlpExecutable,
  ytDlpRun,
}: NodeClaimExtractionPipelineOptions) {
  return createClaimExtractionPipeline({
    ingestor: createNodeVideoIngestor({
      apiKey,
      fetch,
      policy: ingestionPolicy,
      ytDlpExecutable,
      ytDlpRun,
    }),
    gemini: createGeminiClaimGenerator({
      apiKey,
      fetch,
      model,
      requestTimeoutMs,
    }),
  });
}
