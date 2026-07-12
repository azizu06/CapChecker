import { createNodeVideoIngestor } from "@/server/ingestion/node-video-ingestor";
import type {
  VideoIngestionPolicy,
} from "@/server/ingestion/video-ingestion";
import { normalizeYouTubeVideoUrl } from "@/server/ingestion/video-ingestion";
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
  const fileIngestor = createNodeVideoIngestor({
    apiKey,
    fetch,
    policy: ingestionPolicy,
    ytDlpExecutable,
    ytDlpRun,
  });

  return createClaimExtractionPipeline({
    ingestor: {
      async withActiveFile(source, options, consume) {
        const directUrl =
          source.kind === "url"
            ? normalizeYouTubeVideoUrl(source.url)
            : undefined;
        if (!directUrl) {
          return fileIngestor.withActiveFile(source, options, consume);
        }

        options.onProgress({
          type: "progress",
          stage: "fetching",
          message: "Sending the public YouTube video to Gemini",
        });
        options.onProgress({
          type: "progress",
          stage: "processing",
          message: "Preparing the video with Gemini",
        });

        try {
          return await consume({ uri: directUrl });
        } catch (cause) {
          if (options.signal.aborted) throw cause;
          return fileIngestor.withActiveFile(source, options, consume);
        }
      },
    },
    gemini: createGeminiClaimGenerator({
      apiKey,
      fetch,
      model,
      requestTimeoutMs,
    }),
  });
}
