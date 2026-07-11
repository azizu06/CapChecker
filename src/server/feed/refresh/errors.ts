/**
 * Client-safe refresh failures. Messages here are shown to users and must
 * never leak API keys, raw upstream exceptions, or internal file paths.
 */
export class RefreshError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "RefreshError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const REFRESH_IN_PROGRESS = new RefreshError(
  "REFRESH_IN_PROGRESS",
  "A feed refresh is already running. Wait for it to finish before starting another.",
  true,
);

export const youTubeQuotaError = () =>
  new RefreshError(
    "YOUTUBE_UNAVAILABLE",
    "We could not reach YouTube for new candidates. The existing feed is unchanged — try again shortly.",
    true,
  );

export const analysisFailedError = () =>
  new RefreshError(
    "ANALYSIS_FAILED",
    "CapCheck could not finish analyzing a candidate. The existing feed is unchanged — try again shortly.",
    true,
  );

export const catalogWriteError = () =>
  new RefreshError(
    "CATALOG_WRITE_FAILED",
    "We could not save the refreshed feed. The existing feed is unchanged — try again shortly.",
    true,
  );
