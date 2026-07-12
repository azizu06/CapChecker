import type { AnalysisEvent, Scorecard } from "@/domain/analysis";
import type { VideoIngestionSource } from "@/server/ingestion/video-ingestion";

import { analysisFailedError } from "./errors";
import type { AnalyzeVideo } from "./ports";

export type AnalysisStream = (
  source: VideoIngestionSource,
  signal: AbortSignal,
) => AsyncGenerator<AnalysisEvent>;

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Adapts the existing CapCheck analyzer generator into the `AnalyzeVideo`
 * port. We consume the stream to its terminal event: `complete` yields the
 * scorecard; `error` or an exhausted stream surfaces one sanitized, retryable
 * failure. A per-candidate timeout guards against a stalled analysis without
 * ever spawning a second scoring implementation.
 */
export function createScorecardAnalyzer(options: {
  createStream: () => AnalysisStream;
  timeoutMs?: number;
}): AnalyzeVideo {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function analyze({ url, signal }): Promise<Scorecard> {
    const timeout = new AbortController();
    const timer = setTimeout(
      () => timeout.abort(new DOMException("Analysis timed out", "TimeoutError")),
      timeoutMs,
    );
    const combined = AbortSignal.any([signal, timeout.signal]);
    const source: VideoIngestionSource = { kind: "url", url };

    try {
      const stream = options.createStream()(source, combined);
      for await (const event of stream) {
        if (event.type === "complete") return event.scorecard;
        if (event.type === "error") throw analysisFailedError();
      }
      throw analysisFailedError();
    } catch (cause) {
      if (signal.aborted) throw cause;
      if (cause instanceof Error && cause.name === "RefreshError") throw cause;
      throw analysisFailedError();
    } finally {
      clearTimeout(timer);
    }
  };
}
