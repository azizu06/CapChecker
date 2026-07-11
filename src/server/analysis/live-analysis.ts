import {
  AnalysisEventSchema,
  type AnalysisEvent,
  type ProgressEvent,
  type Scorecard,
  type SourceVideo,
  type Verification,
} from "@/domain/analysis";
import {
  ClaimExtractionError,
  type ClaimExtraction,
} from "@/server/analysis/claim-extraction";
import { ScorecardSynthesisError } from "@/server/analysis/scorecard-synthesis";
import {
  IngestionError,
  mapIngestionError,
  type VideoIngestionSource,
} from "@/server/ingestion/video-ingestion";
import { VideoMediaTypeError } from "@/server/ingestion/media-type";

type PipelineOptions = {
  signal: AbortSignal;
  onProgress(event: ProgressEvent): void;
};

type LiveAnalysisDependencies = {
  extraction: {
    extract(
      source: VideoIngestionSource,
      options: PipelineOptions,
    ): Promise<ClaimExtraction>;
  };
  verification: {
    verify(
      claims: ClaimExtraction["claims"],
      options: PipelineOptions,
    ): Promise<Verification[]>;
  };
  synthesis: {
    synthesize(
      input: {
        id: string;
        source: SourceVideo;
        extraction: ClaimExtraction;
        verifications: Verification[];
      },
      options: PipelineOptions,
    ): Promise<Scorecard>;
  };
  createAnalysisId(): string;
};

const publicSourceFor = (source: VideoIngestionSource): SourceVideo =>
  source.kind === "url"
    ? { kind: "url", url: source.url }
    : { kind: "upload", fileName: source.fileName };

const safePipelineError = (cause: unknown): AnalysisEvent | undefined => {
  if (cause instanceof IngestionError || cause instanceof VideoMediaTypeError) {
    return mapIngestionError(cause);
  }
  if (
    (cause instanceof DOMException || cause instanceof Error) &&
    cause.name === "AbortError"
  ) {
    return undefined;
  }
  if (
    cause instanceof ClaimExtractionError ||
    cause instanceof ScorecardSynthesisError
  ) {
    return {
      type: "error",
      error: {
        code: cause.code,
        message: "CapCheck could not finish this analysis. Please try again.",
        retryable: cause.retryable,
      },
    };
  }
  return {
    type: "error",
    error: {
      code: "ANALYSIS_FAILED",
      message: "CapCheck could not finish this analysis. Please try again.",
      retryable: true,
    },
  };
};

export function createLiveAnalysisOrchestrator({
  extraction,
  verification,
  synthesis,
  createAnalysisId,
}: LiveAnalysisDependencies) {
  return async function* streamLiveAnalysis(
    source: VideoIngestionSource,
    signal: AbortSignal,
  ): AsyncGenerator<AnalysisEvent> {
    if (signal.aborted) return;

    const queued: AnalysisEvent[] = [];
    let finished = false;
    let wake: (() => void) | undefined;
    const enqueue = (event: AnalysisEvent) => {
      queued.push(AnalysisEventSchema.parse(event));
      wake?.();
      wake = undefined;
    };
    const onProgress = (event: ProgressEvent) => enqueue(event);

    void (async () => {
      try {
        const extracted = await extraction.extract(source, {
          signal,
          onProgress,
        });
        const verifications = await verification.verify(extracted.claims, {
          signal,
          onProgress,
        });
        const scorecard = await synthesis.synthesize(
          {
            id: createAnalysisId(),
            source: publicSourceFor(source),
            extraction: extracted,
            verifications,
          },
          { signal, onProgress },
        );
        if (!signal.aborted) enqueue({ type: "complete", scorecard });
      } catch (cause) {
        if (!signal.aborted) {
          const event = safePipelineError(cause);
          if (event) enqueue(event);
        }
      } finally {
        finished = true;
        wake?.();
        wake = undefined;
      }
    })();

    while (!finished || queued.length > 0) {
      if (queued.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      yield queued.shift()!;
    }
  };
}
